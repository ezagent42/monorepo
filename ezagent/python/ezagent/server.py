"""EZAgent42 HTTP API server.

FastAPI application wrapping the Rust Engine via PyO3 bindings.

NOTE: All endpoint functions are synchronous (``def``, not ``async def``)
because ``PyEngine`` is a PyO3 ``unsendable`` class -- it must only be
accessed from the OS thread that created it.  Synchronous FastAPI
endpoints are dispatched to a worker threadpool; we store the engine in
a ``threading.local()`` so each worker thread lazily creates its own
instance and never touches another thread's ``PyEngine``.

For single-worker / test scenarios the thread-local effectively acts
as a singleton.

Engine versioning
~~~~~~~~~~~~~~~~~
A global ``_engine_version`` counter is bumped every time the factory or
reset function is called.  Each thread-local slot records which version
it was created at; ``get_engine`` compares the two and re-creates the
engine when they diverge.  This lets test fixtures on the *test* thread
invalidate the portal thread's cached engine without directly touching
the thread-local from another thread.

Test note
~~~~~~~~~
``TestClient`` must be used as a **context manager** (``with TestClient(app)
as client:``) so that Starlette pins a single portal thread for all
requests in the session.  Without the context manager, ``anyio`` may
dispatch each request to a different worker thread, which both breaks
``threading.local()`` persistence and violates PyO3 thread-affinity.
"""

from __future__ import annotations

import base64
import json
import os
import threading
import urllib.request
import urllib.error
from typing import Callable, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ezagent._native import PyEngine

# ---------------------------------------------------------------------------
# Engine management -- thread-local storage for unsendable PyO3 class
# ---------------------------------------------------------------------------

_local = threading.local()

# Optional factory hook -- tests can override this to inject a pre-
# configured engine (e.g. one with identity already initialised).
_engine_factory: Optional[Callable[[], PyEngine]] = None

# Monotonically increasing version; bumped on reset / factory change.
_engine_version: int = 0


def _default_engine_factory() -> PyEngine:
    """Create a bare PyEngine (identity uninitialised)."""
    return PyEngine()


def get_engine() -> PyEngine:
    """FastAPI dependency: per-thread engine, lazily created.

    The engine is recreated when the global version has advanced past
    the thread-local version (i.e. after a ``reset_engine`` or
    ``set_engine_factory`` call from any thread).
    """
    local_ver: int = getattr(_local, "engine_version", -1)
    if local_ver != _engine_version:
        # Version mismatch -- need a fresh engine on *this* thread.
        _local.engine = None

    engine: Optional[PyEngine] = getattr(_local, "engine", None)
    if engine is None:
        factory = _engine_factory or _default_engine_factory
        engine = factory()
        _local.engine = engine
        _local.engine_version = _engine_version
    return engine


def set_engine_factory(factory: Optional[Callable[[], PyEngine]]) -> None:
    """Override the factory used to create new ``PyEngine`` instances.

    Bumps the engine version so that worker threads will lazily recreate
    their engines using the new factory on the next request.

    Pass ``None`` to restore the default factory.  Primarily used by
    tests that need engines with pre-configured identity.
    """
    global _engine_factory, _engine_version
    _engine_factory = factory
    _engine_version += 1


def reset_engine() -> None:
    """Invalidate engines across all threads.

    Bumps the global version so every thread will recreate its engine
    on the next call to ``get_engine``.  The old engine on each thread
    is dropped lazily (on the same thread that created it) the next
    time ``get_engine`` is called, preserving PyO3 thread-affinity.
    """
    global _engine_version
    _engine_version += 1


# ---------------------------------------------------------------------------
# Session storage (in-memory, single user for local desktop app)
# ---------------------------------------------------------------------------

_session: Optional[dict] = None


def clear_session() -> None:
    """Clear the current session.  Used by tests for teardown."""
    global _session
    _session = None


# ---------------------------------------------------------------------------
# GitHub API helper
# ---------------------------------------------------------------------------


def _fetch_github_user(github_token: str) -> dict:
    """Call GitHub API to get user info from an OAuth token.

    Uses ``urllib.request`` (stdlib) to avoid extra dependencies.

    Returns:
        dict with keys ``login``, ``id``, ``name``, ``avatar_url``.

    Raises:
        HTTPException: If the GitHub token is invalid or the API request fails.
    """
    req = urllib.request.Request(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "ezagent42",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid GitHub token"}},
            )
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "GITHUB_API_ERROR", "message": f"GitHub API returned {exc.code}"}},
        )
    except urllib.error.URLError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "GITHUB_API_ERROR", "message": str(exc.reason)}},
        )


# ---------------------------------------------------------------------------
# Error mapping helper
# ---------------------------------------------------------------------------


def _map_engine_error(e: RuntimeError) -> HTTPException:
    """Map engine RuntimeError to appropriate HTTPException."""
    msg = str(e)
    if "not found" in msg.lower() or "datatype not found" in msg.lower():
        return HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": msg}},
        )
    if "permission denied" in msg.lower():
        return HTTPException(
            status_code=401,
            detail={"error": {"code": "UNAUTHORIZED", "message": msg}},
        )
    if "not a member" in msg.lower():
        return HTTPException(
            status_code=403,
            detail={"error": {"code": "NOT_A_MEMBER", "message": msg}},
        )
    return HTTPException(
        status_code=500,
        detail={"error": {"code": "INTERNAL_ERROR", "message": msg}},
    )


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class GitHubAuthRequest(BaseModel):
    github_token: str


class CreateRoomRequest(BaseModel):
    name: str


class UpdateRoomRequest(BaseModel):
    name: str


class InviteRequest(BaseModel):
    entity_id: str


class SendMessageRequest(BaseModel):
    body: str
    format: str = "text/plain"


class AddAnnotationRequest(BaseModel):
    key: str
    value: str


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ezagent",
    version="0.1.0",
    description="EZAgent42 HTTP API",
)


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------


@app.get("/api/status")
def get_status(engine: PyEngine = Depends(get_engine)):
    """Health check and engine status."""
    initialized, datatypes = engine.status()
    return {
        "status": "ok",
        "identity_initialized": initialized,
        "registered_datatypes": datatypes,
    }


# ---------------------------------------------------------------------------
# Identity (Task 15)
# ---------------------------------------------------------------------------


@app.get("/api/identity")
def get_identity(engine: PyEngine = Depends(get_engine)):
    """Return current identity information."""
    try:
        entity_id = engine.identity_whoami()
    except RuntimeError as e:
        raise HTTPException(status_code=401, detail={
            "error": {"code": "UNAUTHORIZED", "message": str(e)}
        })
    return {"entity_id": entity_id}


@app.get("/api/identity/{entity_id}/pubkey")
def get_pubkey(entity_id: str, engine: PyEngine = Depends(get_engine)):
    """Return hex-encoded Ed25519 public key for an entity."""
    try:
        pubkey = engine.identity_get_pubkey(entity_id)
    except RuntimeError as e:
        raise _map_engine_error(e)
    return {"pubkey": pubkey}


# ---------------------------------------------------------------------------
# Authentication (Task 8)
# ---------------------------------------------------------------------------


@app.post("/api/auth/github")
def auth_github(req: GitHubAuthRequest, engine: PyEngine = Depends(get_engine)):
    """Exchange a GitHub OAuth token for an EZAgent entity + keypair.

    Calls the GitHub API to retrieve user info, maps the GitHub username
    to an entity_id, and initialises the engine identity for new users.
    """
    global _session

    github_user = _fetch_github_user(req.github_token)

    login: str = github_user.get("login", "")
    github_id: int = github_user.get("id", 0)
    display_name: str = github_user.get("name") or login
    avatar_url: str = github_user.get("avatar_url", "")

    entity_id = f"@{login}:relay.ezagent.dev"

    # Check if engine already has this identity initialised.
    is_new_user = True
    try:
        existing = engine.identity_whoami()
        if existing == entity_id:
            is_new_user = False
    except RuntimeError:
        # Identity not initialised yet -- expected for new users.
        pass

    # Generate a keypair and initialise the engine identity for new users.
    keypair_bytes = os.urandom(32)
    if is_new_user:
        try:
            engine.identity_init(entity_id, keypair_bytes)
        except RuntimeError as e:
            raise _map_engine_error(e)

    keypair_b64 = base64.b64encode(keypair_bytes).decode()

    _session = {
        "entity_id": entity_id,
        "display_name": display_name,
        "avatar_url": avatar_url,
        "github_id": github_id,
    }

    return {
        "entity_id": entity_id,
        "display_name": display_name,
        "avatar_url": avatar_url,
        "keypair": keypair_b64,
        "is_new_user": is_new_user,
    }


@app.post("/api/auth/test-init")
def auth_test_init(
    engine: PyEngine = Depends(get_engine),
):
    """Initialise identity for E2E testing — only available when EZAGENT_E2E=1.

    This bypasses GitHub OAuth entirely, creating a test entity with a
    random keypair. Used by Playwright E2E tests.
    """
    if os.environ.get("EZAGENT_E2E") != "1":
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "FORBIDDEN", "message": "test-init only available in E2E mode (EZAGENT_E2E=1)"}},
        )

    global _session

    entity_id = "@e2e-tester:relay.ezagent.dev"
    display_name = "E2E Tester"

    # Check if already initialised.
    try:
        existing = engine.identity_whoami()
        if existing == entity_id:
            _session = {
                "entity_id": entity_id,
                "display_name": display_name,
                "avatar_url": "",
                "github_id": 0,
            }
            return {
                "entity_id": entity_id,
                "display_name": display_name,
                "is_new_user": False,
            }
    except RuntimeError:
        pass

    keypair_bytes = os.urandom(32)
    try:
        engine.identity_init(entity_id, keypair_bytes)
    except RuntimeError as e:
        raise _map_engine_error(e)

    _session = {
        "entity_id": entity_id,
        "display_name": display_name,
        "avatar_url": "",
        "github_id": 0,
    }

    return {
        "entity_id": entity_id,
        "display_name": display_name,
        "is_new_user": True,
    }


@app.get("/api/auth/session")
def auth_session():
    """Return current session info, or 401 if not authenticated."""
    if _session is None:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Not authenticated"}},
        )
    return {**_session, "authenticated": True}


@app.post("/api/auth/logout")
def auth_logout():
    """Clear the current session."""
    global _session
    _session = None
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Rooms (Task 16)
# ---------------------------------------------------------------------------


@app.post("/api/rooms", status_code=201)
def create_room(req: CreateRoomRequest, engine: PyEngine = Depends(get_engine)):
    """Create a new room."""
    try:
        room_json = engine.room_create(req.name)
        return json.loads(room_json)
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.get("/api/rooms")
def list_rooms(engine: PyEngine = Depends(get_engine)):
    """List all rooms with full details."""
    try:
        room_ids = engine.room_list()
        rooms = []
        for room_id in room_ids:
            room_json = engine.room_get(room_id)
            rooms.append(json.loads(room_json))
        return rooms
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.get("/api/rooms/{room_id}")
def get_room(room_id: str, engine: PyEngine = Depends(get_engine)):
    """Get a room by ID."""
    try:
        room_json = engine.room_get(room_id)
        return json.loads(room_json)
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.patch("/api/rooms/{room_id}")
def update_room(
    room_id: str,
    req: UpdateRoomRequest,
    engine: PyEngine = Depends(get_engine),
):
    """Update room configuration."""
    try:
        updates = json.dumps({"name": req.name})
        engine.room_update_config(room_id, updates)
        room_json = engine.room_get(room_id)
        return json.loads(room_json)
    except RuntimeError as e:
        raise _map_engine_error(e)


# ---------------------------------------------------------------------------
# Room Membership (Task 17)
# ---------------------------------------------------------------------------


@app.post("/api/rooms/{room_id}/invite")
def invite_to_room(
    room_id: str,
    req: InviteRequest,
    engine: PyEngine = Depends(get_engine),
):
    """Invite an entity to a room."""
    try:
        engine.room_invite(room_id, req.entity_id)
        return {"status": "ok"}
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.post("/api/rooms/{room_id}/join")
def join_room(room_id: str, engine: PyEngine = Depends(get_engine)):
    """Join a room."""
    try:
        engine.room_join(room_id)
        return {"status": "ok"}
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.post("/api/rooms/{room_id}/leave")
def leave_room(room_id: str, engine: PyEngine = Depends(get_engine)):
    """Leave a room."""
    try:
        engine.room_leave(room_id)
        return {"status": "ok"}
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.get("/api/rooms/{room_id}/members")
def get_room_members(room_id: str, engine: PyEngine = Depends(get_engine)):
    """List members of a room."""
    try:
        members = engine.room_members(room_id)
        return {"members": members}
    except RuntimeError as e:
        raise _map_engine_error(e)


# ---------------------------------------------------------------------------
# Messages (Task 18)
# ---------------------------------------------------------------------------


@app.post("/api/rooms/{room_id}/messages", status_code=201)
def send_message(
    room_id: str,
    req: SendMessageRequest,
    engine: PyEngine = Depends(get_engine),
):
    """Send a message to a room."""
    try:
        body_json = json.dumps(req.body)
        content_json = engine.message_send(room_id, body_json, req.format)
        return json.loads(content_json)
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.get("/api/rooms/{room_id}/messages")
def list_messages(
    room_id: str,
    limit: Optional[int] = Query(default=None),
    before: Optional[str] = Query(default=None),
    engine: PyEngine = Depends(get_engine),
):
    """List timeline refs for a room with optional pagination."""
    try:
        ref_ids = engine.timeline_list(room_id)

        # Apply 'before' filter: only include refs that come before the
        # given ref_id in the list order.
        if before is not None:
            try:
                idx = ref_ids.index(before)
                ref_ids = ref_ids[:idx]
            except ValueError:
                # 'before' ref not found -- return all refs
                pass

        # Apply limit
        if limit is not None and limit > 0:
            ref_ids = ref_ids[:limit]

        results = []
        for ref_id in ref_ids:
            ref_json = engine.timeline_get_ref(room_id, ref_id)
            results.append(json.loads(ref_json))
        return results
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.get("/api/rooms/{room_id}/messages/{ref_id}")
def get_message(
    room_id: str,
    ref_id: str,
    engine: PyEngine = Depends(get_engine),
):
    """Get a specific timeline ref."""
    try:
        ref_json = engine.timeline_get_ref(room_id, ref_id)
        return json.loads(ref_json)
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.delete("/api/rooms/{room_id}/messages/{ref_id}", status_code=204)
def delete_message(
    room_id: str,
    ref_id: str,
    engine: PyEngine = Depends(get_engine),
):
    """Delete a message."""
    try:
        engine.message_delete(room_id, ref_id)
        return Response(status_code=204)
    except RuntimeError as e:
        raise _map_engine_error(e)


# ---------------------------------------------------------------------------
# Annotations (Task 19)
# ---------------------------------------------------------------------------


@app.post(
    "/api/rooms/{room_id}/messages/{ref_id}/annotations",
    status_code=201,
)
def add_annotation(
    room_id: str,
    ref_id: str,
    req: AddAnnotationRequest,
    engine: PyEngine = Depends(get_engine),
):
    """Add an annotation to a timeline ref."""
    try:
        engine.annotation_add(room_id, ref_id, req.key, req.value)
        return {"status": "ok"}
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.get("/api/rooms/{room_id}/messages/{ref_id}/annotations")
def list_annotations(
    room_id: str,
    ref_id: str,
    engine: PyEngine = Depends(get_engine),
):
    """List annotations on a timeline ref."""
    try:
        raw = engine.annotation_list(room_id, ref_id)
        annotations = []
        for entry in raw:
            # Format: "key=value"
            key, _, value = entry.partition("=")
            annotations.append({"key": key, "value": value})
        return annotations
    except RuntimeError as e:
        raise _map_engine_error(e)


@app.delete(
    "/api/rooms/{room_id}/messages/{ref_id}/annotations/{key:path}",
    status_code=204,
)
def delete_annotation(
    room_id: str,
    ref_id: str,
    key: str,
    engine: PyEngine = Depends(get_engine),
):
    """Remove an annotation from a timeline ref."""
    try:
        engine.annotation_remove(room_id, ref_id, key)
        return Response(status_code=204)
    except RuntimeError as e:
        raise _map_engine_error(e)


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-01: Mutable Messages (Task 20)
# ---------------------------------------------------------------------------


@app.put("/api/rooms/{room_id}/messages/{ref_id}")
def edit_message(room_id: str, ref_id: str):
    """EXT-01: Edit a mutable message."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-01 mutable messages not yet implemented",
            }
        },
    )


@app.get("/api/rooms/{room_id}/messages/{ref_id}/versions")
def get_message_versions(room_id: str, ref_id: str):
    """EXT-01: Get edit history of a mutable message."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-01 edit history not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-03: Reactions (Task 20)
# ---------------------------------------------------------------------------


@app.post("/api/rooms/{room_id}/messages/{ref_id}/reactions", status_code=201)
def add_reaction(room_id: str, ref_id: str):
    """EXT-03: Add a reaction to a message."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-03 reactions not yet implemented",
            }
        },
    )


@app.delete("/api/rooms/{room_id}/messages/{ref_id}/reactions/{emoji}")
def remove_reaction(room_id: str, ref_id: str, emoji: str):
    """EXT-03: Remove a reaction."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-03 reactions not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-05: Cross-room Preview (Task 21)
# ---------------------------------------------------------------------------


@app.get("/api/rooms/{room_id}/messages/{ref_id}/preview")
def cross_room_preview(room_id: str, ref_id: str):
    """EXT-05: Cross-room reference preview."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-05 cross-room preview not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-06: Channels (Task 21)
# ---------------------------------------------------------------------------


@app.get("/api/channels")
def list_channels():
    """EXT-06: List all channels."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-06 channels not yet implemented",
            }
        },
    )


@app.get("/api/channels/{channel}/messages")
def get_channel_messages(channel: str):
    """EXT-06: Get channel aggregated messages."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-06 channels not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-07: Moderation (Task 21)
# ---------------------------------------------------------------------------


@app.post("/api/rooms/{room_id}/moderation")
def moderate_message(room_id: str):
    """EXT-07: Moderate a message."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-07 moderation not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-08: Read Receipts (Task 21)
# ---------------------------------------------------------------------------


@app.get("/api/rooms/{room_id}/receipts")
def get_read_receipts(room_id: str):
    """EXT-08: Get read receipts."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-08 read receipts not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-09: Presence + Typing (Task 21)
# ---------------------------------------------------------------------------


@app.get("/api/rooms/{room_id}/presence")
def get_presence(room_id: str):
    """EXT-09: Get presence status."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-09 presence not yet implemented",
            }
        },
    )


@app.post("/api/rooms/{room_id}/typing")
def typing_indicator(room_id: str):
    """EXT-09: Send typing indicator."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-09 typing indicator not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-10: Media / Blobs (Task 21)
# ---------------------------------------------------------------------------


@app.post("/api/blobs", status_code=201)
def upload_blob():
    """EXT-10: Upload a blob."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-10 media/blobs not yet implemented",
            }
        },
    )


@app.get("/api/blobs/{blob_hash}")
def get_blob(blob_hash: str):
    """EXT-10: Download a blob."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-10 media/blobs not yet implemented",
            }
        },
    )


@app.get("/api/rooms/{room_id}/media")
def list_room_media(room_id: str):
    """EXT-10: List room media."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-10 media/blobs not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-11: Threads (Task 21)
# ---------------------------------------------------------------------------
# Thread view is handled via query parameter on list_messages: ?thread_root=...
# No additional endpoint needed.


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-12: Drafts (Task 21)
# ---------------------------------------------------------------------------


@app.get("/api/rooms/{room_id}/drafts")
def get_drafts(room_id: str):
    """EXT-12: Get drafts."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-12 drafts not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-02: Collaborative ACL (Task 22)
# ---------------------------------------------------------------------------


@app.get("/api/rooms/{room_id}/content/{content_id}/acl")
def get_content_acl(room_id: str, content_id: str):
    """EXT-02: Get collaborative content ACL."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-02 collaborative ACL not yet implemented",
            }
        },
    )


@app.put("/api/rooms/{room_id}/content/{content_id}/acl")
def update_content_acl(room_id: str, content_id: str):
    """EXT-02: Update collaborative content ACL."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-02 collaborative ACL not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-13: Profile (Task 22)
# ---------------------------------------------------------------------------


@app.get("/api/identity/{entity_id}/profile")
def get_profile(entity_id: str):
    """EXT-13: Get entity profile."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-13 profile not yet implemented",
            }
        },
    )


@app.put("/api/identity/{entity_id}/profile")
def update_profile(entity_id: str):
    """EXT-13: Update entity profile."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-13 profile not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Extension Stubs — EXT-14: Watch (Task 22)
# ---------------------------------------------------------------------------


@app.post("/api/watches", status_code=201)
def create_watch():
    """EXT-14: Create a watch."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-14 watch not yet implemented",
            }
        },
    )


@app.get("/api/watches")
def list_watches():
    """EXT-14: List watches."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-14 watch not yet implemented",
            }
        },
    )


@app.delete("/api/watches/{key}")
def delete_watch(key: str):
    """EXT-14: Delete a watch."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "EXT-14 watch not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# Render Pipeline (Task 22)
# ---------------------------------------------------------------------------


@app.get("/api/renderers")
def list_renderers():
    """List all registered renderers (global)."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "render pipeline not yet implemented",
            }
        },
    )


@app.get("/api/rooms/{room_id}/renderers")
def list_room_renderers(room_id: str):
    """List renderers active for a room."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "render pipeline not yet implemented",
            }
        },
    )


@app.get("/api/rooms/{room_id}/views")
def list_room_views(room_id: str):
    """List view tabs for a room."""
    raise HTTPException(
        status_code=501,
        detail={
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "render pipeline not yet implemented",
            }
        },
    )


# ---------------------------------------------------------------------------
# WebSocket Event Stream (Task 25)
# ---------------------------------------------------------------------------


@app.websocket("/ws")
async def ws_events(websocket: WebSocket, room: Optional[str] = None):
    """WebSocket endpoint for real-time event streaming.

    Optionally filter by room_id via ``?room=<room_id>`` query parameter.
    Events are sent as JSON objects matching the EngineEvent format.

    The handler uses a background thread to poll ``PyEventReceiver`` (which
    is ``unsendable`` and must stay on the thread that created it) and relays
    events to the async WebSocket via an ``asyncio.Queue``.
    """
    import asyncio

    await websocket.accept()

    queue: asyncio.Queue = asyncio.Queue()
    stop = threading.Event()
    loop = asyncio.get_event_loop()

    def _poll_events():
        """Background thread: create engine + subscriber and poll events."""
        engine = get_engine()
        rx = engine.subscribe_events()
        while not stop.is_set():
            event_json = rx.next_event(500)
            if event_json is not None:
                loop.call_soon_threadsafe(queue.put_nowait, event_json)

    thread = threading.Thread(target=_poll_events, daemon=True)
    thread.start()

    try:
        while True:
            event_json = await queue.get()

            # Apply room filter if specified.
            if room is not None:
                event_data = json.loads(event_json)
                if event_data.get("room_id") != room:
                    continue

            await websocket.send_text(event_json)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        stop.set()
        thread.join(timeout=2)

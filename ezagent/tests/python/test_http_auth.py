"""Tests for the Auth API HTTP endpoints (Task 8).

Covers GitHub OAuth exchange, session retrieval, and logout.

Mocks the GitHub API call to avoid real HTTP requests during tests.
Uses the same engine injection pattern as test_http_api.py.

IMPORTANT: ``TestClient`` must be used as a **context manager** so that
Starlette pins a single portal thread for all requests in the session.
"""

import json
import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from ezagent._native import PyEngine
from ezagent.server import app, clear_session, reset_engine, set_engine_factory


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _fresh_engine():
    """Ensure a clean engine singleton and session for each test."""
    set_engine_factory(None)
    reset_engine()
    clear_session()
    yield
    set_engine_factory(None)
    reset_engine()
    clear_session()


@pytest.fixture()
def client():
    """Provide a TestClient within a context manager for thread pinning."""
    with TestClient(app) as c:
        yield c


# ------------------------------------------------------------------
# Mock GitHub API response helper
# ------------------------------------------------------------------

_GITHUB_USER = {
    "login": "alice",
    "id": 12345,
    "name": "Alice",
    "avatar_url": "https://avatars.githubusercontent.com/u/12345",
}


def _mock_github_response(user_data: dict = _GITHUB_USER):
    """Create a mock for ``urllib.request.urlopen`` that returns *user_data*."""
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(user_data).encode()
    mock_resp.__enter__ = MagicMock(return_value=mock_resp)
    mock_resp.__exit__ = MagicMock(return_value=False)
    return mock_resp


# ------------------------------------------------------------------
# Task 8: Auth — POST /api/auth/github (TC-5-AUTH-001~002)
# ------------------------------------------------------------------


@patch("ezagent.server.urllib.request.urlopen")
def test_auth_github_valid_token(mock_urlopen, client):
    """POST /api/auth/github with valid token returns entity_id, display_name, etc."""
    mock_urlopen.return_value = _mock_github_response()

    response = client.post(
        "/api/auth/github",
        json={"github_token": "gho_valid_token_123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["entity_id"] == "@alice:relay.ezagent.dev"
    assert data["display_name"] == "Alice"
    assert data["avatar_url"] == "https://avatars.githubusercontent.com/u/12345"
    assert "keypair" in data
    assert data["is_new_user"] is True

    # Verify keypair is valid base64 that decodes to 32 bytes
    import base64
    keypair_bytes = base64.b64decode(data["keypair"])
    assert len(keypair_bytes) == 32


@patch("ezagent.server.urllib.request.urlopen")
def test_auth_github_invalid_token(mock_urlopen, client):
    """POST /api/auth/github with invalid token returns 401."""
    import urllib.error

    mock_urlopen.side_effect = urllib.error.HTTPError(
        url="https://api.github.com/user",
        code=401,
        msg="Unauthorized",
        hdrs=None,
        fp=None,
    )

    response = client.post(
        "/api/auth/github",
        json={"github_token": "gho_invalid_token"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["error"]["code"] == "UNAUTHORIZED"


@patch("ezagent.server.urllib.request.urlopen")
def test_auth_github_uses_login_when_name_missing(mock_urlopen, client):
    """POST /api/auth/github falls back to login when name is null."""
    user_no_name = {
        "login": "bob",
        "id": 67890,
        "name": None,
        "avatar_url": "https://avatars.githubusercontent.com/u/67890",
    }
    mock_urlopen.return_value = _mock_github_response(user_no_name)

    response = client.post(
        "/api/auth/github",
        json={"github_token": "gho_bobs_token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["entity_id"] == "@bob:relay.ezagent.dev"
    assert data["display_name"] == "bob"


@patch("ezagent.server.urllib.request.urlopen")
def test_auth_github_sets_session(mock_urlopen, client):
    """POST /api/auth/github stores session so GET /api/auth/session works."""
    mock_urlopen.return_value = _mock_github_response()

    client.post("/api/auth/github", json={"github_token": "gho_valid"})

    session_resp = client.get("/api/auth/session")
    assert session_resp.status_code == 200
    data = session_resp.json()
    assert data["entity_id"] == "@alice:relay.ezagent.dev"
    assert data["authenticated"] is True


@patch("ezagent.server.urllib.request.urlopen")
def test_auth_github_github_api_error(mock_urlopen, client):
    """POST /api/auth/github returns 502 for non-401 GitHub errors."""
    import urllib.error

    mock_urlopen.side_effect = urllib.error.HTTPError(
        url="https://api.github.com/user",
        code=500,
        msg="Internal Server Error",
        hdrs=None,
        fp=None,
    )

    response = client.post(
        "/api/auth/github",
        json={"github_token": "gho_some_token"},
    )
    assert response.status_code == 502
    data = response.json()
    assert data["detail"]["error"]["code"] == "GITHUB_API_ERROR"


# ------------------------------------------------------------------
# Task 8: Auth — GET /api/auth/session (TC-5-AUTH-003~004)
# ------------------------------------------------------------------


def test_auth_session_not_authenticated(client):
    """GET /api/auth/session returns 401 when no session exists."""
    response = client.get("/api/auth/session")
    assert response.status_code == 401
    data = response.json()
    assert data["detail"]["error"]["code"] == "UNAUTHORIZED"


@patch("ezagent.server.urllib.request.urlopen")
def test_auth_session_authenticated(mock_urlopen, client):
    """GET /api/auth/session returns session data when authenticated."""
    mock_urlopen.return_value = _mock_github_response()

    # Authenticate first
    client.post("/api/auth/github", json={"github_token": "gho_valid"})

    # Check session
    response = client.get("/api/auth/session")
    assert response.status_code == 200
    data = response.json()
    assert data["entity_id"] == "@alice:relay.ezagent.dev"
    assert data["display_name"] == "Alice"
    assert data["avatar_url"] == "https://avatars.githubusercontent.com/u/12345"
    assert data["github_id"] == 12345
    assert data["authenticated"] is True


# ------------------------------------------------------------------
# Task 8: Auth — POST /api/auth/logout (TC-5-AUTH-005)
# ------------------------------------------------------------------


@patch("ezagent.server.urllib.request.urlopen")
def test_auth_logout(mock_urlopen, client):
    """POST /api/auth/logout clears the session."""
    mock_urlopen.return_value = _mock_github_response()

    # Authenticate first
    client.post("/api/auth/github", json={"github_token": "gho_valid"})
    assert client.get("/api/auth/session").status_code == 200

    # Logout
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Session should be gone
    assert client.get("/api/auth/session").status_code == 401


def test_auth_logout_when_not_authenticated(client):
    """POST /api/auth/logout succeeds even when not authenticated."""
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

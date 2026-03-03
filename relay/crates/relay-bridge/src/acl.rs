//! Access Control interceptor for Room-level authorization.
//!
//! Checks room membership and power levels before allowing CRDT writes.
//! Reads Room Config from the `rooms` Column Family.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use relay_core::{RelayError, RelayStore, Result};

/// Room membership and power level configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomMembership {
    /// Set of entity IDs that are members.
    pub members: HashSet<String>,
    /// Per-entity power levels (missing entries default to 0).
    pub power_levels: HashMap<String, u32>,
    /// Minimum power level required to invite new members.
    #[serde(default = "default_invite_level")]
    pub invite_level: u32,
    /// Minimum power level required for admin operations (e.g. config writes).
    #[serde(default = "default_admin_level")]
    pub admin_level: u32,
}

fn default_invite_level() -> u32 {
    50
}

fn default_admin_level() -> u32 {
    100
}

/// Enforces Room-level access control.
pub struct AclInterceptor {
    store: Arc<RelayStore>,
}

impl AclInterceptor {
    /// Create a new interceptor backed by the given store.
    pub fn new(store: Arc<RelayStore>) -> Self {
        Self { store }
    }

    /// Load the membership config for a room from the `rooms` CF.
    ///
    /// Reads key `{room_id}/config` and deserialises it as JSON.
    /// Returns an empty membership if no config exists yet.
    pub fn load_membership(&self, room_id: &str) -> Result<RoomMembership> {
        let key = format!("{room_id}/config");
        match self.store.get_room(&key)? {
            Some(raw) => serde_json::from_slice(&raw)
                .map_err(|e| RelayError::Storage(format!("deserialize room config: {e}"))),
            None => Ok(RoomMembership {
                members: HashSet::new(),
                power_levels: HashMap::new(),
                invite_level: default_invite_level(),
                admin_level: default_admin_level(),
            }),
        }
    }

    /// Save a membership config for a room to the `rooms` CF.
    pub fn save_membership(&self, room_id: &str, membership: &RoomMembership) -> Result<()> {
        let key = format!("{room_id}/config");
        let raw = serde_json::to_vec(membership)
            .map_err(|e| RelayError::Storage(format!("serialize room config: {e}")))?;
        self.store.put_room(&key, &raw)
    }

    /// Check whether an entity is a room member.
    pub fn is_member(&self, room_id: &str, entity_id: &str) -> Result<bool> {
        let membership = self.load_membership(room_id)?;
        Ok(membership.members.contains(entity_id))
    }

    /// Get the power level for an entity in a room (defaults to 0).
    pub fn get_power_level(&self, room_id: &str, entity_id: &str) -> Result<u32> {
        let membership = self.load_membership(room_id)?;
        Ok(*membership.power_levels.get(entity_id).unwrap_or(&0))
    }

    /// Verify that the signer is a member of the room.
    ///
    /// Used for general CRDT update writes (Timeline, Content, etc.).
    pub fn check_update(&self, room_id: &str, signer: &str) -> Result<()> {
        if !self.is_member(room_id, signer)? {
            return Err(RelayError::NotAMember {
                entity_id: signer.to_string(),
                room_id: room_id.to_string(),
            });
        }
        Ok(())
    }

    /// Verify that the signer has admin-level power for config writes.
    pub fn check_config_write(&self, room_id: &str, signer: &str) -> Result<()> {
        self.check_update(room_id, signer)?;
        let membership = self.load_membership(room_id)?;
        let level = *membership.power_levels.get(signer).unwrap_or(&0);
        if level < membership.admin_level {
            return Err(RelayError::InsufficientPowerLevel {
                entity_id: signer.to_string(),
                required: membership.admin_level,
                actual: level,
            });
        }
        Ok(())
    }

    /// Verify that the signer can delete a message (must be author or admin).
    pub fn check_delete(&self, room_id: &str, signer: &str, author: &str) -> Result<()> {
        self.check_update(room_id, signer)?;
        if signer == author {
            return Ok(());
        }
        // Non-author must be admin.
        let membership = self.load_membership(room_id)?;
        let level = *membership.power_levels.get(signer).unwrap_or(&0);
        if level < membership.admin_level {
            return Err(RelayError::NotAuthor {
                entity_id: signer.to_string(),
                author: author.to_string(),
            });
        }
        Ok(())
    }

    /// Verify that the signer has sufficient power to invite.
    pub fn check_invite(&self, room_id: &str, signer: &str) -> Result<()> {
        self.check_update(room_id, signer)?;
        let membership = self.load_membership(room_id)?;
        let level = *membership.power_levels.get(signer).unwrap_or(&0);
        if level < membership.invite_level {
            return Err(RelayError::InsufficientPowerLevel {
                entity_id: signer.to_string(),
                required: membership.invite_level,
                actual: level,
            });
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_room(room_id: &str, members: &[(&str, u32)]) -> (AclInterceptor, tempfile::TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let acl = AclInterceptor::new(store);

        let mut member_set = HashSet::new();
        let mut power_levels = HashMap::new();
        for (eid, level) in members {
            member_set.insert(eid.to_string());
            power_levels.insert(eid.to_string(), *level);
        }

        let membership = RoomMembership {
            members: member_set,
            power_levels,
            invite_level: 50,
            admin_level: 100,
        };
        acl.save_membership(room_id, &membership).unwrap();
        (acl, dir)
    }

    /// TC-3-ACL-001: Non-member access is rejected.
    #[test]
    fn tc_3_acl_001_non_member_rejected() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        let err = acl
            .check_update("R-alpha", "@outsider:relay.com")
            .unwrap_err();
        assert!(
            matches!(err, RelayError::NotAMember { .. }),
            "expected NotAMember, got: {err}"
        );
    }

    /// TC-3-ACL-002: Member access succeeds.
    #[test]
    fn tc_3_acl_002_member_access() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        acl.check_update("R-alpha", "@alice:relay.com").unwrap();
        acl.check_update("R-alpha", "@bob:relay.com").unwrap();
    }

    /// TC-3-ACL-003: Admin can modify config; non-admin cannot.
    #[test]
    fn tc_3_acl_003_power_level_admin() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        acl.check_config_write("R-alpha", "@alice:relay.com")
            .unwrap();

        let err = acl
            .check_config_write("R-alpha", "@bob:relay.com")
            .unwrap_err();
        assert!(
            matches!(
                err,
                RelayError::InsufficientPowerLevel {
                    required: 100,
                    actual: 50,
                    ..
                }
            ),
            "expected InsufficientPowerLevel, got: {err}"
        );
    }

    /// TC-3-ACL-004: Author can delete own message; non-admin non-author cannot.
    #[test]
    fn tc_3_acl_004_delete_own_message() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 50), ("@bob:relay.com", 50)],
        );

        acl.check_delete("R-alpha", "@alice:relay.com", "@alice:relay.com")
            .unwrap();

        let err = acl
            .check_delete("R-alpha", "@bob:relay.com", "@alice:relay.com")
            .unwrap_err();
        assert!(
            matches!(err, RelayError::NotAuthor { .. }),
            "expected NotAuthor, got: {err}"
        );
    }

    /// TC-3-ACL-005: Invite permission based on invite_level.
    #[test]
    fn tc_3_acl_005_invite_permission() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        // invite_level = 50, so Bob (50) can invite.
        acl.check_invite("R-alpha", "@bob:relay.com").unwrap();

        // Setup a room with invite_level=100.
        let dir2 = tempfile::tempdir().unwrap();
        let store2 = Arc::new(RelayStore::open(dir2.path()).unwrap());
        let acl2 = AclInterceptor::new(store2);
        let membership = RoomMembership {
            members: HashSet::from(["@bob:relay.com".to_string()]),
            power_levels: HashMap::from([("@bob:relay.com".to_string(), 50)]),
            invite_level: 100,
            admin_level: 100,
        };
        acl2.save_membership("R-beta", &membership).unwrap();

        let err = acl2.check_invite("R-beta", "@bob:relay.com").unwrap_err();
        assert!(
            matches!(
                err,
                RelayError::InsufficientPowerLevel {
                    required: 100,
                    actual: 50,
                    ..
                }
            ),
            "expected InsufficientPowerLevel, got: {err}"
        );
    }

    /// TC-3-ACL-006: After leaving, entity loses access.
    #[test]
    fn tc_3_acl_006_leave_loses_access() {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let acl = AclInterceptor::new(store);

        let mut membership = RoomMembership {
            members: HashSet::from(["@bob:relay.com".to_string()]),
            power_levels: HashMap::from([("@bob:relay.com".to_string(), 50)]),
            invite_level: 50,
            admin_level: 100,
        };
        acl.save_membership("R-alpha", &membership).unwrap();
        acl.check_update("R-alpha", "@bob:relay.com").unwrap();

        membership.members.remove("@bob:relay.com");
        acl.save_membership("R-alpha", &membership).unwrap();

        let err = acl.check_update("R-alpha", "@bob:relay.com").unwrap_err();
        assert!(matches!(err, RelayError::NotAMember { .. }));
    }

    /// TC-3-ACL-007: Direct key pattern access is blocked by ACL check.
    #[test]
    fn tc_3_acl_007_bypass_detection() {
        let (acl, _dir) = setup_room("R-alpha", &[("@alice:relay.com", 100)]);

        let err = acl
            .check_update("R-alpha", "@attacker:relay.com")
            .unwrap_err();
        assert!(matches!(err, RelayError::NotAMember { .. }));
    }

    /// TC-3-ACL-008: ACL changes take effect on next check (no caching).
    #[test]
    fn tc_3_acl_008_acl_change_realtime() {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let acl = AclInterceptor::new(store);

        let mut membership = RoomMembership {
            members: HashSet::from(["@carol:relay.com".to_string()]),
            power_levels: HashMap::from([("@carol:relay.com".to_string(), 50)]),
            invite_level: 50,
            admin_level: 100,
        };
        acl.save_membership("R-alpha", &membership).unwrap();
        acl.check_update("R-alpha", "@carol:relay.com").unwrap();

        membership.members.remove("@carol:relay.com");
        acl.save_membership("R-alpha", &membership).unwrap();

        let err = acl.check_update("R-alpha", "@carol:relay.com").unwrap_err();
        assert!(matches!(err, RelayError::NotAMember { .. }));
    }

    /// Admin can delete anyone's message.
    #[test]
    fn admin_can_delete_any_message() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        acl.check_delete("R-alpha", "@alice:relay.com", "@bob:relay.com")
            .unwrap();
    }
}

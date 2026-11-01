# Role and permission API test notes

The role checks are enforced in the server procedures, after the session is read and the current `admin_users` record is reloaded. A client cannot bypass them by invoking tRPC directly.

Use two active accounts and their admin session cookies: one with `role=editor`, and one with `role=admin`.

| Direct procedure | Editor | Admin |
| --- | --- | --- |
| `admin.createPost` | allowed; always creates `draft` | allowed; always creates `draft` |
| `admin.editPost` | allowed for any post | allowed for any post |
| `admin.deletePost` | `FORBIDDEN` | allowed |
| `admin.submitPost` (`draft -> pending_review`) | allowed | allowed |
| `admin.publishPost` | `FORBIDDEN` | allowed only from `pending_review` |
| `admin.schedulePost` | `FORBIDDEN` | allowed only from `pending_review` |
| `admin.approvePost` | `FORBIDDEN` | allowed (`published` or `scheduled`) |
| `admin.rejectPost` | `FORBIDDEN` | allowed (`pending_review -> draft`) |
| `admin.unschedulePost` | `FORBIDDEN` | allowed for a future scheduled post |
| `admin.users.list/create/changeRole/revoke` | `FORBIDDEN` | allowed |
| `admin.analytics` | `FORBIDDEN` | allowed |

The automated `server/permissions.test.ts` covers the same editor/admin matrix and the lifecycle transition rules. Revoking an account clears its remember-device token and subsequent requests using an old session are rejected because the account is reloaded and checked as inactive.

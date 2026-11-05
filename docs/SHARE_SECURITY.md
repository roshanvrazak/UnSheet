# Share access and management

Apply all migrations, including `supabase/migrations/20261008000000_harden_share_access.sql`, before deploying the updated server routes. When a Supabase URL is configured, sharing requires the server-only `SUPABASE_SERVICE_ROLE_KEY`. Public/anonymous credentials cannot replace it. With no Supabase URL, sharing uses the local demo memory store.

Public database roles cannot directly select, insert, update, or delete share records. Viewing goes through `GET /api/share/[token]`; the route returns only the public response contract, never the management digest. The migration revokes table access from `PUBLIC`, `anon`, and `authenticated`, removes previous share policies, and leaves template policies unchanged.

Creation with an Authorization bearer token verifies it through Supabase `auth.getUser(token)` and binds the record to the verified user ID. Revocation of an owned link requires a verified bearer token for that owner. Invalid supplied credentials are rejected rather than treated as anonymous.

Anonymous creation returns an independent 128-bit `managementToken` once, with `Cache-Control: no-store`. Only its SHA-256 digest is stored on the server. Revoke via `POST /api/share/[token]/revoke` with `x-share-management-token`; the viewing token alone is insufficient. The Share modal saves management access in browser localStorage and restores revocation controls when reopened. Copy Link includes only the viewing URL. Clearing browser storage loses management access; secrets should not be included in URLs or logs.

Existing anonymous links have no management digest. They remain viewable subject to expiration/revocation, but cannot acquire management access from their viewing token. Revoke such links administratively if needed. Existing owned records can be managed through verified owner credentials.

## Verification

API regression tests cover absent/wrong management secrets, non-owner access, verified/forged bearer tokens, public response secrecy, zero-row updates, and database errors. UI tests cover restoration and secret-free copying.

Run real permission tests against a migrated **local** Supabase database:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/share_access.sql
```

This transaction inserts a fixture as service_role, checks token lookup and actual permission failures for public roles, and rolls back. It requires an administrative local connection capable of setting those roles. This test is separate from mocked API tests; run it before deployment.

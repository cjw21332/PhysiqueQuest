# Profile field encryption

Set `HEALTH_DATA_ENCRYPTION_KEY` to a secret containing exactly 32 random bytes
encoded as canonical base64. Keep the key outside Git and back it up separately
from MongoDB. Losing it makes encrypted fields unreadable. Do not change it on
an existing database without a migration.

Profile conditions, health notes, and emergency-contact name, phone and
relationship use AES-256-GCM with a fresh 96-bit nonce. Authentication binds each
value to its profile owner and field; conditions also bind their array position.
Public profile fields retain their existing schema. Empty strings remain empty.
Development without a key can read/write legacy plaintext; encrypted values
always require their matching key and fail closed with a generic error.

Normal Mongoose create/save/update and hydrated/lean reads encrypt or decrypt
transparently. Partial projections that include encrypted fields must also
include `userId`. Raw collection reads, including data export, must call
`decryptProfile`. Pipeline/bulk and multi-owner health updates are rejected;
the application uses owner-scoped individual writes.

To encrypt existing profiles, build the backend and run:

```sh
npm run build
node scripts/migrate-profile-encryption.mjs encrypt
```

The script reads the configured MongoDB URI and encryption key, logs counts only,
and can be rerun safely. It compares original field values before each update;
concurrent modifications cause a nonzero exit and should be retried. Existing
encrypted records are authenticated before being left unchanged.

The reversible `decrypt` mode restores plaintext with the current key. Run it
only during an approved maintenance window with application writes stopped.
For key rotation: back up the old key, stop writes, decrypt with the old key,
encrypt with the new key, deploy the new key, then resume writes. Never remove
the old key until the migration and backup recovery requirements are verified.
Old backups may contain plaintext until their retention window rolls off.

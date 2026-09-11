# Migrating to MStorage v2

The new [API](README.md) accepts a backend object and an optional value formatter.
Ordinary v1 data remains readable with the default JSON formatter and `ms_` prefix.
Reading never silently rewrites or migrates data.

## Update construction

```ts
// v1
new MStorage({ storage: 'session' });

// v2
new MStorage({ storage: sessionStorage });
```

Remove `encryptKeys`. V2 has no key hashing or SHA-224 runtime dependency.
`MStorageItem` remains a deprecated description of the v1 JSON tuple;
new formatters use `MStorageValue`.

Malformed tuples that v1 tolerated now throw. String TTL, NaN, Infinity and
expiration overflow are rejected instead of being implicitly coerced. JSON can
still read finite nonnegative legacy timestamps above `MAX_SAFE_INTEGER`, but
Encoding cannot represent them; migration reports an error and retains the original.

## Change format or namespace

The [migration example](migrate.ts) is application code, not part of the package.
Copy it into your application and change its type import to
`browser-storage-plus/m-storage`.

```ts
import { JsonValueFormatter, EncodingValueFormatter } from 'browser-storage-plus/m-storage';
import { migrate, snapshotPairs } from './migrate';

const pairs = snapshotPairs(localStorage, 'ms_', 'v2:');
const results = migrate(
    localStorage,
    localStorage,
    new JsonValueFormatter(),
    new EncodingValueFormatter(),
    pairs,
);
console.table(results);
```

The example snapshots physical names, decodes with the old formatter, and encodes
with the new one while preserving the exact absolute `expiresAt`. It does not
restart TTL, delete source records, or overwrite conflicting targets. The same
physical source and destination key on the same backend is rejected.

| Status           | Meaning                                                      |
| ---------------- | ------------------------------------------------------------ |
| `copied`         | Destination was absent and the write succeeded               |
| `already-copied` | Destination already contains the identical converted string  |
| `conflict`       | Destination contains different data; nothing was overwritten |
| `missing`        | Source no longer exists                                      |
| `error`          | Read, conversion, or write failed; the error is included     |

One failed record does not stop others. Repeat after fixing failures; inspect
conflicts manually. Source cleanup is a separate step after successful verification
and backup. Snapshot names before removing keys or otherwise changing the key set.

Pause old writers during migration. Storage has no compare-and-swap transaction,
so the conflict check cannot prevent another tab from writing between operations.
Old v1 tabs cannot read Encoding; coordinate client updates or use a separate
namespace/backend. Rolling back after a format change is not guaranteed.

## Previously hashed v1 keys

You need the original logical key names. V1 hashed the complete name `ms_` + key
using SHA-224. The hash cannot be reversed to recover unknown names.

The example accepts hashing as an **external migration-only function**. V2 does
not implement it, import a hashing library, or install one as a dependency.
For a Node migration tool, the built-in crypto module is sufficient:

```ts
import { createHash } from 'node:crypto';
import { JsonValueFormatter, EncodingValueFormatter } from 'browser-storage-plus/m-storage';
import { hashedPairs, migrate } from './migrate';

const sha224 = (name: string) => createHash('sha224').update(name).digest('hex');
const pairs = hashedPairs(['user', 'token'], sha224, 'v2:');
const results = migrate(
    sourceBackend, // an IStorage containing exported v1 data
    targetBackend,
    new JsonValueFormatter(),
    new EncodingValueFormatter(),
    pairs,
);
```

For migration inside an old browser application, supply its existing v1 hashing
function instead. Exporting the data and migrating externally also keeps the
new application free of hashing dependencies.

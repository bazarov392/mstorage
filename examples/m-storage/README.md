# MStorage v2: API and examples

MStorage stores strings with optional expiration. Native localStorage and
sessionStorage work directly; custom backends and formatters are supported.
For an existing v1 application, read the [migration guide](migration.md) first.

## Basic usage

```ts
import { MStorage } from 'browser-storage-plus/m-storage';

const storage = new MStorage({
    storage: localStorage,
    prefix: 'app:',
});

storage.set('user', 'Maut');
storage.set('token', 'xyz123', 3600); // TTL in seconds
storage.get('user'); // 'Maut'; null if missing or expired
storage.ttl('token'); // remaining seconds, rounded with Math.round
storage.remove(['user', 'token']);
```

The default prefix is `ms_`; `prefix: ''` disables it. A physical key is exactly
`prefix + key`, with no automatic separator. All key operations apply the same
prefix. Prefixes are fixed for an instance; changing them does not move data.
Choose nonoverlapping physical names yourself.

**`storage.clear()` clears the entire backend**, including other prefixes and
entries written outside MStorage. Use `remove` with known keys for selective deletion.

## Backend selection and SSR

```ts
const local = new MStorage(); // native localStorage, otherwise a private MemoryStorage
const session = new MStorage({ storage: sessionStorage });
```

When no backend is supplied, MStorage uses `window.localStorage`. If `window`
is absent or `window.localStorage` is `undefined`, it creates a fresh `MemoryStorage`.
All methods, formatting, and TTL work normally in this mode; successful `set`
returns `undefined`. Imports never access browser APIs. A throwing native getter
or backend operation still propagates its error instead of switching to memory.

### Built-in MemoryStorage

```ts
import { MStorage, MemoryStorage } from 'browser-storage-plus/m-storage';

const backend = new MemoryStorage();
const storage = new MStorage({ storage: backend });
storage.set('key', 'value');

// Explicitly share a backend between wrappers when needed.
const shared = new MStorage({ storage: backend });
shared.get('key'); // 'value'

// The backend also works directly through IStorage.
backend.setItem('raw', 'text');
backend.getItem('raw'); // 'text'
```

MemoryStorage has no persistence across reloads or processes. Each instance owns
its own data; automatic fallback instances do not share state. For SSR, create
request-local instances to keep requests isolated. Reuse a backend explicitly
only when shared state is intended. The backend itself does not implement TTL;
MStorage handles expiration and formatting.

`key(index)` returns `null` for negative, fractional, nonfinite, or out-of-range
indices. Its iteration order is not part of the public contract. `getItem`,
`setItem`, and `removeItem` use a Map; `key(index)` walks keys without allocating
an array of the entire storage.

### Custom backends

Implement the exported `IStorage` interface when your application needs another
synchronous backend. Native Storage and the built-in MemoryStorage both satisfy it.

All operations must be synchronous; writes must be immediately visible. Missing
values and out-of-range indices return `null`, empty strings remain values,
repeated removal is valid, and key order is unspecified. Events and indexed
property access are outside this contract. TypeScript permits async functions
in some `void` signatures, so `implements IStorage` alone cannot prove synchrony.
Promise-returning backends are unsupported.

## TTL

- Omitted, zero, or negative finite TTL means no expiration.
- Positive TTL becomes `Date.now() + ttl * 1000`, retaining representable fractions.
- New expiration timestamps must be within `0…Number.MAX_SAFE_INTEGER`.
- A record expires when `now >= expiresAt`, and is removed lazily by `get` or `ttl`.
- `ttl` returns rounded seconds, `Infinity` without expiration, or `null` when absent/expired.
- `ttl() === 0` can mean a live record with less than half a second remaining.
- Overwriting replaces expiration; writing without TTL cancels it.

Wrong argument/record types produce `TypeError`. Nonfinite TTL, invalid timestamps,
and numeric overflow produce `RangeError`. Broken JSON and Encoding syntax or
unknown Encoding versions produce `SyntaxError`. Malformed stored data is retained;
only a successfully decoded, expired record is removed. Formatting errors occur
before a write. Dependency errors propagate unchanged.

## Value formatters

JSON is the default and reads ordinary v1 tuples without rewriting them.
Encoding is an explicit alternative:

```ts
import {
    MStorage,
    JsonValueFormatter,
    EncodingValueFormatter,
} from 'browser-storage-plus/m-storage';

const json = new MStorage({ storage: localStorage, prefix: 'json:' });
const encoding = new MStorage({
    storage: sessionStorage,
    prefix: 'encoded:',
    formatter: new EncodingValueFormatter(),
});
```

| Formatter                | Stored representation                         | Timestamp range                                        |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------ |
| `JsonValueFormatter`     | `["hello",null]` or `["hello",1800000000000]` | Any finite nonnegative Number for legacy compatibility |
| `EncodingValueFormatter` | `ms2\|\|hello` or `ms2\|1800000000000\|hello` | `0…Number.MAX_SAFE_INTEGER`, including fractions       |

Encoding stores the value as the entire unescaped tail. Empty strings, separators,
newlines, Unicode and arbitrary UTF-16 code units survive round-trip. It is **not
encryption or integrity protection**. Its version is independent of package versions.
The time field is empty for `null`; `0` means the Unix epoch.

Encoding accepts `(0|[1-9][0-9]*)(\.[0-9]+)?`, up to 326 characters. Whitespace,
signs, exponent notation, leading integer zeros and incomplete decimals are rejected.
The encoder expands negative exponents into decimal notation; even `Number.MIN_VALUE`
round-trips. Decoder conversion uses JavaScript Number precision; positive underflow
to zero is rejected. The bounded header scan does not traverse a huge corrupt value.
JSON and Encoding normalize signed zero to `0`.

Instances sharing physical keys must use compatible formats. Changing the formatter
never migrates data or enables automatic fallback. `ttl` uses the formatter's full
`decode` method, so it may process/allocate the value too.

### Custom formatter

```ts
import type {
    IValueFormatter,
    MStorageValue,
} from 'browser-storage-plus/m-storage';

class TaggedJsonFormatter implements IValueFormatter
{
    private readonly json = new JsonValueFormatter();
    private readonly marker = 'app-v1:';

    encode(record: MStorageValue): string
    {
        return this.marker + this.json.encode(record);
    }

    decode(raw: string): MStorageValue
    {
        if(!raw.startsWith(this.marker))
            throw new SyntaxError('Unknown application format');
        return this.json.decode(raw.slice(this.marker.length));
    }
}

const custom = new MStorage({
    storage: localStorage,
    prefix: 'custom:',
    formatter: new TaggedJsonFormatter(),
});
```

Formatters synchronously convert `{ value: string, expiresAt: number | null }`.
Expiration is an **absolute timestamp in milliseconds**, not the original TTL.
They must preserve the string and timestamp, reject malformed input, avoid mutating
the input record, and never access clocks or backends. Methods retain `this`.
MStorage validates custom decoder results before applying expiration and verifies
that encoder output is a string.

Use JSON for compatibility and easy inspection. Compare actual workloads before
choosing Encoding for performance; see the [benchmark](../../benchmarks/m-storage/README.md).

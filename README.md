# Browser Storage Plus

Lightweight storage wrappers with TypeScript types. This development branch
implements the MStorage v2 API; the published v1 API differs.

## Installation

```bash
npm i browser-storage-plus
```

or

```bash
yarn add browser-storage-plus
```

## Modules and examples

| Module | Status | Guide |
| --- | --- | --- |
| MStorage | Available on this branch | [API and examples](examples/m-storage/README.md) · [Migration from v1](examples/m-storage/migration.md) |
| EncryptStorage | Planned | — |
| TableStorage | Planned | — |
| FileStorage | Planned | — |

MStorage provides string values, TTL, configurable key prefixes, custom
synchronous backends, built-in MemoryStorage, and JSON or Encoding formatters. It has no runtime dependencies.
Import it from `browser-storage-plus` or `browser-storage-plus/m-storage`.

`clear()` clears the entire backing storage, including unrelated keys.

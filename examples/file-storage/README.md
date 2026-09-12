# FileStorage

`FileStorageContext` provides asynchronous file operations inside a scoped storage
namespace. OPFS is the default adapter; memory and custom adapters are supported.
It has no DI container, Node.js dependencies or context registry.

```ts
import { FileStorageContext } from 'browser-storage-plus/file-storage';

const documents = await FileStorageContext.init('documents');
await documents.mkdir('/reports', { recursive: true });
await documents.writeFile('/reports/hello.txt', 'Hello');
await documents.appendFile('/reports/hello.txt', ' 🌍');

const bytes = await documents.readFile('/reports/hello.txt');
console.log(new TextDecoder().decode(bytes)); // Hello 🌍

const missing = await documents.readFileOrNull('/reports/missing.txt'); // null
const paths = await documents.readDir('/reports'); // ['/reports/hello.txt']
const entries = await documents.readDirEntries('/reports');
// [{ name: 'hello.txt', path: '/reports/hello.txt', kind: 'file' }]
```

## Choosing an adapter

```ts
import {
    FileStorageContext,
    MemoryFileStorageAdapter,
    OpfsFileStorageAdapter,
} from 'browser-storage-plus/file-storage';

// OPFS remains the default. Existing code needs no changes.
const persistent = await FileStorageContext.init('documents');
const explicitOpfs = await FileStorageContext.init('documents', {
    adapter: new OpfsFileStorageAdapter(),
});

// Reuse this adapter to share in-memory files across contexts.
const adapter = new MemoryFileStorageAdapter();
const first = await FileStorageContext.init('documents', { adapter });
const second = await FileStorageContext.init('documents', { adapter });
await first.writeFile('/draft', 'shared in memory');
console.log(new TextDecoder().decode(await second.readFile('/draft')));

// A separate adapter owns entirely separate data, even for the same scope.
const isolated = await FileStorageContext.init('documents', {
    adapter: new MemoryFileStorageAdapter(),
});
```

Memory implements the same file, directory, stream, copy and rename semantics as
OPFS. It retains data only for the lifetime of its adapter and open contexts;
reloading the page loses it. Writes accumulate privately and commit on `close`;
`abort` leaves existing content intact. Readers receive immutable byte snapshots.
There is no automatic locking between writers.

## Writing a custom adapter

Implement `IFileStorageAdapter.openScope(scope)` and return an
`IFileStorageBackend` bound to that scope. A backend has seven primitives; the
context supplies validation, data conversion, nullable reads, stream lifecycle wrappers,
recursive directory creation, copying and renaming. No native OPFS handles are
required.

| Primitive                          | Required behavior                                                                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readFile(path)`                   | Return the full-file `Blob` snapshot for explicit `context.readFile` calls. Streams and copies do not call this method.                                                                                                 |
| `createReadStream(path, options?)` | Return `Promise<ReadableStream<Uint8Array>>` for the requested inclusive byte range. Apply offsets within storage, without first loading the whole file. Honor backpressure and cancellation.                           |
| `createWriter(path, append)`       | Return `IFileStorageWriter` with asynchronous `write(bytes)`, `close()` and `abort(reason?)`. Create the file if missing; preserve old content until close. `append` starts after existing bytes. Never create parents. |
| `stat(path)`                       | Return the file/directory `Stats` union; `/` is always the scope directory.                                                                                                                                             |
| `mkdir(path)`                      | Create one directory with an existing parent. An existing directory is a successful no-op; an existing file is a type error.                                                                                            |
| `readDir(path)`                    | Return immediate `FileStorageEntry` children with single-segment names and context-absolute paths.                                                                                                                      |
| `remove(path, recursive)`          | Remove a file or empty directory; nonempty directories require recursive. Missing targets are errors.                                                                                                                   |

Backend stream opening is asynchronous; the context factory still returns a Web
Stream immediately. Opening failures reach `reader.read()`/`reader.closed`.
`start` defaults to 0, `end` defaults to EOF, and both bounds are inclusive. Clamp
an oversized end to EOF; a start at/past EOF produces an empty stream. A backend
owns range selection and cleanup on cancel, EOF or failure. Remote/custom storage
can use ranged I/O directly instead of building a full-file Blob first.

OPFS opens a native `File` handle snapshot and streams `file.slice(start, limit)`;
getting the File object does not itself load its bytes into a JavaScript array.
Memory streams a slice of its already stored immutable Blob. Neither adapter uses
its full-file `readFile` method for streaming. `cp` and `rename` read through backend
streams too.

All paths arriving from the context are normalized and absolute inside the scope.
Backends must keep scope roots isolated. `openScope` may return a fresh backend
object but must preserve existing data when reopening the same scope in the same
storage. An adapter can maintain shared resources on its own instance.

Use `DOMException` with `NotFoundError` for absent entries (including parents),
`TypeMismatchError` for wrong kinds, and `InvalidModificationError` for nonempty
directory removal. Other errors propagate; do not disguise permission failures as
absence. Context `readFileOrNull` and `exists` recognize only `NotFoundError`.
Writers must await their operations, copy mutable chunks if retaining them after
`write` resolves, and clean up when aborted. If `createWriter` fails after acquiring
a resource, it must release that resource before rejecting.

Custom adapters can also decorate existing ones. This complete example reports
committed writes while preserving the underlying storage behavior:

```ts
import type {
    IFileStorageAdapter,
    IFileStorageBackend,
} from 'browser-storage-plus/file-storage';

export class ObservedFileStorageAdapter implements IFileStorageAdapter {
    constructor(
        private readonly inner: IFileStorageAdapter,
        private readonly onCommit: (scope: string, path: string) => void,
    ) {}

    async openScope(scope: string): Promise<IFileStorageBackend> {
        const backend = await this.inner.openScope(scope);
        const onCommit = this.onCommit;

        return {
            readFile: (path) => backend.readFile(path),
            createReadStream: (path, options) => backend.createReadStream(path, options),
            stat: (path) => backend.stat(path),
            mkdir: (path) => backend.mkdir(path),
            readDir: (path) => backend.readDir(path),
            remove: (path, recursive) => backend.remove(path, recursive),

            async createWriter(path, append) {
                const writer = await backend.createWriter(path, append);

                return {
                    write: (bytes) => writer.write(bytes),
                    abort: (reason) => writer.abort(reason),
                    async close() {
                        await writer.close();
                        onCommit(scope, path);
                    },
                };
            },
        };
    }
}
```

Pass it with `FileStorageContext.init('docs', { adapter })`. In this example,
`onCommit` should not throw: the bytes have already been committed when it runs.

## Contexts and paths

Each `init(scope, options?)` returns a new instance. The same scope within the
same storage shares files; other scopes have separate roots. OPFS instances use
the same browser storage. Memory shares files only when the adapter instance is reused. Scopes are single names using ASCII letters,
digits, `_`, `-`, and `.`, starting with a letter, digit, `_`, or `-`.

With the default adapter, files live under `OPFS/browser-storage-plus/<scope>`. `/` denotes that scope's
root. `/a/file` and `a/file` are equivalent; `.` and `..` normalize within the
root. Escaping the root is an error. Backslashes, NUL and empty paths are invalid.
A trailing `/` requires a directory. No methods expose native handles.

```ts
const a = await FileStorageContext.init('documents');
const b = await FileStorageContext.init('documents');
const avatars = await FileStorageContext.init('avatars');
// a !== b; a and b see the same files. avatars has its own root.
```

Directories are created explicitly with `mkdir`. File writes require an existing
parent. The root cannot be removed, copied or renamed. Scope separation expresses
application ownership; scripts within the same origin can still access OPFS.

## Content and metadata

- Reads return `Uint8Array`. `readFileOrNull` returns `null` only for
  `NotFoundError`, including a missing parent. Empty files return an empty array.
  Invalid paths, directories instead of files and access errors still reject.
- Writes accept `string`, `Blob`/`File`, `ArrayBuffer` and `ArrayBufferView`.
  Strings use UTF-8. Views write their selected raw bytes, respecting offsets.
  Mutable input to `writeFile`/`appendFile` is copied before the first await.
  SharedArrayBuffer and views over shared memory are unsupported. Serialize
  objects explicitly, for example `JSON.stringify(value)`.
- `writeFile` replaces and truncates content; `appendFile` writes at the end.
- `readDir()` and `readDirEntries()` default to `/`, list immediate children in
  unspecified order, and return context-absolute paths.
- `stat` returns `{ kind: 'file', size, lastModified }` for files (bytes and Unix
  milliseconds). Directories return `{ kind: 'directory', size: null,
lastModified: null }`.

## Streams

These are Web Streams. The factories return immediately; I/O failures are delivered
through stream promises. Invalid paths and byte ranges throw synchronously.

```ts
await documents.createReadStream('/reports/hello.txt', { start: 0, end: 4 })
    .pipeTo(documents.createWriteStream('/reports/first-five-bytes.txt'));

const writer = documents.createWriteStream('/reports/export.txt').getWriter();
try {
    await writer.write('first chunk\n');
    await writer.write(new Uint8Array([65, 66, 67]));
    await writer.close();
} catch (error) {
    await writer.abort(error).catch(() => {});
    throw error;
} finally {
    writer.releaseLock();
}
```

`start` and `end` are inclusive byte offsets. The default range is the whole file;
a start at/past EOF yields an empty stream. Bounds must be nonnegative safe
integers with `end >= start`. Reads and copies respect backpressure.

`createWriteStream` replaces the whole file when closed. Each chunk accepts the
same data types as `writeFile`; do not mutate a chunk until its `write()` resolves.
Aborting cancels uncommitted changes. A newly created empty file may remain.
Use the stream's reader to inspect original read errors; consumers such as
`Response.arrayBuffer()` can translate them to their own errors.

## Copy, rename and removal

```ts
await documents.cp('/reports', '/backup', { recursive: true });
await documents.cp('/reports/hello.txt', '/backup/hello.txt', { overwrite: true });
await documents.rename('/backup', '/archive');
await documents.rm('/archive', { recursive: true });
await documents.rm('/missing', { force: true });
```

`cp` takes an exact destination path. Parents must exist. Directories require
`recursive: true`; existing destinations are rejected unless `overwrite: true`.
Overwrite replaces files or merges directories while keeping unrelated destination
children. File/directory type conflicts and overlapping directory trees are errors.

`rename` copies then deletes the source and requires an absent destination. It is
not atomic: a failed copy can leave a partial destination; a failed deletion can
leave both copies or a partly deleted source. The source is not deleted until
copying succeeds. Same-path rename is a no-op only for an existing entry.

`rm` requires `recursive: true` for directories. `force` ignores only absence.
`rmdir` removes empty directories only. `exists` returns false only for absence;
permission failures and invalid intermediate path types still reject.

## Availability and concurrency

Importing is safe in Node/SSR. The default OPFS adapter needs a browser in a secure
context (HTTPS or localhost); unavailable API rejects with `NotSupportedError`.
The memory adapter works without `navigator`, including Node environments with
standard `Blob`, Web Streams and `DOMException` globals.
Browser permission, quota and locking errors propagate. This module does not
request persistent storage or silently fall back to memory. Choose memory explicitly.

Multiple contexts, tabs and workers can use the same scope. Coordinate concurrent
writes, appends, copies and renames in the calling code. There are no internal
locks or transaction guarantees; checking a destination does not reserve it.
Closing a write commits it for subsequent operations, but browser storage can be
removed by the user or evicted according to browser policy.

## Validation

Run `bun run test`, `bun run typecheck`, `bun run test:browsers`, and
`bun run build && bun run test:package`. Browser tests exercise actual OPFS in
Chromium, Firefox and WebKit, including reopening content after page reload.
The memory adapter runs the same context contract in unit tests; adapter selection,
custom implementations, sharing, snapshots and SSR usage have additional checks.
WebKit uses an on-disk Playwright profile in `node_modules/.cache/vitest-webkit`;
suites use unique scopes and remove them after each test. See the
[Vitest persistent context option](https://vitest.dev/config/browser/playwright#persistentcontext).

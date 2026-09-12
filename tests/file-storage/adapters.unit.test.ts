import { describe, expect, it, vi } from 'vitest';
import {
    FileStorageContext,
    MemoryFileStorageAdapter,
} from '../../src/file-storage';
import type {
    IFileStorageAdapter,
    IFileStorageBackend,
} from '../../src/file-storage';
import { fileStorageContract } from './file-storage.contract';

describe('memory adapter context contract', () =>
{
    fileStorageContract(() =>
        FileStorageContext.init('test', {
            adapter: new MemoryFileStorageAdapter(),
        })
    );
});

it('shares scopes within a memory adapter, isolates adapters and works without navigator', async () =>
{
    vi.stubGlobal('navigator', undefined);
    const adapter = new MemoryFileStorageAdapter();
    const [a, b] = await Promise.all([
        FileStorageContext.init('shared', { adapter }),
        FileStorageContext.init('shared', { adapter }),
    ]);
    const otherScope = await FileStorageContext.init('other', { adapter });
    const otherAdapter = await FileStorageContext.init('shared', {
        adapter: new MemoryFileStorageAdapter(),
    });

    expect(a).not.toBe(b);
    await a.writeFile('/file', 'shared');

    expect(await b.readFile('/file')).toEqual(
        new TextEncoder().encode('shared'),
    );
    expect(await otherScope.readFileOrNull('/file')).toBeNull();
    expect(await otherAdapter.readFileOrNull('/file')).toBeNull();
});

it('accepts a structural custom adapter and sends only normalized scoped paths', async () =>
{
    const memory = new MemoryFileStorageAdapter();
    const calls: string[] = [];
    const adapter: IFileStorageAdapter = {
        async openScope(scope)
        {
            calls.push('scope:' + scope);
            const underlying = await memory.openScope(scope);
            const backend: IFileStorageBackend = {
                readFile: (path) => underlying.readFile(path),
                createReadStream: (path, options) =>
                    underlying.createReadStream(path, options),
                createWriter: (path, append) =>
                {
                    calls.push(path);
                    return underlying.createWriter(path, append);
                },
                stat: (path) => underlying.stat(path),
                mkdir: (path) => underlying.mkdir(path),
                readDir: (path) => underlying.readDir(path),
                remove: (path, recursive) => underlying.remove(path, recursive),
            };

            return backend;
        },
    };

    await expect(FileStorageContext.init('../invalid', { adapter })).rejects
        .toThrow(TypeError);
    expect(calls).toEqual([]);

    const context = await FileStorageContext.init('custom', { adapter });
    await context.writeFile('a/.././file', 'bytes');
    await expect(context.writeFile('../outside', '')).rejects.toThrow(
        TypeError,
    );

    expect(calls).toEqual(['scope:custom', '/file']);
    expect(await context.readFile('/file')).toEqual(
        new TextEncoder().encode('bytes'),
    );
});

it('preserves adapter initialization errors', async () =>
{
    const failure = new Error('storage unavailable');
    const adapter: IFileStorageAdapter = {
        openScope: async () =>
        {
            throw failure;
        },
    };

    await expect(FileStorageContext.init('test', { adapter })).rejects.toBe(
        failure,
    );
});

it('keeps memory snapshots immutable and commits writer content only on close', async () =>
{
    const backend = await new MemoryFileStorageAdapter().openScope('snapshots');
    const first = await backend.createWriter('/file', false);
    const bytes = new Uint8Array([1, 2]);

    await first.write(bytes);
    bytes.fill(9);
    expect((await backend.readFile('/file')).size).toBe(0);
    await first.close();

    const snapshot = await backend.readFile('/file');
    const append = await backend.createWriter('/file', true);
    await append.write(new Uint8Array([3]));
    await append.close();

    expect(new Uint8Array(await snapshot.arrayBuffer())).toEqual(
        new Uint8Array([1, 2]),
    );
    expect(
        new Uint8Array(await (await backend.readFile('/file')).arrayBuffer()),
    ).toEqual(new Uint8Array([1, 2, 3]));

    const aborted = await backend.createWriter('/file', false);
    await aborted.write(new Uint8Array([99]));
    await aborted.abort();
    expect((await backend.readFile('/file')).size).toBe(3);
    await expect(aborted.write(new Uint8Array())).rejects.toMatchObject({
        name: 'InvalidStateError',
    });
});

it('delegates ranges and copy/rename to backend streams without full-file reads', async () =>
{
    const underlying = await new MemoryFileStorageAdapter().openScope(
        'streaming',
    );
    const readFile = vi.fn().mockRejectedValue(
        new Error('Full reads are forbidden'),
    );
    const createReadStream = vi.fn<IFileStorageBackend['createReadStream']>((
        path,
        options,
    ) => underlying.createReadStream(path, options));
    const backend: IFileStorageBackend = {
        readFile,
        createReadStream,
        createWriter: (path, append) => underlying.createWriter(path, append),
        stat: (path) => underlying.stat(path),
        mkdir: (path) => underlying.mkdir(path),
        readDir: (path) => underlying.readDir(path),
        remove: (path, recursive) => underlying.remove(path, recursive),
    };
    const context = await FileStorageContext.init('streaming', {
        adapter: { openScope: async () => backend },
    });
    await context.writeFile('/source', new Uint8Array([0, 1, 2, 3, 4]));

    const reader = context.createReadStream('dir/../source', {
        start: 2,
        end: 3,
    }).getReader();
    expect((await reader.read()).value).toEqual(new Uint8Array([2, 3]));
    expect((await reader.read()).done).toBe(true);
    reader.releaseLock();

    expect(createReadStream).toHaveBeenCalledWith('/source', {
        start: 2,
        end: 3,
    });
    await context.cp('/source', '/copy');
    await context.rename('/copy', '/moved');

    expect(createReadStream).toHaveBeenCalledWith('/source');
    expect(createReadStream).toHaveBeenCalledWith('/copy');
    expect(
        new Uint8Array(
            await (await underlying.readFile('/moved')).arrayBuffer(),
        ),
    ).toEqual(new Uint8Array([0, 1, 2, 3, 4]));
    expect(readFile).not.toHaveBeenCalled();
});

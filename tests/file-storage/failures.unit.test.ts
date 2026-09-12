import { expect, it, vi } from 'vitest';
import { FileStorageContext } from '../../src/file-storage';

async function contextWithRoot(root: object)
{
    vi.stubGlobal('navigator', {
        storage: {
            getDirectory: async () => ({
                getDirectoryHandle: async () => ({
                    getDirectoryHandle: async () => root,
                }),
            }),
        },
    });
    return FileStorageContext.init('faults');
}

it('does not hide access failures in nullable reads, exists or forced removal', async () =>
{
    const failure = new DOMException('denied', 'NotAllowedError');
    const getFileHandle = vi.fn().mockRejectedValue(failure);
    const context = await contextWithRoot({ getFileHandle });
    await expect(context.readFileOrNull('/file')).rejects.toBe(failure);
    await expect(context.exists('/file')).rejects.toBe(failure);
    await expect(context.rm('/file', { force: true })).rejects.toBe(failure);
    expect(getFileHandle).toHaveBeenCalledTimes(3);
});

it('preserves append errors when abort also fails', async () =>
{
    const failure = new DOMException('quota', 'QuotaExceededError');
    const abort = vi.fn().mockRejectedValue(new Error('cleanup'));
    const native = {
        seek: vi.fn().mockRejectedValue(failure),
        abort,
        write: vi.fn(),
        close: vi.fn(),
    };
    const context = await contextWithRoot({
        getFileHandle: async () => ({
            getFile: async () => ({ size: 3 }),
            createWritable: async () => native,
        }),
    });
    await expect(context.appendFile('/file', 'data')).rejects.toBe(failure);
    expect(abort).toHaveBeenCalledWith(failure);
    expect(native.write).not.toHaveBeenCalled();
    expect(native.close).not.toHaveBeenCalled();
});

it('does not delete the source of a failed rename copy', async () =>
{
    const failure = new DOMException('quota', 'QuotaExceededError');
    const removeEntry = vi.fn();
    const source = {
        kind: 'file',
        name: 'source',
        getFile: async () => new File(['source'], 'source'),
    };
    const context = await contextWithRoot({
        getFileHandle: async (name: string, options?: { create?: boolean; }) =>
        {
            if(name === 'source')
                return source;
            if(!options?.create)
                throw new DOMException('missing', 'NotFoundError');
            return {
                createWritable: async () =>
                {
                    throw failure;
                },
            };
        },
        removeEntry,
    });
    await expect(context.rename('/source', '/target')).rejects.toBe(failure);
    expect(removeEntry).not.toHaveBeenCalled();
});

it('reports deletion failure after a successful rename copy and keeps the completed target', async () =>
{
    const failure = new DOMException('locked', 'NoModificationAllowedError');
    const output: Uint8Array[] = [];
    const closed = vi.fn();
    const writable = new WritableStream<Uint8Array>({
        write(chunk)
        {
            output.push(chunk);
        },
        close: closed,
    });
    const source = {
        kind: 'file',
        name: 'source',
        getFile: async () => new File(['source'], 'source'),
    };
    const removeEntry = vi.fn().mockRejectedValue(failure);
    const context = await contextWithRoot({
        getFileHandle: async (name: string, options?: { create?: boolean; }) =>
        {
            if(name === 'source')
                return source;
            if(!options?.create)
                throw new DOMException('missing', 'NotFoundError');
            return { createWritable: async () => writable.getWriter() };
        },
        removeEntry,
    });
    await expect(context.rename('/source', '/target')).rejects.toBe(failure);
    expect(closed).toHaveBeenCalledOnce();
    expect(new TextDecoder().decode(output[0])).toBe('source');
    expect(removeEntry).toHaveBeenCalledWith('source', { recursive: true });
});

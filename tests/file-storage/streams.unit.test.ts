import { expect, it, vi } from 'vitest';
import { readStream, writeStream } from '../../src/file-storage/utils/streams';

function deferred<T>()
{
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) =>
    {
        resolve = done;
    });
    return { promise, resolve };
}

function nativeWriter()
{
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const abort = vi.fn().mockResolvedValue(undefined);
    return { write, close, abort };
}

it('aborts a writable that opens after cancellation, without writing or closing it', async () =>
{
    const pending = deferred<FileSystemWritableFileStream>();
    const native = nativeWriter();
    const stream = writeStream(() => pending.promise);
    const aborted = stream.abort('stop');
    pending.resolve(native as unknown as FileSystemWritableFileStream);
    await aborted;
    expect(native.abort).toHaveBeenCalledWith('stop');
    expect(native.write).not.toHaveBeenCalled();
    expect(native.close).not.toHaveBeenCalled();
});

it.each(['write', 'close'] as const)(
    'preserves a %s failure even when abort fails',
    async (operation) =>
    {
        const native = nativeWriter();
        const failure = new DOMException('quota', 'QuotaExceededError');
        native[operation].mockRejectedValue(failure);
        native.abort.mockRejectedValue(new Error('cleanup'));
        const writer = writeStream(async () =>
            native as unknown as FileSystemWritableFileStream
        ).getWriter();
        const closed = expect(writer.closed).rejects.toBe(failure);
        await expect(operation === 'write' ? writer.write('x') : writer.close())
            .rejects.toBe(failure);
        await closed;
        expect(native.abort).toHaveBeenCalledWith(failure);
        writer.releaseLock();
    },
);

it('aborts on invalid chunks and keeps native command objects out of the API', async () =>
{
    const native = nativeWriter();
    const writer = writeStream(async () =>
        native as unknown as FileSystemWritableFileStream
    ).getWriter();
    const closed = expect(writer.closed).rejects.toThrow(TypeError);
    // @ts-expect-error Native writable command objects are not file content.
    await expect(writer.write({ type: 'truncate', size: 0 })).rejects.toThrow(
        TypeError,
    );
    await closed;
    expect(native.write).not.toHaveBeenCalled();
    expect(native.abort).toHaveBeenCalledOnce();
    writer.releaseLock();
});

it('cancels a late-opening reader and releases its lock', async () =>
{
    const pending = deferred<ReadableStream<Uint8Array>>();
    const cancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({ cancel });
    const stream = readStream(() => pending.promise);
    const canceled = stream.cancel('stop');
    pending.resolve(source);
    await canceled;
    expect(cancel).toHaveBeenCalledWith('stop');
    expect(source.locked).toBe(false);
});

it('respects read backpressure and cancels an in-flight read', async () =>
{
    let count = 0;
    const cancel = vi.fn();
    const source = new ReadableStream<Uint8Array>({
        pull(controller)
        {
            count++;
            controller.enqueue(new Uint8Array([count]));
        },
        cancel,
    }, { highWaterMark: 0 });
    const output = readStream(async () => source);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(count).toBe(1);
    const reader = output.getReader();
    expect((await reader.read()).value).toEqual(new Uint8Array([1]));
    await reader.cancel('stop');
    expect(cancel).toHaveBeenCalledWith('stop');
    expect(source.locked).toBe(false);
    reader.releaseLock();
});

it('releases the reader when the source fails', async () =>
{
    const failure = new Error('read failed');
    const source = new ReadableStream<Uint8Array>({
        pull()
        {
            throw failure;
        },
    });
    const reader = readStream(async () => source).getReader();
    const closed = expect(reader.closed).rejects.toBe(failure);
    await expect(reader.read()).rejects.toBe(failure);
    await closed;
    expect(source.locked).toBe(false);
    reader.releaseLock();
});

it('selects native blob ranges before streaming without reading full bytes', async () =>
{
    const { blobReadStream } = await import(
        '../../src/file-storage/utils/streams'
    );
    const blob = new Blob([new Uint8Array([0, 1, 2, 3, 4])]);
    const fullRead = vi.spyOn(blob, 'arrayBuffer').mockRejectedValue(
        new Error('full read'),
    );
    const fullStream = vi.spyOn(blob, 'stream').mockImplementation(() =>
    {
        throw new Error('full stream');
    });
    const slice = vi.spyOn(blob, 'slice');

    const reader = blobReadStream(blob, { start: 2, end: 3 }).getReader();
    expect((await reader.read()).value).toEqual(new Uint8Array([2, 3]));
    expect((await reader.read()).done).toBe(true);
    reader.releaseLock();

    expect(slice).toHaveBeenCalledWith(2, 4);
    expect(fullRead).not.toHaveBeenCalled();
    expect(fullStream).not.toHaveBeenCalled();
});

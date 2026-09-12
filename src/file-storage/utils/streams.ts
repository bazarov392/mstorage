import { toBytes } from './data';
import type {
    ReadStream,
    WriteStream,
    IFileStorageWriter,
    ReadStreamOptions,
} from '../interfaces';

export function validateRange(start: number, end?: number): void
{
    if(
        !Number.isSafeInteger(start) || start < 0
        || (end !== undefined && (!Number.isSafeInteger(end) || end < start))
    )
        throw new RangeError(
            'Stream bounds must be nonnegative safe integers with end >= start',
        );
}

export async function abortQuietly(
    writable: IFileStorageWriter,
    reason: unknown,
): Promise<void>
{
    try
    {
        await writable.abort(reason);
    }
    catch
    {
        /* Preserve the original operation error. */
    }
}

export function readStream(
    open: () => Promise<ReadStream>,
): ReadStream
{
    let opening: Promise<ReadableStreamDefaultReader<Uint8Array>>;
    let canceled = false;

    return new ReadableStream<Uint8Array>({
        start()
        {
            opening = open().then((stream) => stream.getReader());

            return opening.then(() => undefined);
        },

        async pull(controller)
        {
            const reader = await opening;

            try
            {
                const result = await reader.read();

                if(canceled)
                    return;

                if(result.done)
                {
                    reader.releaseLock();
                    controller.close();
                }
                else
                    controller.enqueue(result.value);
            }
            catch (error)
            {
                reader.releaseLock();
                throw error;
            }
        },

        async cancel(reason)
        {
            canceled = true;
            const reader = await opening;

            try
            {
                await reader.cancel(reason);
            }
            finally
            {
                reader.releaseLock();
            }
        },
    });
}

export function writeStream(
    open: () => Promise<IFileStorageWriter>,
): WriteStream
{
    let writable: IFileStorageWriter;

    return new WritableStream({
        async start()
        {
            writable = await open();
        },

        async write(chunk)
        {
            try
            {
                await writable.write(await toBytes(chunk));
            }
            catch (error)
            {
                await abortQuietly(writable, error);
                throw error;
            }
        },

        async close()
        {
            try
            {
                await writable.close();
            }
            catch (error)
            {
                await abortQuietly(writable, error);
                throw error;
            }
        },

        async abort(reason)
        {
            await writable.abort(reason);
        },
    });
}

export function blobReadStream(
    blob: Blob,
    options: ReadStreamOptions = {},
): ReadStream
{
    const start = options.start ?? 0;
    const end = options.end;
    validateRange(start, end);

    const limit = end === undefined || end >= blob.size ? blob.size : end + 1;

    return blob.slice(start, limit).stream();
}

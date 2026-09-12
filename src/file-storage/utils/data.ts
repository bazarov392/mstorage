import type { FileStorageWriteData } from '../interfaces';

/** Copies mutable input synchronously, before the caller's first await. */
export function toBytes(
    data: FileStorageWriteData,
): Uint8Array<ArrayBuffer> | Promise<Uint8Array<ArrayBuffer>>
{
    if(typeof data === 'string')
        return new TextEncoder().encode(data);

    if(data instanceof Blob)
        return data.arrayBuffer().then((buffer) => new Uint8Array(buffer));

    if(data instanceof ArrayBuffer)
        return new Uint8Array(data).slice();

    if(ArrayBuffer.isView(data) && data.buffer instanceof ArrayBuffer)
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            .slice();

    throw new TypeError(
        'Expected string, Blob, ArrayBuffer or a view over non-shared ArrayBuffer',
    );
}

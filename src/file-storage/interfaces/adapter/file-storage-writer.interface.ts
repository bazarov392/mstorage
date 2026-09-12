/** close commits pending writes; abort discards them. */
export interface IFileStorageWriter
{
    write(bytes: Uint8Array<ArrayBuffer>): Promise<void>;

    close(): Promise<void>;

    abort(reason?: unknown): Promise<void>;
}

import type { ReadStream } from '../context/read-stream.type';
import type { ReadStreamOptions } from '../context/read-stream-options.interface';
import type { FileStorageEntry } from '../context/file-storage-entry.interface';
import type { IFileStorageWriter } from './file-storage-writer.interface';
import type { Stats } from '../context/stats.type';

/**
 * Paths are absolute within one scope; parents must exist.
 * Missing entries must reject with NotFoundError, wrong kinds with TypeMismatchError.
 */
export interface IFileStorageBackend
{
    readFile(path: string): Promise<Blob>;

    /** Apply the range in storage without a full read; release resources on EOF/error/cancel. */
    createReadStream(
        path: string,
        options?: ReadStreamOptions,
    ): Promise<ReadStream>;

    createWriter(path: string, append: boolean): Promise<IFileStorageWriter>;

    stat(path: string): Promise<Stats>;

    mkdir(path: string): Promise<void>;

    readDir(path: string): Promise<FileStorageEntry[]>;

    remove(path: string, recursive: boolean): Promise<void>;
}

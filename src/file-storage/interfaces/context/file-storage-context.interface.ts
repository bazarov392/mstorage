import type {
    CopyOptions,
    FileStorageEntry,
    FileStorageWriteData,
    MakeDirectoryOptions,
    ReadStreamOptions,
    ReadStream,
    RmOptions,
    Stats,
    WriteStream,
} from './index';

export interface IFileStorageContext
{
    readFile(path: string): Promise<Uint8Array>;

    readFileOrNull(path: string): Promise<Uint8Array | null>;

    writeFile(path: string, data: FileStorageWriteData): Promise<void>;

    appendFile(path: string, data: FileStorageWriteData): Promise<void>;

    rm(path: string, options?: RmOptions): Promise<void>;

    rmdir(path: string): Promise<void>;

    exists(path: string): Promise<boolean>;

    readDir(path?: string): Promise<string[]>;

    readDirEntries(path?: string): Promise<FileStorageEntry[]>;

    mkdir(path: string, options?: MakeDirectoryOptions): Promise<void>;

    createReadStream(path: string, options?: ReadStreamOptions): ReadStream;

    createWriteStream(path: string): WriteStream;

    /** Copy then delete. Non-atomic; destination must not exist. */
    rename(oldPath: string, newPath: string): Promise<void>;

    stat(path: string): Promise<Stats>;

    cp(
        source: string,
        destination: string,
        options?: CopyOptions,
    ): Promise<void>;
}

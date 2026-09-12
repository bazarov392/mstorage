import { blobReadStream } from '../../utils/streams';
import type {
    IFileStorageAdapter,
    IFileStorageBackend,
    IFileStorageWriter,
    FileStorageEntry,
    Stats,
    ReadStream,
    ReadStreamOptions,
} from '../../interfaces';
import type { EntryHandle } from '../../interfaces/adapter/entry-handle.type';
import type { StoragePath } from '../../interfaces/context/storage-path.interface';
import {
    hasErrorName,
    normalizePath,
    requireFile,
    requireNonRoot,
    validateScope,
} from '../../utils/path';
import { abortQuietly } from '../../utils/streams';

export class OpfsFileStorageAdapter implements IFileStorageAdapter
{
    public async openScope(scope: string): Promise<IFileStorageBackend>
    {
        validateScope(scope);

        if(
            typeof navigator === 'undefined'
            || typeof navigator.storage?.getDirectory !== 'function'
        )
            throw new DOMException(
                'OPFS is unavailable; use a supported browser in a secure context',
                'NotSupportedError',
            );

        const root = await navigator.storage.getDirectory();
        const storage = await root.getDirectoryHandle('browser-storage-plus', {
            create: true,
        });
        const directory = await storage.getDirectoryHandle(scope, {
            create: true,
        });

        return new OpfsFileStorageBackend(directory);
    }
}

class OpfsFileStorageBackend implements IFileStorageBackend
{
    readonly #root: FileSystemDirectoryHandle;

    public constructor(root: FileSystemDirectoryHandle)
    {
        this.#root = root;
    }

    async #directory(
        segments: readonly string[],
        create = false,
    ): Promise<FileSystemDirectoryHandle>
    {
        let directory = this.#root;

        for (const segment of segments)
            directory = await directory.getDirectoryHandle(segment, { create });

        return directory;
    }

    async #parent(path: StoragePath): Promise<FileSystemDirectoryHandle>
    {
        return this.#directory(path.segments.slice(0, -1));
    }

    async #file(
        path: StoragePath,
        create = false,
    ): Promise<FileSystemFileHandle>
    {
        requireFile(path);

        const parent = await this.#parent(path);

        return parent.getFileHandle(path.segments[path.segments.length - 1], {
            create,
        });
    }

    async #entry(path: StoragePath): Promise<EntryHandle>
    {
        if(!path.segments.length)
            return this.#root;

        const parent = await this.#parent(path);
        const name = path.segments[path.segments.length - 1];

        if(path.directory)
            return parent.getDirectoryHandle(name);

        try
        {
            return await parent.getFileHandle(name);
        }
        catch (error)
        {
            if(!hasErrorName(error, 'TypeMismatchError'))
                throw error;

            return parent.getDirectoryHandle(name);
        }
    }

    public async readFile(path: string): Promise<Blob>
    {
        return (await this.#file(normalizePath(path))).getFile();
    }

    public async createReadStream(
        path: string,
        options: ReadStreamOptions = {},
    ): Promise<ReadStream>
    {
        const file = await (await this.#file(normalizePath(path))).getFile();

        return blobReadStream(file, options);
    }

    public async createWriter(
        path: string,
        append: boolean,
    ): Promise<IFileStorageWriter>
    {
        const file = await this.#file(normalizePath(path), true);
        const writable = await file.createWritable({
            keepExistingData: append,
        });

        try
        {
            if(append)
                await writable.seek((await file.getFile()).size);

            return writable;
        }
        catch (error)
        {
            await abortQuietly(writable, error);
            throw error;
        }
    }

    public async stat(path: string): Promise<Stats>
    {
        const entry = await this.#entry(normalizePath(path));

        if(entry.kind === 'directory')
            return { kind: 'directory', size: null, lastModified: null };

        const file = await entry.getFile();

        return {
            kind: 'file',
            size: file.size,
            lastModified: file.lastModified,
        };
    }

    public async mkdir(path: string): Promise<void>
    {
        const target = normalizePath(path);

        if(!target.segments.length)
            return;

        const parent = await this.#parent(target);
        await parent.getDirectoryHandle(
            target.segments[target.segments.length - 1],
            { create: true },
        );
    }

    public async readDir(path: string): Promise<FileStorageEntry[]>
    {
        const target = normalizePath(path);
        const directory = await this.#directory(target.segments);
        const entries: FileStorageEntry[] = [];

        for await (const [name, handle] of directory.entries())
            entries.push({
                name,
                path: (target.path === '/' ? '' : target.path) + '/' + name,
                kind: handle.kind,
            });

        return entries;
    }

    public async remove(path: string, recursive: boolean): Promise<void>
    {
        const target = normalizePath(path);
        requireNonRoot(target);

        const parent = await this.#parent(target);
        await parent.removeEntry(target.segments[target.segments.length - 1], {
            recursive,
        });
    }
}

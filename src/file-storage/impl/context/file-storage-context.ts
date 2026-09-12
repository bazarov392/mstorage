import { OpfsFileStorageAdapter } from '../adapter/opfs-file-storage-adapter';
import type { IFileStorageContext } from '../../interfaces';
import type {
    CopyOptions,
    FileStorageContextOptions,
    IFileStorageBackend,
    FileStorageEntry,
    FileStorageWriteData,
    MakeDirectoryOptions,
    ReadStreamOptions,
    ReadStream,
    RmOptions,
    Stats,
    WriteStream,
} from '../../interfaces';
import {
    hasErrorName,
    normalizePath,
    overlaps,
    requireFile,
    requireNonRoot,
    validateScope,
} from '../../utils/path';
import type { StoragePath } from '../../interfaces/context/storage-path.interface';
import { toBytes } from '../../utils/data';
import {
    abortQuietly,
    readStream,
    validateRange,
    writeStream,
} from '../../utils/streams';

const CONTEXT_TOKEN = Symbol('FileStorageContext');

export class FileStorageContext implements IFileStorageContext
{
    readonly #backend: IFileStorageBackend;

    private constructor(
        token: typeof CONTEXT_TOKEN,
        backend: IFileStorageBackend,
    )
    {
        if(token !== CONTEXT_TOKEN)
            throw new TypeError('Use FileStorageContext.init(scope)');

        this.#backend = backend;
    }

    public static async init(
        scope: string,
        options: FileStorageContextOptions = {},
    ): Promise<FileStorageContext>
    {
        validateScope(scope);

        const adapter = options.adapter ?? new OpfsFileStorageAdapter();
        const backend = await adapter.openScope(scope);

        return new FileStorageContext(CONTEXT_TOKEN, backend);
    }

    async #entry(path: StoragePath): Promise<Stats>
    {
        const entry = await this.#backend.stat(path.path);

        if(path.directory && entry.kind !== 'directory')
            throw new DOMException('Expected a directory', 'TypeMismatchError');

        return entry;
    }

    async #entryOrNull(path: StoragePath): Promise<Stats | null>
    {
        try
        {
            return await this.#entry(path);
        }
        catch (error)
        {
            if(hasErrorName(error, 'NotFoundError'))
                return null;

            throw error;
        }
    }

    public async readFile(path: string): Promise<Uint8Array>
    {
        const target = normalizePath(path);
        requireFile(target);

        const file = await this.#backend.readFile(target.path);

        return new Uint8Array(await file.arrayBuffer());
    }

    public async readFileOrNull(path: string): Promise<Uint8Array | null>
    {
        try
        {
            return await this.readFile(path);
        }
        catch (error)
        {
            if(hasErrorName(error, 'NotFoundError'))
                return null;

            throw error;
        }
    }

    async #write(
        path: string,
        data: FileStorageWriteData,
        append: boolean,
    ): Promise<void>
    {
        const target = normalizePath(path);
        requireFile(target);

        const bytes = await toBytes(data);

        const writable = await this.#backend.createWriter(target.path, append);

        try
        {
            await writable.write(bytes);
            await writable.close();
        }
        catch (error)
        {
            await abortQuietly(writable, error);
            throw error;
        }
    }

    public async writeFile(
        path: string,
        data: FileStorageWriteData,
    ): Promise<void>
    {
        await this.#write(path, data, false);
    }

    public async appendFile(
        path: string,
        data: FileStorageWriteData,
    ): Promise<void>
    {
        await this.#write(path, data, true);
    }

    public async exists(path: string): Promise<boolean>
    {
        return (await this.#entryOrNull(normalizePath(path))) !== null;
    }

    public async mkdir(
        path: string,
        options: MakeDirectoryOptions = {},
    ): Promise<void>
    {
        const target = normalizePath(path);

        if(options.recursive)
        {
            let directory = '';

            for (const segment of target.segments)
            {
                directory += '/' + segment;
                await this.#backend.mkdir(directory);
            }

            return;
        }

        if(await this.#entryOrNull(target))
            throw new DOMException(
                'Entry already exists',
                'InvalidModificationError',
            );

        await this.#backend.mkdir(target.path);
    }

    public async readDirEntries(path = '/'): Promise<FileStorageEntry[]>
    {
        const target = normalizePath(path);

        return this.#backend.readDir(target.path);
    }

    public async readDir(path = '/'): Promise<string[]>
    {
        return (await this.readDirEntries(path)).map((entry) => entry.path);
    }

    public async stat(path: string): Promise<Stats>
    {
        return this.#entry(normalizePath(path));
    }

    public async rm(path: string, options: RmOptions = {}): Promise<void>
    {
        const target = normalizePath(path);
        requireNonRoot(target);

        try
        {
            const entry = await this.#entry(target);

            if(entry.kind === 'directory' && !options.recursive)
                throw new DOMException(
                    'Removing a directory requires recursive: true',
                    'InvalidModificationError',
                );

            await this.#backend.remove(target.path, options.recursive ?? false);
        }
        catch (error)
        {
            if(options.force && hasErrorName(error, 'NotFoundError'))
                return;

            throw error;
        }
    }

    public async rmdir(path: string): Promise<void>
    {
        const target = normalizePath(path);
        requireNonRoot(target);

        const entry = await this.#entry(target);

        if(entry.kind !== 'directory')
            throw new DOMException('Expected a directory', 'TypeMismatchError');

        await this.#backend.remove(target.path, false);
    }

    public createReadStream(
        path: string,
        options: ReadStreamOptions = {},
    ): ReadStream
    {
        const target = normalizePath(path);
        requireFile(target);

        const start = options.start ?? 0;
        const end = options.end;
        validateRange(start, end);

        return readStream(() =>
            this.#backend.createReadStream(target.path, { start, end })
        );
    }

    public createWriteStream(path: string): WriteStream
    {
        const target = normalizePath(path);
        requireFile(target);

        return writeStream(() =>
            this.#backend.createWriter(target.path, false)
        );
    }

    async #copy(
        source: StoragePath,
        destination: StoragePath,
        options: CopyOptions,
    ): Promise<void>
    {
        const entry = await this.#entry(source);

        if(entry.kind === 'directory')
        {
            if(overlaps(source, destination))
                throw new DOMException(
                    'Cannot copy overlapping directories',
                    'InvalidModificationError',
                );

            if(!options.recursive)
                throw new DOMException(
                    'Copying a directory requires recursive: true',
                    'InvalidModificationError',
                );
        }
        else
            requireFile(destination);

        const existing = await this.#entryOrNull(destination);

        if(existing && existing.kind !== entry.kind)
            throw new DOMException(
                'Source and destination have different kinds',
                'TypeMismatchError',
            );

        if(existing && !options.overwrite)
            throw new DOMException(
                'Destination already exists',
                'InvalidModificationError',
            );

        if(entry.kind === 'file')
        {
            const input = await this.#backend.createReadStream(source.path);
            const output = writeStream(() =>
                this.#backend.createWriter(destination.path, false)
            );

            await input.pipeTo(output);
        }
        else
        {
            await this.#backend.mkdir(destination.path);

            for (const child of await this.#backend.readDir(source.path))
                await this.#copy(
                    normalizePath(source.path + '/' + child.name),
                    normalizePath(destination.path + '/' + child.name),
                    options,
                );
        }
    }

    public async cp(
        source: string,
        destination: string,
        options: CopyOptions = {},
    ): Promise<void>
    {
        const from = normalizePath(source);
        const to = normalizePath(destination);

        requireNonRoot(from);
        requireNonRoot(to);

        if(from.path === to.path)
            throw new DOMException(
                'Source and destination must differ',
                'InvalidModificationError',
            );

        await this.#copy(from, to, options);
    }

    public async rename(oldPath: string, newPath: string): Promise<void>
    {
        const from = normalizePath(oldPath);
        const to = normalizePath(newPath);

        requireNonRoot(from);
        requireNonRoot(to);

        if(from.path === to.path)
        {
            await this.#entry(from);
            await this.#entry(to);
            return;
        }

        await this.#copy(from, to, { recursive: true, overwrite: false });
        await this.rm(oldPath, { recursive: true });
    }
}

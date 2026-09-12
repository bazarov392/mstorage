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
import type { MemoryParent } from '../../interfaces/adapter/memory-parent.interface';
import type { MemoryEntry } from '../../interfaces/adapter/memory-entry.type';
import { normalizePath, requireNonRoot, validateScope } from '../../utils/path';

export class MemoryFileStorageAdapter implements IFileStorageAdapter
{
    readonly #scopes = new Map<string, MemoryEntry>();

    public async openScope(scope: string): Promise<IFileStorageBackend>
    {
        validateScope(scope);

        let root = this.#scopes.get(scope);

        if(!root)
        {
            root = { kind: 'directory', children: new Map() };
            this.#scopes.set(scope, root);
        }

        return new MemoryFileStorageBackend(root);
    }
}

class MemoryFileStorageBackend implements IFileStorageBackend
{
    readonly #root: MemoryEntry;

    public constructor(root: MemoryEntry)
    {
        this.#root = root;
    }

    #entry(path: string): MemoryEntry
    {
        let entry = this.#root;

        for (const segment of normalizePath(path).segments)
        {
            if(entry.kind !== 'directory')
                throw new DOMException(
                    'Expected a directory',
                    'TypeMismatchError',
                );

            const child = entry.children.get(segment);

            if(!child)
                throw new DOMException('Entry does not exist', 'NotFoundError');

            entry = child;
        }

        return entry;
    }

    #parent(path: string): MemoryParent
    {
        const target = normalizePath(path);
        requireNonRoot(target);

        const parent = this.#entry(
            '/' + target.segments.slice(0, -1).join('/'),
        );

        if(parent.kind !== 'directory')
            throw new DOMException('Expected a directory', 'TypeMismatchError');

        return {
            children: parent.children,
            name: target.segments[target.segments.length - 1],
        };
    }

    public async readFile(path: string): Promise<Blob>
    {
        const entry = this.#entry(path);

        if(entry.kind !== 'file')
            throw new DOMException('Expected a file', 'TypeMismatchError');

        return entry.data;
    }

    public async createReadStream(
        path: string,
        options: ReadStreamOptions = {},
    ): Promise<ReadStream>
    {
        const entry = this.#entry(path);

        if(entry.kind !== 'file')
            throw new DOMException('Expected a file', 'TypeMismatchError');

        const file = entry.data;

        return blobReadStream(file, options);
    }

    public async createWriter(
        path: string,
        append: boolean,
    ): Promise<IFileStorageWriter>
    {
        const { children, name } = this.#parent(path);
        let entry = children.get(name);

        if(entry?.kind === 'directory')
            throw new DOMException('Expected a file', 'TypeMismatchError');

        if(!entry)
        {
            entry = {
                kind: 'file',
                data: new Blob(),
                lastModified: Date.now(),
            };
            children.set(name, entry);
        }

        const file = entry;
        let chunks: BlobPart[] = append ? [file.data] : [];
        let finished = false;

        const assertOpen = () =>
        {
            if(finished)
                throw new DOMException('Writer is closed', 'InvalidStateError');
        };

        return {
            async write(bytes)
            {
                assertOpen();
                chunks.push(bytes.slice());
            },

            async close()
            {
                assertOpen();

                if(children.get(name) !== file)
                    throw new DOMException(
                        'File was removed or replaced',
                        'NotFoundError',
                    );

                file.data = new Blob(chunks);
                file.lastModified = Date.now();
                chunks = [];
                finished = true;
            },

            async abort()
            {
                chunks = [];
                finished = true;
            },
        };
    }

    public async stat(path: string): Promise<Stats>
    {
        const entry = this.#entry(path);

        if(entry.kind === 'directory')
            return { kind: 'directory', size: null, lastModified: null };

        return {
            kind: 'file',
            size: entry.data.size,
            lastModified: entry.lastModified,
        };
    }

    public async mkdir(path: string): Promise<void>
    {
        if(path === '/')
            return;

        const { children, name } = this.#parent(path);
        const existing = children.get(name);

        if(existing?.kind === 'file')
            throw new DOMException('Expected a directory', 'TypeMismatchError');

        if(!existing)
            children.set(name, { kind: 'directory', children: new Map() });
    }

    public async readDir(path: string): Promise<FileStorageEntry[]>
    {
        const entry = this.#entry(path);

        if(entry.kind !== 'directory')
            throw new DOMException('Expected a directory', 'TypeMismatchError');

        return Array.from(entry.children, ([name, child]) => ({
            name,
            path: (path === '/' ? '' : path) + '/' + name,
            kind: child.kind,
        }));
    }

    public async remove(path: string, recursive: boolean): Promise<void>
    {
        const { children, name } = this.#parent(path);
        const entry = children.get(name);

        if(!entry)
            throw new DOMException('Entry does not exist', 'NotFoundError');

        if(entry.kind === 'directory' && entry.children.size && !recursive)
            throw new DOMException(
                'Directory is not empty',
                'InvalidModificationError',
            );

        children.delete(name);
    }
}

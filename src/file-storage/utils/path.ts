import type { StoragePath } from '../interfaces/context/storage-path.interface';

export function validateScope(scope: string): void
{
    if(
        typeof scope !== 'string'
        || !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(scope)
        || /[^a-zA-Z0-9_.-]/.test(scope)
    )
        throw new TypeError(
            'Scope must be a nonempty directory name using letters, digits, _, - and .',
        );
}

export function normalizePath(path: string): StoragePath
{
    if(typeof path !== 'string' || !path || /[\\\0]/.test(path))
        throw new TypeError(
            'Path must be nonempty and cannot contain backslashes or NUL',
        );

    const segments: string[] = [];

    for (const segment of path.split('/'))
    {
        if(!segment || segment === '.')
            continue;

        if(segment === '..')
        {
            if(!segments.length)
                throw new TypeError('Path escapes the context root');

            segments.pop();
        }
        else
            segments.push(segment);
    }

    return {
        segments,
        path: '/' + segments.join('/'),
        directory: path.endsWith('/') || /(?:^|\/)\.{1,2}$/.test(path),
    };
}

export function requireFile(path: StoragePath): void
{
    if(!path.segments.length || path.directory)
        throw new DOMException('Expected a file path', 'TypeMismatchError');
}

export function requireNonRoot(path: StoragePath): void
{
    if(!path.segments.length)
        throw new DOMException(
            'Cannot remove, copy or rename the context root',
            'InvalidModificationError',
        );
}

export function overlaps(a: StoragePath, b: StoragePath): boolean
{
    return a.segments.slice(0, Math.min(a.segments.length, b.segments.length))
        .every((segment, index) => segment === b.segments[index]);
}

export function hasErrorName(error: unknown, name: string): boolean
{
    return error instanceof DOMException && error.name === name;
}

export interface FileStorageEntry
{
    readonly name: string;
    readonly path: string;
    readonly kind: 'file' | 'directory';
}

import type { IFileStorageBackend } from './file-storage-backend.interface';

export interface IFileStorageAdapter
{
    openScope(scope: string): Promise<IFileStorageBackend>;
}

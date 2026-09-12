import type { IFileStorageAdapter } from '../adapter/file-storage-adapter.interface';

export interface FileStorageContextOptions
{
    adapter?: IFileStorageAdapter;
}

export interface CreateMStorageOptions
{
    storage?: 'local' | 'session';
    encryptKeys?: boolean;
    // encryptValues?: boolean;
}

export type MStorageItem = [string, number | null];
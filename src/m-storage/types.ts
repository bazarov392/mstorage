import type { IStorage } from './storage.interface';
import type { IValueFormatter } from './value-formatter.interface';

export interface CreateMStorageOptions
{
    storage?: IStorage;
    formatter?: IValueFormatter;
    /** Immutable physical key prefix. Defaults to ms_; empty string is allowed. */
    prefix?: string;
}

/** @deprecated Legacy JSON tuple. Use MStorageValue for formatter contracts. */
export type MStorageItem = [string, number | null];

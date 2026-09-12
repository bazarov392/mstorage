import type { IStorage } from './storage.interface';
import type { IValueFormatter } from './value-formatter.interface';

export interface CreateMStorageOptions
{
    /** Defaults to window.localStorage, or a fresh MemoryStorage if unavailable.
     * Native getter/operation errors propagate instead of switching backends.
     */
    storage?: IStorage;
    formatter?: IValueFormatter;
    /** Immutable physical key prefix. Defaults to ms_; empty string is allowed. */
    prefix?: string;
}

/** @deprecated Legacy JSON tuple. Use MStorageValue for formatter contracts. */
export type MStorageItem = [string, number | null];

import type { IMStorage } from './mstorage.interface';
import type { IStorage } from './storage.interface';
import type {
    IValueFormatter,
    MStorageValue,
} from './value-formatter.interface';
import type { CreateMStorageOptions } from './types';
import { JsonValueFormatter } from './formatters/json-value-formatter';
import { MemoryStorage } from './memory-storage';
import { validateRecord } from './validation';

export class MStorage implements IMStorage
{
    private readonly storage: IStorage;
    private readonly formatter: IValueFormatter;
    private readonly prefix: string;

    constructor(options: CreateMStorageOptions = {})
    {
        this.storage = options.storage
            ?? (typeof window === 'undefined' ? undefined : window.localStorage)
            ?? new MemoryStorage();

        this.formatter = options.formatter ?? new JsonValueFormatter();
        this.prefix = options.prefix ?? 'ms_';
    }

    public get(key: string): string | null
    {
        return this.read(this.prefix + key)?.record.value ?? null;
    }

    public set(key: string, value: string, ttl: number = 0): undefined
    {
        if(typeof ttl !== 'number')
            throw new TypeError('TTL must be a number');

        if(!Number.isFinite(ttl))
            throw new RangeError('TTL must be finite');

        const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
        const record = { value, expiresAt };
        validateRecord(record);

        if(expiresAt !== null && expiresAt > Number.MAX_SAFE_INTEGER)
            throw new RangeError('Expiration exceeds MAX_SAFE_INTEGER');

        const raw = this.formatter.encode(record);
        if(typeof raw !== 'string')
            throw new TypeError('Formatter encode must return a string');

        this.storage.setItem(this.prefix + key, raw);
    }

    public remove(key: string | string[]): void
    {
        for (const name of Array.isArray(key) ? key : [key])
            this.storage.removeItem(this.prefix + name);
    }

    public clear(): void
    {
        this.storage.clear();
    }

    public ttl(key: string): number | null
    {
        const result = this.read(this.prefix + key);
        if(!result)
            return null;

        return result.record.expiresAt === null
            ? Infinity
            : Math.round((result.record.expiresAt - result.now) / 1000);
    }

    private read(key: string): { record: MStorageValue; now: number; } | null
    {
        const raw = this.storage.getItem(key);
        if(raw === null)
            return null;

        const record = this.formatter.decode(raw);
        validateRecord(record);

        const now = Date.now();
        if(record.expiresAt !== null && now >= record.expiresAt)
        {
            this.storage.removeItem(key);
            return null;
        }

        return { record, now };
    }
}

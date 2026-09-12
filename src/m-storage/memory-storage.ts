import type { IStorage } from './storage.interface';

/** Synchronous, instance-local storage. Data lives only as long as this instance. */
export class MemoryStorage implements IStorage
{
    private readonly items = new Map<string, string>();

    public get length(): number
    {
        return this.items.size;
    }

    /** Returns null for negative, fractional, nonfinite, or out-of-range indices. */
    public key(index: number): string | null
    {
        if(!Number.isInteger(index) || index < 0 || index >= this.items.size)
            return null;

        let current = 0;
        for (const key of this.items.keys())
        {
            if(current++ === index)
                return key;
        }

        return null;
    }

    public getItem(key: string): string | null
    {
        return this.items.get(key) ?? null;
    }

    public setItem(key: string, value: string): void
    {
        this.items.set(key, value);
    }

    public removeItem(key: string): void
    {
        this.items.delete(key);
    }

    public clear(): void
    {
        this.items.clear();
    }
}

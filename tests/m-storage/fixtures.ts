import { MStorage, JsonValueFormatter } from '../../src/m-storage';
import type {
    CreateMStorageOptions,
    IStorage,
    IValueFormatter,
    MStorageValue,
} from '../../src/m-storage';

// Logic-only substitute. Browser tests must use native Storage instead.
export class MemoryStorage implements IStorage
{
    private readonly items = new Map<string, string>();

    get length()
    {
        return this.items.size;
    }

    clear()
    {
        this.items.clear();
    }

    getItem(key: string)
    {
        return this.items.get(key) ?? null;
    }

    key(index: number): string | null
    {
        return [...this.items.keys()][index] ?? null;
    }

    removeItem(key: string)
    {
        this.items.delete(key);
    }

    setItem(key: string, value: string)
    {
        this.items.set(key, value);
    }
}

export function mStorageFixture(options: CreateMStorageOptions)
{
    const backend = options.storage!;
    backend.clear();
    return {
        subject: new MStorage(options),
        dispose: () => backend.clear(),
    };
}

/** An application-owned format; used to exercise the same formatter contract. */
export class CustomFormatter implements IValueFormatter
{
    readonly marker = 'custom:';
    readonly json = new JsonValueFormatter();
    encode(record: MStorageValue): string
    {
        return this.marker + this.json.encode(record);
    }
    decode(raw: string): MStorageValue
    {
        if(!raw.startsWith(this.marker))
            throw new SyntaxError('Invalid custom prefix');
        return this.json.decode(raw.slice(this.marker.length));
    }
}

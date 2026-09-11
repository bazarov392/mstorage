import { MStorage } from '../../src/m-storage';
import type { CreateMStorageOptions } from '../../src/m-storage';

// Logic-only substitute. Browser tests must use native Storage instead.
export class MemoryStorage implements Storage {
    private readonly items = new Map<string, string>();

    get length() {
        return this.items.size;
    }

    clear() {
        this.items.clear();
    }

    getItem(key: string) {
        return this.items.get(key) ?? null;
    }

    key(index: number) {
        return [...this.items.keys()][index] ?? null;
    }

    removeItem(key: string) {
        this.items.delete(key);
    }

    setItem(key: string, value: string) {
        this.items.set(key, value);
    }
}

export function mStorageFixture(options: CreateMStorageOptions) {
    const backend =
        options.storage === 'session' ? sessionStorage : localStorage;
    backend.clear();
    return {
        subject: new MStorage(options),
        dispose: () => backend.clear(),
    };
}

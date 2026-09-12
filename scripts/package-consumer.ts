// Compiled against dist by test:package, not against source declarations.
import {
    MStorage,
    MemoryStorage,
    JsonValueFormatter,
    EncodingValueFormatter,
} from 'browser-storage-plus/m-storage';
import type {
    IStorage,
    IValueFormatter,
    MStorageValue,
    IMStorage,
    CreateMStorageOptions,
} from 'browser-storage-plus/m-storage';
import type { MStorageValue as RootValue } from 'browser-storage-plus';

const backend: IStorage = localStorage;
const formatter: IValueFormatter = {
    encode(record: MStorageValue): string
    {
        return new JsonValueFormatter().encode(record);
    },
    decode(raw: string): RootValue
    {
        return new JsonValueFormatter().decode(raw);
    },
};
const options: CreateMStorageOptions = {
    storage: backend,
    formatter,
    prefix: '',
};
const storage: IMStorage = new MStorage(options);
storage.set('key', 'value');
new MStorage({
    storage: sessionStorage,
    formatter: new EncodingValueFormatter(),
});
// @ts-expect-error v1 selector is not available in published v2 declarations.
new MStorage({ storage: 'local' });
// @ts-expect-error v1 hashing option is not available in published v2 declarations.
new MStorage({ encryptKeys: true });

const memory: IStorage = new MemoryStorage();
new MStorage({ storage: memory }).set('key', 'value');

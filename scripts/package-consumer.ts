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

import { FileStorageContext } from 'browser-storage-plus/file-storage';
import type {
    IFileStorageContext,
    Stats,
    ReadStream,
    WriteStream,
    ReadStreamOptions,
} from 'browser-storage-plus/file-storage';
import { FileStorageContext as RootFileStorageContext } from 'browser-storage-plus';

async function fileStorageConsumer(): Promise<void>
{
    const context: IFileStorageContext = await FileStorageContext.init(
        'consumer',
    );
    const options: ReadStreamOptions = { start: 0, end: 1 };
    const source: ReadStream = context.createReadStream('/input', options);
    const destination: WriteStream = context.createWriteStream('/output');
    await source.pipeTo(destination);
    await context.writeFile('/data', new Uint8Array([1, 2]));
    const nullable: Uint8Array | null = await context.readFileOrNull(
        '/missing',
    );
    const stats: Stats = await context.stat('/');
    await RootFileStorageContext.init('same-api');
    // @ts-expect-error Contexts require the static factory.
    new FileStorageContext();
    void nullable;
    void stats;
}
void fileStorageConsumer;

import {
    MemoryFileStorageAdapter,
    OpfsFileStorageAdapter,
} from 'browser-storage-plus/file-storage';
import type {
    IFileStorageAdapter,
    IFileStorageBackend,
    IFileStorageWriter,
    FileStorageContextOptions,
} from 'browser-storage-plus/file-storage';

const memoryAdapter: IFileStorageAdapter = new MemoryFileStorageAdapter();
const opfsAdapter: IFileStorageAdapter = new OpfsFileStorageAdapter();
const customAdapter: IFileStorageAdapter = {
    async openScope(scope: string): Promise<IFileStorageBackend>
    {
        return memoryAdapter.openScope(scope);
    },
};
const fileOptions: FileStorageContextOptions = { adapter: customAdapter };
void FileStorageContext.init('custom', fileOptions);
void opfsAdapter;

async function customBackendConsumer(
    backend: IFileStorageBackend,
): Promise<void>
{
    const writer: IFileStorageWriter = await backend.createWriter(
        '/file',
        false,
    );
    await writer.write(new Uint8Array([1, 2]));
    await writer.close();
    const ranged: ReadStream = await backend.createReadStream('/file', {
        start: 1,
        end: 1,
    });
    await ranged.cancel();
    const blob: Blob = await backend.readFile('/file');
    void blob;
}
void customBackendConsumer;

import { FileStorageContext } from '../../src/file-storage';
import type {
    IFileStorageContext,
    ReadStream,
    Stats,
    WriteStream,
} from '../../src/file-storage';

async function contract(): Promise<void>
{
    const ctx: IFileStorageContext = await FileStorageContext.init('types');
    const bytes: Uint8Array = await ctx.readFile('/a');
    const nullable: Uint8Array | null = await ctx.readFileOrNull('/a');
    const read: ReadStream = ctx.createReadStream('/a', { start: 1, end: 3 });
    const write: WriteStream = ctx.createWriteStream('/b');
    await read.pipeTo(write);
    await ctx.writeFile('/a', new DataView(new ArrayBuffer(4)));
    await ctx.appendFile('/a', new Blob(['hello']));
    const stat: Stats = await ctx.stat('/a');
    if(stat.kind === 'file')
    {
        const size: number = stat.size;
        void size;
    }
    else
    {
        const size: null = stat.size;
        void size;
    }
    // @ts-expect-error Objects must be serialized explicitly.
    await ctx.writeFile('/a', { hello: true });
    // @ts-expect-error Node copy options are not part of the browser API.
    await ctx.cp('/a', '/b', { dereference: true });
    // @ts-expect-error The constructor is private.
    new FileStorageContext();
    void bytes;
    void nullable;
}
void contract;

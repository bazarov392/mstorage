import { MStorage, JsonValueFormatter } from '../../src/m-storage';
import type {
    CreateMStorageOptions,
    IValueFormatter,
    MStorageValue,
} from '../../src/m-storage';

export { MemoryStorage } from '../../src/m-storage';

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

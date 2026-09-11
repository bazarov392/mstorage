import type {
    IValueFormatter,
    MStorageValue,
} from '../value-formatter.interface';
import { validateRecord } from '../validation';

export class JsonValueFormatter implements IValueFormatter
{
    public encode(record: MStorageValue): string
    {
        validateRecord(record);

        return JSON.stringify([record.value, record.expiresAt]);
    }

    public decode(raw: string): MStorageValue
    {
        const tuple: unknown = JSON.parse(raw);
        if(!Array.isArray(tuple) || tuple.length !== 2)
            throw new TypeError('Expected a two-element JSON tuple');

        const record = { value: tuple[0], expiresAt: tuple[1] };
        validateRecord(record);

        return record;
    }
}

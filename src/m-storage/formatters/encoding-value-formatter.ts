import type {
    IValueFormatter,
    MStorageValue,
} from '../value-formatter.interface';
import { validateRecord } from '../validation';

// 5e-324 needs "0." + 323 zeros + "5"; large numbers need at most 16 digits.
const MAX_TIME_LENGTH = 326;
const PREFIX = 'ms2|';

function decimal(time: number): string
{
    const text = String(time);
    const [coefficient, exponent] = text.split('e-');
    if(exponent === undefined)
        return text;

    return '0.' + '0'.repeat(Number(exponent) - 1)
        + coefficient.replace('.', '');
}

export class EncodingValueFormatter implements IValueFormatter
{
    public encode(record: MStorageValue): string
    {
        validateRecord(record);

        if(
            record.expiresAt !== null
            && record.expiresAt > Number.MAX_SAFE_INTEGER
        )
            throw new RangeError('Encoding timestamp exceeds MAX_SAFE_INTEGER');

        return PREFIX
            + (record.expiresAt === null ? '' : decimal(record.expiresAt))
            + '|' + record.value;
    }

    public decode(raw: string): MStorageValue
    {
        if(!raw.startsWith(PREFIX))
            throw new SyntaxError('Unsupported Encoding header');

        // Bound the search, even when a corrupt record has a huge value.
        let end = PREFIX.length;
        const limit = Math.min(raw.length - 1, PREFIX.length + MAX_TIME_LENGTH);

        while (end <= limit && raw[end] !== '|')
            end++;

        if(end > limit)
            throw new SyntaxError('Missing or oversized Encoding timestamp');

        const field = raw.slice(PREFIX.length, end);
        if(field !== '' && !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(field))
            throw new SyntaxError('Invalid decimal timestamp');

        const expiresAt = field === '' ? null : Number(field);
        if(
            expiresAt !== null && (expiresAt > Number.MAX_SAFE_INTEGER
                // Number conversion can round an out-of-range fraction down.
                || (field.startsWith('9007199254740991.')
                    && /[1-9]/.test(field.slice(17)))
                || (expiresAt === 0 && /[1-9]/.test(field)))
        )
            throw new RangeError('Encoding timestamp is out of range');

        const record = { value: raw.slice(end + 1), expiresAt };
        validateRecord(record);

        return record;
    }
}

import type { MStorageValue } from './value-formatter.interface';

export function validateRecord(record: unknown): asserts record is MStorageValue
{
    if(
        typeof record !== 'object' || record === null
        || !('value' in record) || typeof record.value !== 'string'
        || !('expiresAt' in record)
    )
        throw new TypeError('Expected a string value and expiresAt');

    const time = record.expiresAt;
    if(time !== null && typeof time !== 'number')
        throw new TypeError('expiresAt must be a number or null');

    if(time !== null && (!Number.isFinite(time) || time < 0))
        throw new RangeError('expiresAt must be finite and nonnegative');
}

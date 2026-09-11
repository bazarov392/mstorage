export interface MStorageValue
{
    value: string;
    /** Absolute finite nonnegative milliseconds, or null for no expiration. */
    expiresAt: number | null;
}

/** Synchronous, lossless conversion without clocks, storage, or input mutation.
 * Invalid data must throw. Methods retain the formatter instance as `this`.
 */
export interface IValueFormatter
{
    encode(record: MStorageValue): string;
    decode(raw: string): MStorageValue;
}

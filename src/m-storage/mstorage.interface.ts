/** Synchronous string storage with lazy expiration and configurable formatting. */
export interface IMStorage
{
    /** Returns null when absent or expired.
     * Only valid expired records are removed. Decode/backend errors propagate.
     */
    get(key: string): string | null;
    /** TTL is seconds. Omitted/nonpositive finite TTL means no expiration.
     * Nonfinite TTL or expiration outside 0..MAX_SAFE_INTEGER throws RangeError.
     * Formatting completes before writing. Returns undefined on success.
     * Without window/localStorage, a private MemoryStorage backend is used.
     */
    set(key: string, value: string, ttl?: number): undefined;
    /** Removes physical prefixed keys without decoding. Backend errors propagate. */
    remove(key: string | string[]): void;
    /** Clears the ENTIRE backend, including other prefixes and unrelated keys. */
    clear(): void;
    /** Rounded remaining seconds, Infinity without expiry, null if absent/expired.
     * Zero can mean still alive for less than half a second. Expired data is removed.
     * Decode/backend errors propagate.
     */
    ttl(key: string): number | null;
}

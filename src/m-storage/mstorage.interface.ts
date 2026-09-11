/**
 * Development contract for MStorage. All operations are synchronous.
 * This describes the existing behavior; v2 changes must update the contract
 * and the corresponding compatibility tests explicitly.
 */
export interface IMStorage
{
    /**
     * Returns the stored string, or null when missing, expired, or without window.
     * Expired entries are removed on read. Invalid JSON errors propagate.
     */
    get(key: string): string | null;

    /**
     * Stores or replaces a string and its expiration.
     * TTL is in seconds; omitted or non-positive TTL means no expiration.
     * Returns undefined in the browser and null without window.
     * Serialization and native storage errors propagate.
     */
    set(key: string, value: string, ttl?: number): undefined | null;

    /** Removes one or multiple keys. Missing keys and calls without window are no-ops. */
    remove(key: string | string[]): void;

    /**
     * Clears the entire selected native storage, including unrelated keys.
     * Without window, this is a no-op. Namespace isolation is not part of v1.
     */
    clear(): void;

    /**
     * Returns remaining TTL rounded to seconds, Infinity for no expiration,
     * or null when missing, expired, or without window.
     * Expired entries are removed. Invalid JSON errors propagate.
     */
    ttl(key: string): number | null;
}

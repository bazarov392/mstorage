/** Synchronous storage. Writes are immediately visible and errors propagate.
 * TypeScript permits async void methods here, but such backends are unsupported.
 */
export interface IStorage
{
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}

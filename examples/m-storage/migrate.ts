// Repository example. In an application import from 'browser-storage-plus/m-storage'.
import type { IStorage, IValueFormatter } from '../../src/m-storage';

export interface MigrationResult
{
    sourceKey: string;
    targetKey: string;
    status: 'copied' | 'already-copied' | 'conflict' | 'missing' | 'error';
    error?: unknown;
}

/** Snapshot names before changing any backend. No deletion or overwrite of conflicts.
 * Run while writers are paused: synchronous Storage has no compare-and-swap transaction.
 */
export function migrate(
    source: IStorage,
    target: IStorage,
    oldFormatter: IValueFormatter,
    newFormatter: IValueFormatter,
    pairs: ReadonlyArray<readonly [string, string]>,
): MigrationResult[]
{
    return pairs.map(([sourceKey, targetKey]) =>
    {
        try
        {
            if(source === target && sourceKey === targetKey)
                throw new Error(
                    'Use a separate destination namespace or backend',
                );

            const original = source.getItem(sourceKey);
            if(original === null)
                return { sourceKey, targetKey, status: 'missing' };

            const converted = newFormatter.encode(
                oldFormatter.decode(original),
            );
            const existing = target.getItem(targetKey);
            if(existing !== null)
                return {
                    sourceKey,
                    targetKey,
                    status: existing === converted
                        ? 'already-copied'
                        : 'conflict',
                };

            target.setItem(targetKey, converted);

            return { sourceKey, targetKey, status: 'copied' };
        }
        catch (error)
        {
            return { sourceKey, targetKey, status: 'error', error };
        }
    });
}

export function snapshotPairs(
    storage: IStorage,
    fromPrefix: string,
    toPrefix: string,
): Array<[string, string]>
{
    const pairs: Array<[string, string]> = [];

    for (let i = 0; i < storage.length; i++)
    {
        const key = storage.key(i);
        if(key !== null && key.startsWith(fromPrefix))
            pairs.push([key, toPrefix + key.slice(fromPrefix.length)]);
    }

    return pairs;
}

/** Supply SHA-224 from the old application or an external migration tool.
 * V1 hashes the complete physical name "ms_" + original key.
 */
export function hashedPairs(
    keys: readonly string[],
    sha224: (text: string) => string,
    toPrefix: string,
): Array<[string, string]>
{
    return keys.map((key) => [sha224('ms_' + key), toPrefix + key]);
}

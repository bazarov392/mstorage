import { fileStorageContract } from './file-storage.contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    FileStorageContext,
    OpfsFileStorageAdapter,
} from '../../src/file-storage';

let context: FileStorageContext;
let scope: string;
const scopes: string[] = [];
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

beforeEach(async () =>
{
    scope = 'test-' + crypto.randomUUID();
    scopes.push(scope);
    context = await FileStorageContext.init(scope);
});
afterEach(async () =>
{
    const root = await navigator.storage.getDirectory();
    const storage = await root.getDirectoryHandle('browser-storage-plus');
    for (const name of scopes.splice(0))
        await storage.removeEntry(name, { recursive: true });
});

it('allows concurrent init, isolates scopes and uses the documented OPFS layout', async () =>
{
    const [first, second] = await Promise.all([
        FileStorageContext.init(scope),
        FileStorageContext.init(scope),
    ]);
    expect(first).not.toBe(second);
    await first.writeFile('/value', 'shared');
    expect(decode(await second.readFile('value'))).toBe('shared');
    const otherScope = scope + '-other';
    scopes.push(otherScope);
    const other = await FileStorageContext.init(otherScope);
    expect(await other.readFileOrNull('/value')).toBeNull();
    const root = await navigator.storage.getDirectory();
    const storage = await root.getDirectoryHandle('browser-storage-plus');
    const folder = await storage.getDirectoryHandle(scope);
    expect(await (await (await folder.getFileHandle('value')).getFile()).text())
        .toBe('shared');
    expect(
        decode(await (await FileStorageContext.init(scope)).readFile('/value')),
    ).toBe('shared');
});

describe('shared context contract', () =>
{
    fileStorageContract(async () => context);
});

it('reopens saved content from a new context after page reload', async () =>
{
    const frame = document.createElement('iframe');
    const load = () =>
        new Promise<void>((resolve) =>
            frame.addEventListener('load', () => resolve(), { once: true })
        );
    try
    {
        const loaded = load();
        frame.src = '/tests/file-storage/fixtures/reload.html';
        document.body.append(frame);
        await loaded;
        const open = () =>
            (frame.contentWindow as Window & {
                openFileStorage(scope: string): Promise<FileStorageContext>;
            }).openFileStorage(scope);
        await (await open()).writeFile('/persistent', 'survives reload');
        const reloaded = load();
        frame.contentWindow!.location.reload();
        await reloaded;
        expect(decode(await (await open()).readFile('/persistent'))).toBe(
            'survives reload',
        );
    }
    finally
    {
        frame.remove();
    }
});

it('explicit OPFS adapters share the default persistent scope', async () =>
{
    const explicit = await FileStorageContext.init(scope, {
        adapter: new OpfsFileStorageAdapter(),
    });
    await explicit.writeFile('/explicit', 'shared with default');

    expect(decode(await context.readFile('/explicit'))).toBe(
        'shared with default',
    );
});

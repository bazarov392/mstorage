import { beforeEach, expect, it } from 'vitest';
import type { FileStorageContext } from '../../src/file-storage';

/** The same behavior must hold for each adapter, including actual OPFS. */
export function fileStorageContract(
    create: () => Promise<FileStorageContext>,
): void
{
    let context: FileStorageContext;
    const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

    beforeEach(async () =>
    {
        context = await create();
    });

    it('reads bytes and null without masking empty files or directory/type errors', async () =>
    {
        expect(await context.readFileOrNull('/missing')).toBeNull();
        expect(await context.readFileOrNull('/missing/file')).toBeNull();
        await context.writeFile('/empty', '');
        expect(await context.readFileOrNull('/empty')).toEqual(
            new Uint8Array(),
        );
        await expect(context.readFile('/missing')).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await context.mkdir('/dir');
        for (const path of ['/dir', '/', '/empty/', '/empty/child'])
            await expect(context.readFileOrNull(path)).rejects.toMatchObject({
                name: 'TypeMismatchError',
            });
        await expect(context.readFileOrNull('../outside')).rejects.toThrow(
            TypeError,
        );
    });

    it('writes UTF-8 and selected bytes, snapshots buffers and truncates replacements', async () =>
    {
        await context.mkdir('/nested');
        await context.writeFile('nested/./файл', 'Привет 🌍');
        expect(decode(await context.readFile('/nested//файл'))).toBe(
            'Привет 🌍',
        );
        const data = new Uint8Array([9, 1, 2, 8]);
        const writing = context.writeFile('/nested/файл', data.subarray(1, 3));
        data.fill(0);
        await writing;
        expect(await context.readFile('/nested/файл')).toEqual(
            new Uint8Array([1, 2]),
        );
        await context.writeFile('/blob', new File(['blob'], 'source'));
        await context.appendFile(
            '/blob',
            new DataView(new Uint8Array([33]).buffer),
        );
        expect(decode(await context.readFile('/blob'))).toBe('blob!');
        await context.appendFile('/new', 'first');
        await context.appendFile('/new', 'second');
        expect(decode(await context.readFile('/new'))).toBe('firstsecond');
        await expect(context.writeFile('/missing/file', '')).rejects
            .toMatchObject({
                name: 'NotFoundError',
            });
        expect(await context.exists('/missing')).toBe(false);
    });

    it('creates directories explicitly and returns entries and reusable absolute paths', async () =>
    {
        await context.mkdir('/a/b', { recursive: true });
        await context.mkdir('/a/b', { recursive: true });
        await expect(context.mkdir('/a')).rejects.toMatchObject({
            name: 'InvalidModificationError',
        });
        await expect(context.mkdir('/absent/child')).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await context.mkdir('/', { recursive: true });
        await expect(context.mkdir('/')).rejects.toMatchObject({
            name: 'InvalidModificationError',
        });
        await context.writeFile('/a/file', 'hello');
        expect((await context.readDir('/a')).sort()).toEqual([
            '/a/b',
            '/a/file',
        ]);
        expect(
            (await context.readDirEntries('/a')).sort((a, b) =>
                a.name.localeCompare(b.name)
            ),
        ).toEqual([
            { name: 'b', path: '/a/b', kind: 'directory' },
            { name: 'file', path: '/a/file', kind: 'file' },
        ]);
        expect(await context.readDir()).toEqual(['/a']);
        expect(await context.readDirEntries()).toEqual([{
            name: 'a',
            path: '/a',
            kind: 'directory',
        }]);
        expect(await context.readDir('/a/b')).toEqual([]);
        expect(await context.stat('/a/file')).toMatchObject({
            kind: 'file',
            size: 5,
            lastModified: expect.any(Number),
        });
        expect(await context.stat('/')).toEqual({
            kind: 'directory',
            size: null,
            lastModified: null,
        });
        await expect(context.readDir('/a/file')).rejects.toMatchObject({
            name: 'TypeMismatchError',
        });
        await expect(context.exists('/a/file/child')).rejects.toMatchObject({
            name: 'TypeMismatchError',
        });
    });

    it('distinguishes file removal, empty directories, recursion and force', async () =>
    {
        await context.mkdir('/a/empty', { recursive: true });
        await context.writeFile('/a/file', 'hello');
        await expect(context.rmdir('/a')).rejects.toMatchObject({
            name: 'InvalidModificationError',
        });
        await expect(context.rmdir('/a/file')).rejects.toMatchObject({
            name: 'TypeMismatchError',
        });
        await expect(context.rm('/a', { force: true })).rejects.toMatchObject({
            name: 'InvalidModificationError',
        });
        await context.rmdir('/a/empty');
        await context.rm('/a/file');
        await expect(context.rm('/a/file')).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await context.rm('/a/file', { force: true });
        await context.writeFile('/a/file', 'again');
        await context.rm('/a', { recursive: true });
        expect(await context.exists('/a')).toBe(false);
        await expect(context.rmdir('/missing')).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await context.rm('/missing/child', { recursive: true, force: true });
    });

    it('protects the root and rejects escapes before filesystem access', async () =>
    {
        const operations = [
            () => context.readFile('../escape'),
            () => context.readFileOrNull('../escape'),
            () => context.writeFile('../escape', ''),
            () => context.appendFile('../escape', ''),
            () => context.mkdir('../escape'),
            () => context.exists('../escape'),
            () => context.readDir('../escape'),
            () => context.readDirEntries('../escape'),
            () => context.rm('../escape', { force: true }),
            () => context.rmdir('../escape'),
            () => context.stat('../escape'),
            () => context.cp('/a', '../escape'),
            () => context.rename('../escape', '/a'),
        ];
        for (const operation of operations)
            await expect(operation()).rejects.toThrow(TypeError);
        expect(() => context.createReadStream('../escape')).toThrow(TypeError);
        expect(() => context.createWriteStream('../escape')).toThrow(TypeError);
        for (
            const operation of [
                () => context.rm('/', { recursive: true, force: true }),
                () => context.rmdir('/'),
                () => context.cp('/', '/a', { recursive: true }),
                () => context.cp('/a', '/'),
                () => context.rename('/', '/a'),
                () => context.rename('/a', '/'),
            ]
        )
            await expect(operation()).rejects.toMatchObject({
                name: 'InvalidModificationError',
            });
        expect(await context.exists('/')).toBe(true);
    });

    async function consume(
        stream: ReadableStream<Uint8Array>,
    ): Promise<Uint8Array>
    {
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    it('streams inclusive byte ranges, EOF and multiple chunks through Web Streams', async () =>
    {
        await context.writeFile('/source', new Uint8Array([0, 1, 2, 3, 4]));
        const stream = context.createReadStream('/source', {
            start: 1,
            end: 3,
        });
        expect(stream).toBeInstanceOf(ReadableStream);
        expect(await consume(stream)).toEqual(new Uint8Array([1, 2, 3]));
        expect(await consume(context.createReadStream('/source', { start: 5 })))
            .toEqual(new Uint8Array());
        expect(
            await consume(
                context.createReadStream('/source', {
                    end: Number.MAX_SAFE_INTEGER,
                }),
            ),
        ).toEqual(new Uint8Array([0, 1, 2, 3, 4]));
        expect(await consume(context.createReadStream('/source', { end: 0 })))
            .toEqual(new Uint8Array([0]));
        const output = context.createWriteStream('/output');
        expect(output).toBeInstanceOf(WritableStream);
        const writer = output.getWriter();
        await writer.write('abc');
        await writer.write(new Blob(['def']));
        await writer.write(new Uint8Array([33]));
        await writer.close();
        writer.releaseLock();
        expect(decode(await context.readFile('/output'))).toBe('abcdef!');
        await context.createReadStream('/source').pipeTo(
            context.createWriteStream('/output'),
        );
        expect(await context.readFile('/output')).toEqual(
            await context.readFile('/source'),
        );
    });

    it('reports invalid ranges synchronously and missing paths through stream errors', async () =>
    {
        for (
            const options of [{ start: -1 }, { start: 1.2 }, { end: NaN }, {
                end: Infinity,
            }, { start: 3, end: 2 }]
        )
            expect(() => context.createReadStream('/source', options)).toThrow(
                RangeError,
            );
        const reader = context.createReadStream('/missing').getReader();
        const readerClosed = expect(reader.closed).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await expect(reader.read()).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await readerClosed;
        reader.releaseLock();
        const writer = context.createWriteStream('/missing/file').getWriter();
        const closed = expect(writer.closed).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await expect(writer.write('data')).rejects.toMatchObject({
            name: 'NotFoundError',
        });
        await closed;
        writer.releaseLock();
    });

    it('cancels and aborts during opening without committing data or retaining resources', async () =>
    {
        await context.writeFile('/file', 'original');
        await context.createReadStream('/file').cancel('stop');
        await context.createWriteStream('/file').abort('stop');
        expect(decode(await context.readFile('/file'))).toBe('original');
        const writer = context.createWriteStream('/file').getWriter();
        await writer.write('replacement');
        await writer.abort('stop');
        writer.releaseLock();
        expect(decode(await context.readFile('/file'))).toBe('original');
        await context.writeFile('/file', 'released');
        expect(decode(await context.readFile('/file'))).toBe('released');
    });

    it('copies exact paths, merges directories only with overwrite, and preserves unrelated children', async () =>
    {
        await context.mkdir('/source/empty', { recursive: true });
        await context.writeFile('/source/file', 'source');
        await expect(context.cp('/source', '/copy')).rejects.toMatchObject({
            name: 'InvalidModificationError',
        });
        await context.cp('/source', '/copy', { recursive: true });
        expect(await context.readDir('/copy/empty')).toEqual([]);
        expect(decode(await context.readFile('/copy/file'))).toBe('source');
        await context.writeFile('/copy/extra', 'keep');
        await context.writeFile('/source/file', 'updated');
        await expect(context.cp('/source', '/copy', { recursive: true }))
            .rejects
            .toMatchObject({ name: 'InvalidModificationError' });
        await context.cp('/source', '/copy', {
            recursive: true,
            overwrite: true,
        });
        expect(decode(await context.readFile('/copy/file'))).toBe('updated');
        expect(decode(await context.readFile('/copy/extra'))).toBe('keep');
        await expect(context.cp('/source/file', '/copy', { overwrite: true }))
            .rejects.toMatchObject({ name: 'TypeMismatchError' });
        await expect(context.cp('/source/file', '/missing/file')).rejects
            .toMatchObject({ name: 'NotFoundError' });
        await context.cp('/source/file', '/single');
        await expect(context.cp('/source/file', '/single')).rejects
            .toMatchObject({
                name: 'InvalidModificationError',
            });
        await context.cp('/source/file', '/single', { overwrite: true });
    });

    it('renames trees via copy/delete, rejects overlap and existing targets, and checks same-path existence', async () =>
    {
        await context.mkdir('/a/empty', { recursive: true });
        await context.writeFile('/a/file', 'content');
        for (
            const [from, to] of [['/a', '/a/child'], ['/a/empty', '/a'], [
                '/a',
                '/a',
            ]]
        )
            await expect(
                context.cp(from, to, { recursive: true, overwrite: true }),
            )
                .rejects.toMatchObject({ name: 'InvalidModificationError' });
        await expect(context.rename('/a', '/a/child')).rejects.toMatchObject({
            name: 'InvalidModificationError',
        });
        await context.cp('/a', '/ab', { recursive: true });
        await expect(context.rename('/a', '/ab')).rejects.toMatchObject({
            name: 'InvalidModificationError',
        });
        await context.rename('/a/file', '/a/./file');
        await expect(context.rename('/missing', '/missing')).rejects
            .toMatchObject({
                name: 'NotFoundError',
            });
        await context.rename('/a', '/moved');
        expect(await context.exists('/a')).toBe(false);
        expect(decode(await context.readFile('/moved/file'))).toBe('content');
        expect(await context.readDir('/moved/empty')).toEqual([]);
        await context.rename('/moved/file', '/renamed');
        expect(await context.exists('/moved/file')).toBe(false);
        expect(decode(await context.readFile('/renamed'))).toBe('content');
    });
}

import assert from 'node:assert/strict';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { access, readdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Test the published entry points under Node without window or browser globals.
for (const [subpath, entry] of Object.entries(pkg.exports))
{
    await access(new URL(`../${entry.types}`, import.meta.url));
    const specifier = pkg.name + (subpath === '.' ? '' : subpath.slice(1));
    const cjs = require(specifier);
    const esm = await import(specifier);
    assert.equal(esm.default, cjs);

    if(subpath === '.' || subpath === './m-storage')
    {
        for (
            const name of [
                'MStorage',
                'MemoryStorage',
                'JsonValueFormatter',
                'EncodingValueFormatter',
            ]
        )
        {
            assert.equal(typeof cjs[name], 'function');
            assert.equal(esm[name], cjs[name]);
        }
        assert.equal(esm.MStorage, cjs.MStorage);
        const storage = new cjs.MStorage();
        assert.equal(storage.get('missing'), null);
        assert.equal(storage.set('ssr', 'value'), undefined);
        assert.equal(storage.get('ssr'), 'value');
        assert.equal(new cjs.MStorage().get('ssr'), null);
    }
}

const files = await readdir(new URL('../dist', import.meta.url), {
    recursive: true,
});
assert.ok(
    !files.some((file) => /test|spec|vitest|benchmark|examples/.test(file)),
);
console.log('Package entry points, declarations, and SSR import passed.');

const consumer = ts.createProgram([
    fileURLToPath(new URL('./package-consumer.ts', import.meta.url)),
], {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: [],
});
const diagnostics = ts.getPreEmitDiagnostics(consumer);
assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
    }),
);
console.log('Published consumer types passed.');

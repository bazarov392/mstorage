import assert from 'node:assert/strict';
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
        assert.equal(typeof cjs.MStorage, 'function');
        assert.equal(esm.MStorage, cjs.MStorage);
        assert.equal(new cjs.MStorage().get('missing'), null);
    }
}

const files = await readdir(new URL('../dist', import.meta.url), {
    recursive: true,
});
assert.ok(!files.some((file) => /test|spec|vitest/.test(file)));
console.log('Package entry points, declarations, and SSR import passed.');

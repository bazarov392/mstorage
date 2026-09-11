import { writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';
import * as api from '../../dist/m-storage/index.js';
import { run } from './workload.mjs';

const results = {
    measuredAt: new Date().toISOString(),
    node: { version: process.version, ...run(api) },
};
const temporary = await mkdtemp(join(tmpdir(), 'mstorage-benchmark-'));
try
{
    if(!process.argv.includes('--node-only'))
    {
        const bundle = join(temporary, 'benchmark.mjs');
        execFileSync('bun', [
            'build',
            'benchmarks/m-storage/browser-entry.mjs',
            '--target=browser',
            '--format=esm',
            '--outfile=' + bundle,
        ]);
        const dataUrl = 'data:text/javascript;base64,'
            + (await readFile(bundle)).toString('base64');
        for (
            const [name, launcher] of Object.entries({
                chromium,
                firefox,
                webkit,
            })
        )
        {
            const browser = await launcher.launch();
            try
            {
                const page = await browser.newPage();
                await page.route(
                    'http://mstorage.test/**',
                    (route) =>
                        route.fulfill({
                            contentType: 'text/html',
                            body:
                                '<!doctype html><title>MStorage benchmark</title>',
                        }),
                );
                await page.goto('http://mstorage.test/');
                results[name] = {
                    version: browser.version(),
                    ...await page.evaluate(
                        async (url) => (await import(url)).benchmark(),
                        dataUrl,
                    ),
                };
                console.log(name + ' complete');
            }
            finally
            {
                await browser.close();
            }
        }
    }
}
finally
{
    await rm(temporary, { recursive: true, force: true });
    await writeFile(
        'benchmarks/m-storage/results.json',
        JSON.stringify(results, null, 2) + '\n',
    );
}

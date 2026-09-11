import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src');

function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory()
            ? files(path)
            : path.endsWith('.ts')
              ? [path]
              : [];
    });
}

function imports(file: string) {
    return ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
        .importedFiles;
}

function sourceTarget(file: string, specifier: string) {
    const target = ts.resolveModuleName(
        specifier,
        file,
        { moduleResolution: ts.ModuleResolutionKind.NodeNext },
        ts.sys,
    ).resolvedModule?.resolvedFileName;
    return target && target.startsWith(src + sep) ? target : undefined;
}

it('keeps each storage implementation independent', () => {
    const violations: string[] = [];
    for (const file of files(src)) {
        const owner = relative(src, file).split(sep)[0];
        // Only the package entry point may aggregate module entry points.
        if (file === resolve(src, 'index.ts')) continue;
        for (const { fileName: specifier } of imports(file)) {
            const target = sourceTarget(file, specifier);
            const targetOwner = target && relative(src, target).split(sep)[0];
            const selfImport = /^browser-storage-plus(?:\/|$)/.test(specifier);
            if (
                selfImport ||
                (targetOwner &&
                    targetOwner !== owner &&
                    targetOwner !== 'core') ||
                (specifier.startsWith('.') && !target)
            ) {
                violations.push(`${relative(root, file)} -> ${specifier}`);
            }
        }
    }
    expect(
        violations,
        'Modules may import only themselves, core, and dependencies',
    ).toEqual([]);
});

it('keeps shared contract tests independent of concrete implementations', () => {
    const violations: string[] = [];
    const contracts = resolve(root, 'tests/contracts');
    for (const file of files(contracts)) {
        for (const { fileName: specifier } of imports(file)) {
            if (!specifier.startsWith('.')) {
                if (specifier.startsWith('browser-storage-plus'))
                    violations.push(specifier);
                continue;
            }
            const target = resolve(dirname(file), specifier);
            if (
                !target.startsWith(contracts + sep) &&
                !target.startsWith(resolve(src, 'core') + sep)
            ) {
                violations.push(`${relative(root, file)} -> ${specifier}`);
            }
        }
    }
    expect(violations).toEqual([]);
});

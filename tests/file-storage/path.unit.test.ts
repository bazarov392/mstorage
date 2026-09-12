import { expect, it } from 'vitest';
import {
    normalizePath,
    overlaps,
    validateScope,
} from '../../src/file-storage/utils/path';

it.each(['a', 'reports-2026', 'user_1.files'])('accepts scope %s', (scope) =>
{
    expect(() => validateScope(scope)).not.toThrow();
});
it.each(['', '.', '..', '.hidden', 'a/b', 'a\\b', ' a', 'a\n', 'a\0'])(
    'rejects scope %j',
    (scope) =>
    {
        expect(() => validateScope(scope)).toThrow(TypeError);
    },
);
it.each(['', '../a', '/a/../../b', '/..', 'a\\b', 'a\0b'])(
    'rejects path %j',
    (path) =>
    {
        expect(() => normalizePath(path)).toThrow(TypeError);
    },
);
it('normalizes context paths without URL decoding or losing directory intent', () =>
{
    expect(normalizePath('a//./b/../файл')).toEqual({
        path: '/a/файл',
        segments: ['a', 'файл'],
        directory: false,
    });
    expect(normalizePath('/a/')).toMatchObject({ path: '/a', directory: true });
    expect(normalizePath('a/.')).toMatchObject({ path: '/a', directory: true });
    expect(normalizePath('a/..')).toMatchObject({ path: '/', directory: true });
    expect(normalizePath('/%2e%2e/x').path).toBe('/%2e%2e/x');
    expect(normalizePath('/a/../b').path).toBe('/b');
});
it('compares full segments for overlapping trees', () =>
{
    expect(overlaps(normalizePath('/a'), normalizePath('/ab'))).toBe(false);
    expect(overlaps(normalizePath('/a'), normalizePath('/a/b'))).toBe(true);
    expect(overlaps(normalizePath('/a/b'), normalizePath('/a'))).toBe(true);
});

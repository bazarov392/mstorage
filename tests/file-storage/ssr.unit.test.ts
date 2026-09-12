import { expect, it, vi } from 'vitest';
import { FileStorageContext } from '../../src/file-storage';

it('imports without browser globals and reports unavailable OPFS only on init', async () =>
{
    vi.stubGlobal('navigator', undefined);
    expect(typeof (await import('../../src')).FileStorageContext).toBe(
        'function',
    );
    await expect(FileStorageContext.init('ssr')).rejects.toMatchObject({
        name: 'NotSupportedError',
    });
});
it('validates scope before accessing storage and preserves access errors', async () =>
{
    const failure = new DOMException('denied', 'NotAllowedError');
    const getDirectory = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal('navigator', { storage: { getDirectory } });
    await expect(FileStorageContext.init('../invalid')).rejects.toThrow(
        TypeError,
    );
    expect(getDirectory).not.toHaveBeenCalled();
    await expect(FileStorageContext.init('valid')).rejects.toBe(failure);
});
it('rejects direct JavaScript construction and forged tokens', () =>
{
    expect(() => Reflect.construct(FileStorageContext, [])).toThrow(TypeError);
    expect(() =>
        Reflect.construct(FileStorageContext, [
            Symbol('FileStorageContext'),
            {},
        ])
    ).toThrow(TypeError);
});

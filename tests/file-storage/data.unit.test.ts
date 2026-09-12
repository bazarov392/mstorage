import { expect, it } from 'vitest';
import { toBytes } from '../../src/file-storage/utils/data';
import type { FileStorageWriteData } from '../../src/file-storage';

it('encodes UTF-8 and preserves Blob bytes', async () =>
{
    const expected = new TextEncoder().encode('Привет 🌍');
    expect(await toBytes('Привет 🌍')).toEqual(expected);
    expect(await toBytes(new Blob([expected]))).toEqual(expected);
});
it('copies selected bytes synchronously, including DataView and numeric typed arrays', async () =>
{
    const input = new Uint8Array([9, 1, 2, 8]);
    const view = toBytes(input.subarray(1, 3));
    const data = toBytes(new DataView(input.buffer, 1, 2));
    const whole = toBytes(input.buffer);
    input.fill(0);
    expect(await view).toEqual(new Uint8Array([1, 2]));
    expect(await data).toEqual(new Uint8Array([1, 2]));
    expect(await whole).toEqual(new Uint8Array([9, 1, 2, 8]));
    const numbers = new Uint16Array([256, 513]);
    expect(await toBytes(numbers)).toEqual(new Uint8Array(numbers.buffer));
});
it.each([
    null,
    undefined,
    {},
    [1, 2],
    42,
    new SharedArrayBuffer(2),
    new Uint8Array(new SharedArrayBuffer(2)),
])(
    'rejects unsupported input %j',
    (input) =>
    {
        expect(() => toBytes(input as FileStorageWriteData)).toThrow(TypeError);
    },
);

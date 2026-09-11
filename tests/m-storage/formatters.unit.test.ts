import { CustomFormatter } from './fixtures';
import { describe, expect, it } from 'vitest';
import {
    JsonValueFormatter,
    EncodingValueFormatter,
} from '../../src/m-storage';
import type { MStorageValue } from '../../src/m-storage';

for (
    const Formatter of [
        JsonValueFormatter,
        EncodingValueFormatter,
        CustomFormatter,
    ]
)
{
    describe(Formatter.name, () =>
    {
        it('round-trips strings and timestamps synchronously without input mutation', () =>
        {
            const formatter = new Formatter();
            const values = [
                '',
                'hello',
                '"\\\n\r\t',
                '|ms2||',
                '["json",null]',
                'Привет 🌍',
                '\ud800\u0000\udfff',
                Array.from({ length: 65536 }, (_, i) => String.fromCharCode(i))
                    .join(''),
            ];
            for (const value of values)
            {
                for (
                    const expiresAt of [
                        null,
                        0,
                        1,
                        0.1,
                        1234.567,
                        1800000000000.125,
                        Number.MIN_VALUE,
                        1.234567890123456e-200,
                        Number.MAX_SAFE_INTEGER,
                    ]
                )
                {
                    const record = Object.freeze({ value, expiresAt });
                    const raw = formatter.encode(record);
                    expect(typeof raw).toBe('string');
                    expect(formatter.decode(raw)).toEqual(record);
                }
            }
        });
        it('round-trips deterministic floating point bit patterns', () =>
        {
            const formatter = new Formatter();
            const view = new DataView(new ArrayBuffer(8));
            let seed = 712367;
            for (let i = 0; i < 5000; i++)
            {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                view.setUint32(0, seed & 0x7fffffff);
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                view.setUint32(4, seed);
                const expiresAt = view.getFloat64(0);
                if(
                    !Number.isFinite(expiresAt)
                    || expiresAt > Number.MAX_SAFE_INTEGER
                )
                    continue;
                expect(
                    formatter.decode(
                        formatter.encode({ value: 'v', expiresAt }),
                    ).expiresAt,
                ).toBe(expiresAt);
            }
        });
        it('rejects invalid input records', () =>
        {
            const formatter = new Formatter();
            for (
                const record of [null, {}, { value: 3, expiresAt: null }, {
                    value: 'v',
                    expiresAt: '1',
                }]
            )
                expect(() =>
                    formatter.encode(record as unknown as MStorageValue)
                ).toThrow(TypeError);
            for (const expiresAt of [NaN, Infinity, -Infinity, -1])
                expect(() => formatter.encode({ value: 'v', expiresAt }))
                    .toThrow(RangeError);
        });
    });
}

it('fixes JSON golden representation and validation', () =>
{
    const formatter = new JsonValueFormatter();
    expect(formatter.encode({ value: 'hello', expiresAt: null })).toBe(
        '["hello",null]',
    );
    expect(formatter.encode({ value: 'hello', expiresAt: 1800000000000 })).toBe(
        '["hello",1800000000000]',
    );
    expect(() => formatter.decode('broken')).toThrow(SyntaxError);
    for (
        const raw of [
            'null',
            '{}',
            '["v"]',
            '["v",null,0]',
            '[false,null]',
            '["v","0"]',
        ]
    )
        expect(() => formatter.decode(raw)).toThrow(TypeError);
    for (const raw of ['["v",-1]', '["v",1e400]'])
        expect(() => formatter.decode(raw)).toThrow(RangeError);
    expect(formatter.decode('["v",1.25]')).toEqual({
        value: 'v',
        expiresAt: 1.25,
    });
    expect(
        formatter.decode(
            formatter.encode({ value: 'v', expiresAt: Number.MAX_VALUE }),
        ).expiresAt,
    ).toBe(Number.MAX_VALUE);
});

it('fixes Encoding golden representation, decimal grammar and header bounds', () =>
{
    const formatter = new EncodingValueFormatter();
    for (
        const [value, expiresAt, raw] of [
            ['hello', null, 'ms2||hello'],
            ['', null, 'ms2||'],
            ['hello', 1800000000000, 'ms2|1800000000000|hello'],
            ['epoch', 0, 'ms2|0|epoch'],
            ['a|b', 1.25, 'ms2|1.25|a|b'],
            ['v', 1e-7, 'ms2|0.0000001|v'],
        ] as const
    )
    {
        expect(formatter.encode({ value, expiresAt })).toBe(raw);
        expect(formatter.decode(raw)).toEqual({ value, expiresAt });
    }
    const tiny = formatter.encode({ value: 'v', expiresAt: Number.MIN_VALUE });
    expect(tiny).toBe('ms2|0.' + '0'.repeat(323) + '5|v');
    for (
        const raw of [
            'ms3||v',
            '["v",null]',
            'ms2|',
            'ms2|1',
            'ms2|' + '0'.repeat(327) + '|v',
            'ms2|' + 'x'.repeat(1_000_000),
        ]
    )
        expect(() => formatter.decode(raw)).toThrow(SyntaxError);
    for (
        const time of [
            ' 1',
            '1 ',
            '+1',
            '-0',
            '-1',
            '1e3',
            'NaN',
            'Infinity',
            '.1',
            '1.',
            '01',
            '1x',
            '0x1',
        ]
    )
        expect(() => formatter.decode(`ms2|${time}|v`)).toThrow(SyntaxError);
    expect(() => formatter.decode('ms2|9007199254740992|v')).toThrow(
        RangeError,
    );
    expect(() => formatter.decode('ms2|0.' + '0'.repeat(323) + '1|v')).toThrow(
        RangeError,
    );
    expect(() => formatter.encode({ value: 'v', expiresAt: Number.MAX_VALUE }))
        .toThrow(RangeError);
});

it('rejects decimal overflow before Number rounding can hide it', () =>
{
    const formatter = new EncodingValueFormatter();
    expect(() => formatter.decode('ms2|9007199254740991.1|v')).toThrow(
        RangeError,
    );
    expect(formatter.decode('ms2|9007199254740991.0|v').expiresAt).toBe(
        Number.MAX_SAFE_INTEGER,
    );
    expect(formatter.decode('ms2|9007199254740990.9|v').expiresAt).toBe(
        Number.MAX_SAFE_INTEGER,
    );
});

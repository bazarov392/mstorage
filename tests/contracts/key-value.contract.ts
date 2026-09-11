import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type Awaitable<T> = T | Promise<T>;

// A test capability, not a mandatory public base class for every storage kind.
export interface StringKeyValueSubject {
    get(key: string): Awaitable<string | null>;
    set(key: string, value: string): Awaitable<unknown>;
    remove(key: string): Awaitable<unknown>;
    clear(): Awaitable<unknown>;
}

export interface KeyValueFixture {
    subject: StringKeyValueSubject;
    dispose(): Awaitable<void>;
}

export function keyValueContract(
    name: string,
    create: () => Awaitable<KeyValueFixture>,
) {
    describe(name, () => {
        let fixture: KeyValueFixture | undefined;

        beforeEach(async () => {
            fixture = await create();
        });

        afterEach(async () => {
            const current = fixture;
            fixture = undefined;
            await current?.dispose();
        });

        it('returns null for a missing key', async () => {
            expect(await fixture!.subject.get('missing')).toBeNull();
        });

        it('round-trips strings, including empty strings and Unicode', async () => {
            const { subject } = fixture!;
            for (const value of ['', 'hello', 'Привет 🌍', '[null,123]']) {
                await subject.set('key', value);
                expect(await subject.get('key')).toBe(value);
            }
        });

        it('overwrites a value without affecting other keys', async () => {
            const { subject } = fixture!;
            await subject.set('first', 'old');
            await subject.set('second', 'untouched');
            await subject.set('first', 'new');
            expect(await subject.get('first')).toBe('new');
            expect(await subject.get('second')).toBe('untouched');
        });

        it('removes a key and tolerates repeated removal', async () => {
            const { subject } = fixture!;
            await subject.set('first', 'value');
            await subject.set('second', 'untouched');
            await subject.remove('first');
            await subject.remove('first');
            expect(await subject.get('first')).toBeNull();
            expect(await subject.get('second')).toBe('untouched');
        });

        it('clears the keys owned by the fixture', async () => {
            const { subject } = fixture!;
            await subject.set('first', 'a');
            await subject.set('second', 'b');
            await subject.clear();
            expect(await subject.get('first')).toBeNull();
            expect(await subject.get('second')).toBeNull();
        });
    });
}

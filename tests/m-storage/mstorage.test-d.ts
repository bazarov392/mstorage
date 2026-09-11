import { expectTypeOf } from 'vitest';
import type { MStorage } from '../../src/m-storage';
import type { IMStorage } from '../../src/m-storage/mstorage.interface';

// Checked by tsc in bun run typecheck, not by the runtime test runner.
// Exact signatures also catch async replacements of void-returning methods,
// which TypeScript's structural implements check alone would allow.
expectTypeOf<Pick<MStorage, keyof IMStorage>>().toEqualTypeOf<IMStorage>();
expectTypeOf<keyof MStorage>().toEqualTypeOf<keyof IMStorage>();

import {
    EncodingValueFormatter,
    JsonValueFormatter,
} from '../../src/m-storage';
import type {
    CreateMStorageOptions,
    IStorage,
    IValueFormatter,
    MStorageValue,
} from '../../src/m-storage';
import { MemoryStorage, CustomFormatter } from './fixtures';

expectTypeOf<Storage>().toExtend<IStorage>();
expectTypeOf<Pick<MemoryStorage, keyof IStorage>>().toEqualTypeOf<IStorage>();
expectTypeOf<JsonValueFormatter>().toEqualTypeOf<IValueFormatter>();
expectTypeOf<EncodingValueFormatter>().toEqualTypeOf<IValueFormatter>();
expectTypeOf<IValueFormatter['decode']>().returns.toEqualTypeOf<
    MStorageValue
>();
expectTypeOf<CreateMStorageOptions['prefix']>().toEqualTypeOf<
    string | undefined
>();
const nativeOptions: CreateMStorageOptions = { storage: localStorage };
void nativeOptions;
// @ts-expect-error String backend selection was removed in v2.
const oldStorage: CreateMStorageOptions = { storage: 'session' };
// @ts-expect-error Key hashing was removed in v2.
const oldEncryption: CreateMStorageOptions = { encryptKeys: true };
// @ts-expect-error Prefix must be a string.
const badPrefix: CreateMStorageOptions = { prefix: 42 };
void [oldStorage, oldEncryption, badPrefix];

expectTypeOf<Pick<CustomFormatter, keyof IValueFormatter>>().toEqualTypeOf<
    IValueFormatter
>();

import { expectTypeOf } from 'vitest';
import type { MStorage } from '../../src/m-storage';
import type { IMStorage } from '../../src/m-storage/mstorage.interface';

// Checked by tsc in bun run typecheck, not by the runtime test runner.
// Exact signatures also catch async replacements of void-returning methods,
// which TypeScript's structural implements check alone would allow.
expectTypeOf<Pick<MStorage, keyof IMStorage>>().toEqualTypeOf<IMStorage>();
expectTypeOf<keyof MStorage>().toEqualTypeOf<keyof IMStorage>();

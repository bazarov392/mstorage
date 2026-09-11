import * as api from '../../src/m-storage/index.ts';
import { run } from './workload.mjs';
export function benchmark()
{
    return run(api, { local: localStorage, session: sessionStorage });
}

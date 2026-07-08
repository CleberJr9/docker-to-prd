import type { Migration } from './types';
import { migration as m001 } from './001-create-people';

// Lista ordenada de migrações. Novas migrações devem ser adicionadas ao final,
// com um id maior que o anterior.
export const migrations: Migration[] = [m001];

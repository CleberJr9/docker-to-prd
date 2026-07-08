import type { Migration } from './types';
import { migration as m001 } from './001-create-flags';

export const migrations: Migration[] = [m001];

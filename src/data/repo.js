/* Seleciona o adapter ativo. A UI so conhece esta interface:
   loadAll(), saveRow(name, row), deleteRow(name, id), replaceAll(DB). */
import { USE_SUPABASE } from '../config.js';
import { local } from './local.js';
import { remote } from './supabase.js';

export const repo = USE_SUPABASE ? remote : local;
export const BACKEND = repo.backend;

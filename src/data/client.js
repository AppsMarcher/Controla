import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, USE_SUPABASE } from '../config.js';

/* Cliente único do Supabase. Fica null quando rodando em modo localStorage. */
export const supabase = USE_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

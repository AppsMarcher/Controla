/* Configuração central — lê as variáveis de ambiente do Vite (.env). */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SUPABASE_PHOTOS_BUCKET = import.meta.env.VITE_SUPABASE_PHOTOS_BUCKET || 'fotos';

/* Se houver URL + anon key, usa Supabase; senão, cai no localStorage. */
export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* Tabelas espelhadas no cache em memória (DB[chave]) e no Supabase. */
export const TABLES = ['ramais', 'visitantes', 'motoristas', 'veiculos', 'acessos', 'entregas'];

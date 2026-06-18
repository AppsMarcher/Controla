/* Configuração central — projeto SEM build. As chaves ficam fixas aqui.
   A chave publicável (sb_publishable_...) pode ir no código client-side com
   segurança: quem protege os dados é o RLS no Supabase.
   ATENÇÃO: NUNCA cole aqui a chave sb_secret_... (essa sim é perigosa). */
export const SUPABASE_URL = 'https://gyrotwgeyapsdxehlxax.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_XMBvxd4DKWn_IhQC7vvSHg_AtIzGLKY';
export const SUPABASE_PHOTOS_BUCKET = 'fotos';

/* Se houver URL + anon key, usa Supabase; senão, cai no localStorage. */
export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* Tabelas espelhadas no cache em memória (DB[chave]) e no Supabase. */
export const TABLES = ['ramais', 'visitantes', 'motoristas', 'veiculos', 'acessos', 'entregas'];

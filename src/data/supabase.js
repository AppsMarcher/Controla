/* Adapter Supabase - mesma interface do adapter localStorage.
   Os registros usam `id` em texto, entao o upsert por id funciona sem mapeamento. */
import { supabase } from './client.js';
import { SOFT_DELETE_TABLES, TABLES } from '../config.js';

function rawDbMessage(error) {
  return String(error?.message || error?.details || error?.hint || error || '').trim();
}

function normalizeDbMessage(error) {
  return rawDbMessage(error)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function mapDbError(name, error, action) {
  const raw = rawDbMessage(error);
  const msg = normalizeDbMessage(error);
  const code = String(error?.code || '').trim();

  if (msg.includes('cpf invalido')) return 'CPF inválido. Confira os dígitos informados.';
  if (msg.includes('documento e obrigatorio')) return 'Documento obrigatório.';
  if (msg.includes('placa e obrigatoria')) return 'Placa obrigatória.';
  if (msg.includes('fornecedor e obrigatorio')) return 'Fornecedor / transportadora é obrigatório.';
  if (msg.includes('destinatario interno e obrigatorio')) return 'Destinatário interno é obrigatório.';
  if (msg.includes('nome, documento, empresa e visitado sao obrigatorios')) {
    return 'Nome, documento, empresa e pessoa / setor visitado são obrigatórios.';
  }
  if (msg.includes('tipo invalido')) return 'Tipo de registro inválido.';

  if (code === '23505' || msg.includes('duplicate key value')) {
    if (msg.includes('visitantes_documento_normalizado_uq')) return 'Já existe visitante com este documento.';
    if (msg.includes('motoristas_documento_normalizado_uq')) return 'Já existe motorista com este documento.';
    if (msg.includes('veiculos_placa_normalizada_uq')) return 'Já existe veículo com esta placa.';
    return 'Já existe um registro com estes dados.';
  }

  if (msg.includes('row-level security') || code === '42501') {
    return 'Seu perfil não tem permissão para realizar esta ação.';
  }

  return `${name}${action ? ' (' + action + ')' : ''}: ${raw || 'falha desconhecida.'}`;
}

async function fetchTable(name) {
  let query = supabase.from(name).select('*');
  if (SOFT_DELETE_TABLES.includes(name)) query = query.is('deleted_at', null);
  const { data, error } = await query;
  if (error) throw new Error(mapDbError(name, error, 'select'));
  return data || [];
}

async function upsertRow(name, row) {
  const { error } = await supabase.from(name).upsert([row]);
  if (error) throw new Error(mapDbError(name, error, 'save'));
}

/* Usado apenas em restauracao total de backup. */
async function replaceTable(name, DB) {
  const rows = DB[name] || [];
  if (rows.length) {
    const { error } = await supabase.from(name).upsert(rows);
    if (error) throw new Error(mapDbError(name, error, 'replace'));
  }
  const ids = rows.map((r) => r.id).filter(Boolean);
  let del = supabase.from(name).delete();
  if (ids.length) {
    const list = '(' + ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',') + ')';
    del = del.not('id', 'in', list);
  } else {
    del = del.not('id', 'is', null);
  }
  const { error } = await del;
  if (error) throw new Error(mapDbError(name, error, 'delete'));
}

export const remote = {
  backend: 'supabase',

  async loadAll() {
    const DB = {};
    const results = await Promise.all(TABLES.map((t) => fetchTable(t)));
    TABLES.forEach((t, i) => { DB[t] = results[i]; });
    return DB;
  },

  async loadArchived(name) {
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) throw new Error(mapDbError(name, error, 'loadArchived'));
    return data || [];
  },

  async loadAuditLogs(options = {}) {
    const table = String(options.table || '').trim();
    const action = String(options.action || '').trim().toUpperCase();
    const limit = Math.max(1, Math.min(Number(options.limit) || 80, 200));
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (table) query = query.eq('tabela', table);
    if (action) query = query.eq('acao', action);
    const { data, error } = await query;
    if (error) throw new Error(mapDbError('audit_logs', error, 'select'));
    return data || [];
  },

  async saveRow(name, row) { await upsertRow(name, row); },

  async deleteRow(name, id) {
    const { error } = await supabase.from(name).delete().eq('id', id);
    if (error) throw new Error(mapDbError(name, error, 'delete'));
  },

  async replaceAll(DB) {
    for (const t of TABLES) await replaceTable(t, DB);
  }
};

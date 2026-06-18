/* Adapter Supabase - mesma interface do adapter localStorage.
   Os registros usam `id` em texto, entao o upsert por id funciona sem mapeamento. */
import { supabase } from './client.js';
import { TABLES } from '../config.js';

async function fetchTable(name) {
  const { data, error } = await supabase.from(name).select('*');
  if (error) throw new Error(`${name}: ${error.message}`);
  return data || [];
}

async function upsertRow(name, row) {
  const { error } = await supabase.from(name).upsert([row]);
  if (error) throw new Error(`${name}: ${error.message}`);
}

/* Usado apenas em restauracao total de backup. */
async function replaceTable(name, DB) {
  const rows = DB[name] || [];
  if (rows.length) {
    const { error } = await supabase.from(name).upsert(rows);
    if (error) throw new Error(`${name}: ${error.message}`);
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
  if (error) throw new Error(`${name} (delete): ${error.message}`);
}

export const remote = {
  backend: 'supabase',

  async loadAll() {
    const DB = {};
    const results = await Promise.all(TABLES.map((t) => fetchTable(t)));
    TABLES.forEach((t, i) => { DB[t] = results[i]; });
    return DB;
  },

  async saveRow(name, row) { await upsertRow(name, row); },

  async deleteRow(name, id) {
    const { error } = await supabase.from(name).delete().eq('id', id);
    if (error) throw new Error(`${name} (delete): ${error.message}`);
  },

  async replaceAll(DB) {
    for (const t of TABLES) await replaceTable(t, DB);
  }
};

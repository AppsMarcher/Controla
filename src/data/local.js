/* Adapter localStorage - mesma interface do adapter Supabase.
   Guarda todo o estado num unico blob (modo dev / fallback). */
import { seedDB, seedRamais, RAMAIS_SEED_VERSION } from './seed.js';
import { SOFT_DELETE_TABLES, TABLES } from '../config.js';

const KEY = 'controlaMarcher_v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignora */ }
  return null;
}

function write(DB) {
  localStorage.setItem(KEY, JSON.stringify(DB));
}

function ensureLocalShape(DB) {
  TABLES.forEach((t) => { if (!Array.isArray(DB[t])) DB[t] = []; });
  if (!Array.isArray(DB.audit_logs)) DB.audit_logs = [];
}

function pushAuditLog(DB, payload) {
  ensureLocalShape(DB);
  DB.audit_logs.unshift(Object.assign({
    id: Date.now(),
    tabela: '',
    registro_id: '',
    acao: 'UPDATE',
    actor_user_id: '',
    actor_role: '',
    old_data: null,
    new_data: null,
    created_at: new Date().toISOString()
  }, payload));
  if (DB.audit_logs.length > 200) DB.audit_logs = DB.audit_logs.slice(0, 200);
}

function cloneForUi(DB) {
  const copy = structuredClone(DB);
  SOFT_DELETE_TABLES.forEach((t) => {
    copy[t] = (copy[t] || []).filter((row) => !row.deleted_at);
  });
  return copy;
}

export const local = {
  backend: 'local',

  async loadAll() {
    let DB = read();
    if (!DB) DB = seedDB();
    ensureLocalShape(DB);
    if (!Array.isArray(DB.ramais) || DB.ramaisVersao !== RAMAIS_SEED_VERSION) {
      DB.ramais = seedRamais();
      DB.ramaisVersao = RAMAIS_SEED_VERSION;
    }
    write(DB);
    return cloneForUi(DB);
  },

  async loadArchived(name) {
    let DB = read();
    if (!DB) DB = seedDB();
    ensureLocalShape(DB);
    return (DB[name] || []).filter((row) => row.deleted_at).sort((a, b) => String(b.deleted_at || '').localeCompare(String(a.deleted_at || '')));
  },

  async loadAuditLogs(options = {}) {
    let DB = read();
    if (!DB) DB = seedDB();
    ensureLocalShape(DB);
    const table = String(options.table || '').trim();
    const action = String(options.action || '').trim().toUpperCase();
    const limit = Math.max(1, Math.min(Number(options.limit) || 80, 200));
    return (DB.audit_logs || [])
      .filter((row) => (!table || row.tabela === table) && (!action || String(row.acao || '').toUpperCase() === action))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, limit);
  },

  async saveRow(name, row) {
    let DB = read();
    if (!DB) DB = seedDB();
    ensureLocalShape(DB);
    const rows = Array.isArray(DB[name]) ? DB[name] : [];
    const idx = rows.findIndex((item) => item.id === row.id);
    const previous = idx >= 0 ? structuredClone(rows[idx]) : null;
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    DB[name] = rows;
    pushAuditLog(DB, {
      tabela: name,
      registro_id: row.id || '',
      acao: previous ? 'UPDATE' : 'INSERT',
      old_data: previous,
      new_data: structuredClone(row)
    });
    write(DB);
  },

  async deleteRow(name, id) {
    let DB = read();
    if (!DB) DB = seedDB();
    ensureLocalShape(DB);
    const rows = DB[name] || [];
    const previous = rows.find((row) => row.id === id) || null;
    DB[name] = rows.filter((row) => row.id !== id);
    if (previous) {
      pushAuditLog(DB, {
        tabela: name,
        registro_id: id,
        acao: 'DELETE',
        old_data: structuredClone(previous),
        new_data: null
      });
    }
    write(DB);
  },

  async replaceAll(DB) { write(DB); }
};

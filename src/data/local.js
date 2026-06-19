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
    TABLES.forEach((t) => { if (!Array.isArray(DB[t])) DB[t] = []; });
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
    TABLES.forEach((t) => { if (!Array.isArray(DB[t])) DB[t] = []; });
    return (DB[name] || []).filter((row) => row.deleted_at).sort((a, b) => String(b.deleted_at || '').localeCompare(String(a.deleted_at || '')));
  },

  async saveRow(name, row) {
    let DB = read();
    if (!DB) DB = seedDB();
    TABLES.forEach((t) => { if (!Array.isArray(DB[t])) DB[t] = []; });
    const rows = Array.isArray(DB[name]) ? DB[name] : [];
    const idx = rows.findIndex((item) => item.id === row.id);
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    DB[name] = rows;
    write(DB);
  },

  async deleteRow(name, id) {
    let DB = read();
    if (!DB) DB = seedDB();
    TABLES.forEach((t) => { if (!Array.isArray(DB[t])) DB[t] = []; });
    DB[name] = (DB[name] || []).filter((row) => row.id !== id);
    write(DB);
  },

  async replaceAll(DB) { write(DB); }
};

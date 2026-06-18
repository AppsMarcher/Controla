/* Adapter localStorage - mesma interface do adapter Supabase.
   Guarda todo o estado num unico blob (modo dev / fallback). */
import { seedDB, seedRamais, RAMAIS_SEED_VERSION } from './seed.js';
import { TABLES } from '../config.js';

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
    return DB;
  },

  async saveRow(name, row) {
    const DB = await this.loadAll();
    const rows = Array.isArray(DB[name]) ? DB[name] : [];
    const idx = rows.findIndex((item) => item.id === row.id);
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    DB[name] = rows;
    write(DB);
  },

  async deleteRow(name, id) {
    const DB = await this.loadAll();
    DB[name] = (DB[name] || []).filter((row) => row.id !== id);
    write(DB);
  },

  async replaceAll(DB) { write(DB); }
};

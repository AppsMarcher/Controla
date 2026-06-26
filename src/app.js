/* ============================================================
   CONTROLA MARCHER — App (UI)  •  módulo principal
   Persistência via camada de dados (Supabase ou localStorage)
   ============================================================ */
import { repo } from './data/repo.js';
import { deleteUserRemote, inviteUserRemote, loadProfilesRemote, logout, saveProfileRemote, setUserPasswordRemote, updateProfileRoleRemote, updateUserStatusRemote } from './auth.js';
import { seedRamais } from './data/seed.js';
import { uploadPhotoIfNeeded } from './data/storage.js';

const ROLE_SUPER_ADMIN = 'Super Admin';
const ROLE_ADMIN = 'Admin';
const ROLE_SEGURANCA = 'Seguranca';
const ROLE_CONSULTA = 'Consulta';

let ROLE = ROLE_SUPER_ADMIN;
let PERFIS_USUARIOS = [];
const PERFIS_ACESSO = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SEGURANCA, ROLE_CONSULTA];

let DB = {};                 // cache em memória (hidratado em loadData)
let ARQUIVADOS = { visitantes: [], motoristas: [], veiculos: [], ramais: [], entregas: [] };
let AUDITORIA = [];

export async function loadData() { DB = await repo.loadAll(); }

function saveDB(entity, row) {
  const p = entity && row ? repo.saveRow(entity, row) : repo.replaceAll(DB);
  p.catch((e) => toast('Falha ao salvar dados: ' + (e.message || e), 'error'));
}

function softDeleteRow(entity, row) {
  const archived = Object.assign({}, row, {
    deleted_at: new Date().toISOString(),
    deleted_by: USUARIO?.id || null
  });
  saveDB(entity, archived);
  return archived;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function roleKey(perfil) {
  return String(perfil == null ? '' : perfil).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalizeRole(perfil) {
  const key = roleKey(perfil);
  if (key === 'super admin' || key === 'superadmin') return ROLE_SUPER_ADMIN;
  if (key === 'admin') return ROLE_ADMIN;
  if (key === 'administrador') return ROLE_SUPER_ADMIN;
  if (key === 'seguranca' || key === 'porteiro') return ROLE_SEGURANCA;
  if (key === 'consulta' || key === 'consultas') return ROLE_CONSULTA;
  return ROLE_CONSULTA;
}
function isSuperAdmin() { return ROLE === ROLE_SUPER_ADMIN; }
function isAdmin() { return ROLE === ROLE_ADMIN; }
function canManageUsers() { return isSuperAdmin() || isAdmin(); }
function canWriteCadastros() { return isSuperAdmin() || isAdmin() || ROLE === ROLE_SEGURANCA; }
function canDeleteCadastros() { return isSuperAdmin() || isAdmin(); }
function canQuickSaveCadastros() { return canWriteCadastros(); }
function canWriteOperacao() { return isSuperAdmin() || isAdmin() || ROLE === ROLE_SEGURANCA; }
function canAccessReports() { return isSuperAdmin() || isAdmin() || ROLE === ROLE_CONSULTA; }
function canManageRamais() { return isSuperAdmin() || isAdmin(); }
function canFavoriteRamais() { return isSuperAdmin() || isAdmin() || ROLE === ROLE_SEGURANCA || ROLE === ROLE_CONSULTA; }
function getAssignableRoles() {
  return isSuperAdmin()
    ? PERFIS_ACESSO.slice()
    : [ROLE_ADMIN, ROLE_SEGURANCA, ROLE_CONSULTA];
}
function canEditUserRole(targetRole) {
  const role = normalizeRole(targetRole);
  if (isSuperAdmin()) return true;
  if (!isAdmin()) return false;
  return role !== ROLE_SUPER_ADMIN;
}
function canAccessView(name) {
  switch (name) {
    case 'usuarios':
      return canManageUsers();
    case 'relatorios':
      return canAccessReports();
    case 'visitantes':
    case 'motoristas':
    case 'veiculos':
    case 'dashboard':
    case 'entrada':
    case 'saida':
    case 'entregas':
    case 'historico':
    case 'ramais':
      return true;
    default:
      return false;
  }
}
function ensureAllowed(ok, msg) {
  if (ok) return true;
  toast(msg || 'Seu perfil não permite esta ação.', 'warn');
  return false;
}

function archiveEntityLabel(tipo) {
  return ({
    visitantes: 'Visitantes',
    motoristas: 'Motoristas',
    veiculos: 'Veículos',
    acessos: 'Acessos',
    ramais: 'Ramais',
    entregas: 'Entregas'
  })[tipo] || tipo;
}

/* ============================================================
   CONTROLA MARCHER — JAVASCRIPT
   Persistência: localStorage | Sem dependências externas
   ============================================================ */







/* ---------- Utilidades ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function badgeStatus(status) {
  const s = norm(status);
  if (s === 'dentro') return '<span class="badge b-dentro">Dentro</span>';
  if (s === 'saiu') return '<span class="badge b-saiu">Saiu</span>';
  if (s === 'pendente') return '<span class="badge b-pendente">Pendente</span>';
  if (s === 'recebido') return '<span class="badge b-dentro">Recebido</span>';
  if (s === 'entregue') return '<span class="badge b-saiu">Entregue</span>';
  if (s === 'cancelado' || s === 'problema') return '<span class="badge b-problema">Cancelado</span>';
  return '<span class="badge b-saiu">' + esc(status) + '</span>';
}
function badgeTipo(t) { return '<span class="badge b-tipo">' + esc(t) + '</span>'; }

/* ---------- Ícones de ação (padrão único do app) ---------- */
const ICO = {
  edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l-1-14"/><path d="M10 11v6M14 11v6"/></svg>',
  exit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 16l4-4-4-4"/><path d="M13 12H3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.4 5.6a8 8 0 1 1-12.8 0"/></svg>',
  key:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M12 15h9"/><path d="M18 12v6"/><path d="M21 12v6"/></svg>'
};

/* Monta um botão de ação só com ícone (com tooltip/acessibilidade). */
function btnIcon(cls, titulo, onclick, icone) {
  return '<button class="btn ' + cls + ' btn-sm btn-icon" title="' + esc(titulo) + '" aria-label="' + esc(titulo) + '" onclick="' + onclick + '">' + icone + '</button>';
}

/* ============================================================
   ORDENAÇÃO — cabeçalhos clicáveis (padrão único reutilizável)
   ============================================================ */
const sortState = {
  saida:      { col: 'entrada', dir: 1 },
  entregas:   { col: 'data',    dir: -1 },
  visitantes: { col: 'nome',    dir: 1 },
  motoristas: { col: 'nome',    dir: 1 },
  veiculos:   { col: 'placa',   dir: 1 },
  historico:  { col: 'entrada', dir: -1 }
};

function cmpVal(a, b) {
  return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'pt', { numeric: true, sensitivity: 'base' });
}

function sortRows(rows, key) {
  const s = sortState[key];
  return rows.sort((a, b) => s.dir * cmpVal(a[s.col], b[s.col]));
}

/* Gera um <th> ordenável; col vazio => coluna não ordenável (ex.: ações). */
function thSort(key, col, label) {
  if (!col) return '<th>' + label + '</th>';
  const s = sortState[key];
  const ind = s.col === col ? ' <span class="sort-ind">' + (s.dir > 0 ? '&#9650;' : '&#9660;') + '</span>' : '';
  return '<th class="th-sort" onclick="ordenarTabela(\'' + key + '\',\'' + col + '\')">' + label + ind + '</th>';
}

function ordenarTabela(key, col) {
  const s = sortState[key];
  if (s.col === col) s.dir *= -1; else { s.col = col; s.dir = 1; }
  const fn = { saida: renderSaida, entregas: renderEntregas, visitantes: renderVisitantes, motoristas: renderMotoristas, veiculos: renderVeiculos, historico: renderHistorico }[key];
  if (fn) fn();
}

/* ---------- Celular: máscara/format xx xxxxx xxxx ---------- */
function fmtCelular(s) {
  const d = String(s == null ? '' : s).replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return d;
  if (d.length <= 7) return d.slice(0, 2) + ' ' + d.slice(2);
  return d.slice(0, 2) + ' ' + d.slice(2, d.length - 4) + ' ' + d.slice(d.length - 4);
}
function mascaraCelular(el) {
  el.value = fmtCelular(el.value);
}

function fmtCpf(value) {
  const d = String(value == null ? '' : value).replace(/\D/g, '').slice(0, 11);
  if (d.length !== 11) return String(value == null ? '' : value).trim();
  return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
}

function bindDocumentoField(id) {
  const input = document.getElementById(id);
  if (!input || input.dataset.docBound) return;
  input.dataset.docBound = '1';
  const applyMask = () => {
    const digits = input.value.replace(/\D/g, '');
    if (digits.length === 11) input.value = fmtCpf(digits);
  };
  input.addEventListener('blur', applyMask);
  input.addEventListener('change', applyMask);
}

function normalizeDocumento(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePlaca(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isCpfValido(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(digits[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === parseInt(digits[10], 10);
}

function validarDocumento(doc) {
  const raw = String(doc == null ? '' : doc).trim();
  const digits = raw.replace(/\D/g, '');
  const normalized = normalizeDocumento(raw);
  if (!normalized) return { ok: false, msg: 'Informe um documento válido.' };
  if (digits.length === 11 && !isCpfValido(raw)) return { ok: false, msg: 'CPF inválido. Confira os dígitos informados.' };
  if (normalized.length < 4) return { ok: false, msg: 'Documento inválido. Confira os dados informados.' };
  return { ok: true };
}

/* ---------- Debounce ---------- */
function debounce(fn, ms) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

/* ---------- Toast (fila máx. 3 — remove o mais antigo se ultrapassar) ---------- */
const _toastAtivos = [];
function toast(msg, kind) {
  const box = document.getElementById('toastBox');
  if (_toastAtivos.length >= 3) {
    const antigo = _toastAtivos.shift();
    antigo.remove();
  }
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  box.appendChild(el);
  _toastAtivos.push(el);
  const remover = () => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => { el.remove(); const i = _toastAtivos.indexOf(el); if (i !== -1) _toastAtivos.splice(i, 1); }, 320);
  };
  setTimeout(remover, 2800);
}

/* ---------- Modal ---------- */
function abrirModal(titulo, bodyHTML, small) {
  document.getElementById('modalTitle').textContent = titulo;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalBox').classList.remove('modal-ramal');
  document.getElementById('modalBox').classList.toggle('small', !!small);
  document.getElementById('modalOverlay').classList.add('open');
}
function fecharModal() {
  if (typeof pararWebcam === 'function') pararWebcam(true);
  document.getElementById('modalBox').classList.remove('modal-ramal');
  document.getElementById('modalOverlay').classList.remove('open');
}
document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) fecharModal();
});

function confirmar(texto, onYes) {
  abrirModal('Confirmação', '<div class="confirm-text">' + esc(texto) + '</div>' +
    '<div class="form-foot" style="margin-top:0">' +
    '<button class="btn btn-danger" id="confirmYes">Sim, excluir</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>', true);
  document.getElementById('confirmYes').onclick = function () { fecharModal(); onYes(); };
}

/* ---------- Navegação ---------- */
function showView(name) {
  if (!canAccessView(name)) {
    toast('Seu perfil não pode acessar esta área.', 'warn');
    name = 'dashboard';
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const sec = document.getElementById('view-' + name);
  if (sec) sec.classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.getElementById('sidebar').classList.remove('open');
  if (name === 'entrada') atualizarBannerPendente();
  if (name === 'usuarios') recarregarUsuarios();
  if (name === 'relatorios' && canManageUsers()) {
    carregarArquivados();
    carregarAuditoria();
  }
  renderAll();
}
document.querySelectorAll('nav button').forEach(b => {
  b.addEventListener('click', () => showView(b.dataset.view));
});
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

/* ---------- Relógio do header ---------- */
function tickClock() {
  const d = new Date();
  document.getElementById('headerClock').textContent =
    d.toLocaleDateString('pt-BR') + '  ' + d.toLocaleTimeString('pt-BR');
}
setInterval(tickClock, 1000); tickClock();

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const dentro = DB.acessos.filter(a => a.status === 'Dentro');
  const hojeStr = new Date().toDateString();
  const doDia = DB.acessos.filter(a => new Date(a.entrada).toDateString() === hojeStr);
  const cards = [
    { label: 'Pessoas dentro agora', num: dentro.length, view: 'saida', red: true },
    { label: 'Visitantes presentes', num: dentro.filter(a => a.tipo === 'visitante').length, view: 'saida' },
    { label: 'Motoristas presentes', num: dentro.filter(a => a.tipo === 'motorista').length, view: 'saida' },
    { label: 'Veículos no pátio', num: dentro.filter(a => (a.placa || '').trim() !== '').length, view: 'saida' },
    { label: 'Entregas pendentes', num: DB.entregas.filter(e => e.status === 'pendente').length, view: 'entregas', red: true },
    { label: 'Registros do dia', num: doDia.length, view: 'historico' }
  ];
  document.getElementById('dashCards').innerHTML = cards.map(c =>
    '<div class="card' + (c.red ? ' red' : '') + '" onclick="showView(\'' + c.view + '\')">' +
    '<div class="card-num">' + c.num + '</div>' +
    '<div class="card-label">' + c.label + '</div></div>'
  ).join('');

  const rows = doDia.slice().sort((a, b) => b.entrada.localeCompare(a.entrada)).slice(0, 10);
  let html = '<thead><tr><th>Hora</th><th>Tipo</th><th>Nome</th><th>Empresa</th><th>Placa</th><th>Status</th></tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="6">Nenhum registro hoje. Use "Registrar Entrada" para começar.</td></tr>';
  rows.forEach(a => {
    const clicavel = (a.tipo === 'visitante' || a.tipo === 'motorista' || a.tipo === 'prestador');
    const nomeCell = clicavel
      ? '<button class="dash-nome-btn" onclick="abrirPopoverCadastro(\'' + esc(a.tipo) + '\',\'' + esc(a.documento) + '\')">' + esc(a.nome) + '</button>'
      : '<strong>' + esc(a.nome) + '</strong>';
    html += '<tr><td class="mono">' + fmtHora(a.entrada) + '</td><td>' + badgeTipo(a.tipo) + '</td><td>' + nomeCell + '</td><td>' +
      esc(a.empresa || '—') + '</td><td class="mono">' + esc(a.placa || '—') + '</td><td>' + badgeStatus(a.status) + '</td></tr>';
  });
  document.getElementById('dashTable').innerHTML = html + '</tbody>';
}

function abrirPopoverCadastro(tipo, documento) {
  const tabela = (tipo === 'motorista') ? 'motoristas' : 'visitantes';
  const reg = DB[tabela].find(x => normalizeDocumento(x.documento) === normalizeDocumento(documento));

  let ov = document.getElementById('cadastroPopoverOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'cadastroPopoverOverlay';
    ov.innerHTML = '<div id="cadastroPopoverBox" onclick="event.stopPropagation()"></div>';
    ov.addEventListener('click', fecharPopoverCadastro);
    document.body.appendChild(ov);
  }

  const box = document.getElementById('cadastroPopoverBox');

  if (!reg) {
    box.innerHTML =
      '<div class="cpop-header"><span class="cpop-title">Cadastro não encontrado</span></div>' +
      '<div class="cpop-body"><p class="muted">Este acesso foi registrado sem cadastro prévio.</p></div>' +
      '<div class="cpop-foot"><button class="btn btn-ghost" onclick="fecharPopoverCadastro()">Fechar</button></div>';
    ov.classList.add('open');
    return;
  }

  const foto = reg.foto
    ? '<img src="' + reg.foto + '" alt="" class="cpop-foto">'
    : '<div class="cpop-foto cpop-foto-ph">' + esc(String(reg.nome || '?').charAt(0).toUpperCase()) + '</div>';

  const linhas = [
    ['Documento', reg.documento],
    ['Telefone', reg.telefone || '—'],
    ['Empresa', (tabela === 'motoristas' ? reg.transportadora : reg.empresa) || '—'],
    tabela === 'motoristas' ? ['Placa padrão', reg.placaPadrao || '—'] : null,
    ['Status', reg.ativo !== false ? 'Ativo' : 'Inativo'],
    reg.obs ? ['Obs.', reg.obs] : null
  ].filter(Boolean);

  const editFn = tabela === 'motoristas'
    ? 'fecharPopoverCadastro();abrirFormMotorista(\'' + reg.id + '\')'
    : 'fecharPopoverCadastro();abrirFormVisitante(\'' + reg.id + '\')';

  box.innerHTML =
    '<div class="cpop-header">' + foto + '<span class="cpop-title">' + esc(reg.nome) + '</span></div>' +
    '<div class="cpop-body">' +
    linhas.map(([k, v]) => '<div class="cpop-linha"><span class="cpop-key">' + esc(k) + '</span><span class="cpop-val">' + esc(v) + '</span></div>').join('') +
    '</div>' +
    '<div class="cpop-foot">' +
    (canWriteCadastros() ? '<button class="btn btn-primary" onclick="' + editFn + '">Editar</button>' : '') +
    '<button class="btn btn-ghost" onclick="fecharPopoverCadastro()">Fechar</button>' +
    '</div>';

  ov.classList.add('open');
}

function fecharPopoverCadastro() {
  const ov = document.getElementById('cadastroPopoverOverlay');
  if (ov) ov.classList.remove('open');
}

Object.assign(window, { abrirPopoverCadastro, fecharPopoverCadastro });

/* ============================================================
   ENTRADA
   ============================================================ */
function limparFormEntrada() {
  ['e_nome','e_doc','e_empresa','e_tel','e_placa','e_visitado','e_motivo','e_obs'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('e_tipo').value = 'interno';
}

function getEntradaFormData() {
  return {
    tipo: document.getElementById('e_tipo').value,
    nome: document.getElementById('e_nome').value.trim(),
    documento: document.getElementById('e_doc').value.trim(),
    empresa: document.getElementById('e_empresa').value.trim(),
    telefone: document.getElementById('e_tel').value.trim(),
    placa: normalizePlaca(document.getElementById('e_placa').value),
    motivo: document.getElementById('e_motivo').value.trim(),
    visitado: document.getElementById('e_visitado').value.trim(),
    obs: document.getElementById('e_obs').value.trim()
  };
}

function obterPendenciasCadastroEntrada(reg) {
  const pendencias = [];
  const docN = normalizeDocumento(reg.documento);
  const placaN = normalizePlaca(reg.placa);

  if ((reg.tipo === 'visitante' || reg.tipo === 'prestador') && docN) {
    const visitanteExiste = DB.visitantes.some((x) => normalizeDocumento(x.documento) === docN);
    if (!visitanteExiste) pendencias.push('visitante');
  }

  if (reg.tipo === 'motorista' && docN) {
    const motoristaExiste = DB.motoristas.some((x) => normalizeDocumento(x.documento) === docN);
    if (!motoristaExiste) pendencias.push('motorista');
  }

  if (placaN) {
    const veiculoExiste = DB.veiculos.some((x) => normalizePlaca(x.placa) === placaN);
    if (!veiculoExiste) pendencias.push('veiculo');
  }

  return pendencias;
}

function direcionarCadastroPendente(pendencias, reg) {
  if (!pendencias.length) return false;
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil não pode cadastrar visitantes, motoristas ou veículos.')) return true;
  ENTRADA_PENDENTE = { reg: { ...reg }, pendencias: pendencias.slice() };

  if (pendencias.includes('visitante')) {
    showView('visitantes');
    abrirFormVisitante({
      nome: reg.nome,
      documento: reg.documento,
      telefone: reg.telefone,
      empresa: reg.empresa,
      obs: reg.tipo === 'prestador' ? 'Prestador de serviço' : ''
    });
    toast('Visitante não cadastrado. Complete o cadastro antes de registrar a entrada.', 'warn');
    return true;
  }

  if (pendencias.includes('motorista')) {
    showView('motoristas');
    abrirFormMotorista({
      nome: reg.nome,
      documento: reg.documento,
      telefone: reg.telefone,
      transportadora: reg.empresa,
      placaPadrao: reg.placa
    });
    toast('Motorista não cadastrado. Complete o cadastro antes de registrar a entrada.', 'warn');
    return true;
  }

  if (pendencias.includes('veiculo')) {
    const motoristaExistente = reg.tipo === 'motorista'
      ? DB.motoristas.find((x) => normalizeDocumento(x.documento) === normalizeDocumento(reg.documento))
      : null;
    showView('veiculos');
    abrirFormVeiculo({
      placa: reg.placa,
      proprietario: reg.empresa,
      motorista: motoristaExistente ? motoristaExistente.nome : (reg.tipo === 'motorista' ? reg.nome : ''),
      motoristaDocumento: motoristaExistente ? motoristaExistente.documento : ''
    });
    toast('Veículo não cadastrado. Complete o cadastro antes de registrar a entrada.', 'warn');
    return true;
  }

  return false;
}

function atualizarBannerPendente() {
  const banner = document.getElementById('entradaPendenteBanner');
  if (!banner) return;
  if (!ENTRADA_PENDENTE?.reg) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }
  const p = ENTRADA_PENDENTE.reg;
  banner.style.display = '';
  banner.innerHTML =
    '<div class="entrada-pendente-banner">' +
    '<div class="epb-info">' +
    '<span class="epb-icon">⚠</span>' +
    '<div><strong>Cadastro pendente:</strong> ' + esc(p.nome) + ' (' + esc(p.documento) + ') — ' +
    'complete o cadastro antes de registrar a entrada desta pessoa.' +
    '</div></div>' +
    '<div class="epb-actions">' +
    '<button class="btn btn-primary btn-sm" onclick="retomarEntradaPendente()">Retomar cadastro</button>' +
    '<button class="btn btn-ghost btn-sm" onclick="cancelarEntradaPendente()">Cancelar pendência</button>' +
    '</div></div>';
}

function retomarEntradaPendente() {
  if (!ENTRADA_PENDENTE?.reg) return;
  const pendencias = obterPendenciasCadastroEntrada(ENTRADA_PENDENTE.reg);
  if (pendencias.length) {
    direcionarCadastroPendente(pendencias, ENTRADA_PENDENTE.reg);
  } else {
    retomarEntradaPendenteSePossivel();
  }
}

function cancelarEntradaPendente() {
  ENTRADA_PENDENTE = null;
  atualizarBannerPendente();
  toast('Pendência de cadastro cancelada.');
}

function registrarEntrada() {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil não pode registrar entradas.')) return;
  const dadosEntrada = getEntradaFormData();
  const { nome, documento: doc, empresa, visitado } = dadosEntrada;
  if (!nome || !doc || !empresa || !visitado) {
    toast('Preencha Nome, Documento, Empresa e Pessoa / setor visitado.', 'error');
    return;
  }
  const validacaoDoc = validarDocumento(doc);
  if (!validacaoDoc.ok) {
    toast(validacaoDoc.msg, 'error');
    return;
  }

  // Bloqueia se há cadastro pendente de outra pessoa
  if (ENTRADA_PENDENTE?.reg &&
      normalizeDocumento(ENTRADA_PENDENTE.reg.documento) !== normalizeDocumento(doc)) {
    toast('Conclua ou cancele o cadastro pendente de ' + ENTRADA_PENDENTE.reg.nome + ' antes de registrar uma nova entrada.', 'warn');
    atualizarBannerPendente();
    return;
  }

  const docNorm = normalizeDocumento(doc);
  const jaDentro = DB.acessos.find(a => a.status === 'Dentro' &&
    normalizeDocumento(a.documento) === docNorm);
  if (jaDentro) {
    toast('Entrada bloqueada: ' + jaDentro.nome + ' (doc. ' + jaDentro.documento + ') já está dentro sem registro de saída.', 'warn');
    return;
  }
  const pendenciasCadastro = obterPendenciasCadastroEntrada(dadosEntrada);
  if (direcionarCadastroPendente(pendenciasCadastro, dadosEntrada)) {
    atualizarBannerPendente();
    return;
  }

  const reg = {
    id: uid(),
    ...dadosEntrada,
    entrada: new Date().toISOString(),
    saida: null,
    status: 'Dentro'
  };
  DB.acessos.push(reg);
  saveDB('acessos', reg);
  ENTRADA_PENDENTE = null;
  atualizarBannerPendente();
  limparFormEntrada();
  toast('Entrada registrada: ' + reg.nome);
  showView('dashboard');
  oferecerCadastro(reg);
}

function retomarEntradaPendenteSePossivel() {
  if (!ENTRADA_PENDENTE?.reg) return;
  const reg = { ...ENTRADA_PENDENTE.reg };
  const pendencias = obterPendenciasCadastroEntrada(reg);
  if (pendencias.length) {
    ENTRADA_PENDENTE = { reg, pendencias: pendencias.slice() };
    direcionarCadastroPendente(pendencias, reg);
    return;
  }
  ENTRADA_PENDENTE = null;
  showView('entrada');
  preencherEntradaCom(reg);
  registrarEntrada();
}

/* ============================================================
   SAÍDA
   ============================================================ */

/* ============================================================
   FOTO — upload (com redução) + predisposição p/ webcam
   Usado nos cadastros de Visitante e Motorista.
   ============================================================ */
let fotoBuffer = '';        // foto selecionada no formulário aberto (data URL)
let ENTRADA_PENDENTE = null;
let _webcamStream = null;   // stream ativa, se houver
let _webcamCurrentDeviceId = '';

function fotoPlaceholderSVG() {
  return '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="9" r="3.2"/><path d="M5.5 19.5c0-3.4 2.9-5.2 6.5-5.2s6.5 1.8 6.5 5.2"/></svg>';
}

/* Bloco do campo de foto para reutilizar nos dois formulários. */
function fotoField() {
  return '<div class="field full"><label>Foto</label>' +
    '<div class="foto-box">' +
      '<div class="foto-preview" id="fotoPreview" title="Clique para enviar uma foto" onclick="document.getElementById(\'fotoInput\').click()"></div>' +
      '<div class="foto-side">' +
        '<div class="foto-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="capturarFotoWebcam()">Usar webcam</button>' +
          '<button type="button" class="btn btn-danger btn-sm" id="fotoRemover" onclick="removerFoto()" style="display:none">Remover</button>' +
        '</div>' +
        '<div class="muted" style="font-size:.72rem">Clique na foto para enviar um arquivo (JPG ou PNG) — a imagem é reduzida automaticamente. Webcam quando disponível (HTTPS).</div>' +
      '</div>' +
    '</div>' +
    '<div id="fotoWebcamPopover" class="foto-webcam-popover" style="display:none">' +
      '<div class="foto-webcam-card">' +
        '<div class="foto-webcam-head">' +
          '<strong>Visualização da webcam</strong>' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="pararWebcam()">Fechar</button>' +
        '</div>' +
        '<div class="foto-webcam-toolbar">' +
          '<label class="foto-webcam-picker">Câmera' +
            '<select id="fotoWebcamSelect" onchange="trocarWebcamSelecionada()">' +
              '<option value="">Carregando câmeras...</option>' +
            '</select>' +
          '</label>' +
        '</div>' +
        '<div class="foto-webcam-stage">' +
          '<video id="fotoVideo" autoplay playsinline muted></video>' +
        '</div>' +
        '<div class="foto-webcam-foot">' +
          '<div class="muted">Ajuste o enquadramento e capture quando a imagem estiver boa.</div>' +
          '<div class="foto-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" onclick="tirarFotoWebcam()">Capturar</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" onclick="pararWebcam()">Cancelar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<input type="file" id="fotoInput" accept="image/*" style="display:none" onchange="carregarFoto(event)"></div>';
}

/* Redimensiona qualquer imagem (data URL) para no máx. `max`px e devolve JPEG. */
function _resizeImg(srcDataUrl, cb, max) {
  const img = new Image();
  img.onload = function () {
    const m = max || 360;
    let w = img.width, h = img.height;
    if (w > h && w > m) { h = Math.round(h * m / w); w = m; }
    else if (h >= w && h > m) { w = Math.round(w * m / h); h = m; }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    cb(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = function () { toast('Não foi possível ler a imagem.', 'error'); };
  img.src = srcDataUrl;
}

function setFotoPreview(dataUrl) {
  fotoBuffer = dataUrl || '';
  const prev = document.getElementById('fotoPreview');
  const rem = document.getElementById('fotoRemover');
  if (!prev) return;
  if (fotoBuffer) {
    prev.innerHTML = '<img src="' + fotoBuffer + '" alt="Foto">';
    prev.classList.add('has');
    if (rem) rem.style.display = '';
  } else {
    prev.innerHTML = fotoPlaceholderSVG();
    prev.classList.remove('has');
    if (rem) rem.style.display = 'none';
  }
}

function carregarFoto(ev) {
  const f = ev.target.files[0];
  if (!f) return;
  if (!/^image\//.test(f.type)) { toast('Selecione um arquivo de imagem.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = function () { _resizeImg(reader.result, setFotoPreview, 360); };
  reader.readAsDataURL(f);
  ev.target.value = '';
}

function removerFoto() { setFotoPreview(''); }

function setFotoCarregando(on) {
  const prev = document.getElementById('fotoPreview');
  const btn = document.querySelector('#modalBody .btn-primary');
  if (prev) prev.classList.toggle('foto-loading', on);
  if (btn) { btn.disabled = on; btn.textContent = on ? 'Enviando…' : 'Salvar'; }
}

/* ----- Webcam (predisposição funcional) ----- */
function explainWebcamError(err) {
  const name = String(err?.name || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'O acesso à webcam foi bloqueado. Libere a câmera no navegador e no Windows, depois tente novamente.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhuma webcam foi encontrada neste dispositivo.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'A webcam já está em uso por outro aplicativo ou não pôde ser iniciada.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'A webcam disponível não aceitou o modo solicitado. Tente novamente.';
  }
  if (name === 'SecurityError') {
    return 'A webcam exige acesso por http://localhost ou https.';
  }
  return err?.message || 'Não foi possível acessar a webcam.';
}

function webcamBaseGuards() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Webcam indisponível neste contexto (requer HTTPS ou localhost).', 'warn');
    return false;
  }
  if (!window.isSecureContext) {
    toast('A webcam exige acesso por http://localhost ou https.', 'warn');
    return false;
  }
  return true;
}

function getWebcamConstraintList(deviceId) {
  if (deviceId) {
    return [
      { video: { deviceId: { exact: deviceId } }, audio: false },
      { video: { deviceId }, audio: false }
    ];
  }
  return [
    { video: { facingMode: 'user' }, audio: false },
    { video: true, audio: false }
  ];
}

async function atualizarListaWebcams() {
  const select = document.getElementById('fotoWebcamSelect');
  if (!select || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    if (!cams.length) {
      select.innerHTML = '<option value="">Nenhuma câmera encontrada</option>';
      select.disabled = true;
      return;
    }
    select.innerHTML = cams.map((cam, idx) => {
      const label = cam.label || ('Câmera ' + (idx + 1));
      const selected = cam.deviceId === _webcamCurrentDeviceId ? ' selected' : '';
      return '<option value="' + esc(cam.deviceId) + '"' + selected + '>' + esc(label) + '</option>';
    }).join('');
    select.disabled = cams.length <= 1;
    if (!_webcamCurrentDeviceId && cams[0]) {
      _webcamCurrentDeviceId = cams[0].deviceId;
      select.value = _webcamCurrentDeviceId;
    }
  } catch (err) {
    select.innerHTML = '<option value="">Não foi possível listar as câmeras</option>';
    select.disabled = true;
  }
}

async function iniciarWebcam(deviceId) {
  const pop = document.getElementById('fotoWebcamPopover');
  const video = document.getElementById('fotoVideo');
  if (!pop || !video) return;
  const constraintsList = getWebcamConstraintList(deviceId);
  let lastError = null;
  for (const constraints of constraintsList) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      pararWebcam(true);
      _webcamStream = stream;
      _webcamCurrentDeviceId = stream.getVideoTracks?.()[0]?.getSettings?.().deviceId || deviceId || '';
      pop.style.display = 'block';
      pop.classList.add('open');
      video.srcObject = stream;
      video.play().catch(() => {});
      await atualizarListaWebcams();
      return true;
    } catch (err) {
      lastError = err;
      const name = String(err?.name || '');
      if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError' && name !== 'NotFoundError') break;
    }
  }
  toast(explainWebcamError(lastError), 'error');
  return false;
}

async function capturarFotoWebcam() {
  if (!webcamBaseGuards()) return;
  await iniciarWebcam(_webcamCurrentDeviceId || '');
}

async function trocarWebcamSelecionada() {
  if (!webcamBaseGuards()) return;
  const select = document.getElementById('fotoWebcamSelect');
  if (!select) return;
  const nextDeviceId = select.value || '';
  if (!nextDeviceId || nextDeviceId === _webcamCurrentDeviceId) return;
  await iniciarWebcam(nextDeviceId);
}

function tirarFotoWebcam() {
  const v = document.getElementById('fotoVideo');
  if (!v) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const snap = c.toDataURL('image/jpeg', 0.9);
  pararWebcam(true);
  _resizeImg(snap, setFotoPreview, 360);
}

function pararWebcam(keepBuffer) {
  if (_webcamStream) { _webcamStream.getTracks().forEach(t => t.stop()); _webcamStream = null; }
  const video = document.getElementById('fotoVideo');
  if (video) video.srcObject = null;
  const pop = document.getElementById('fotoWebcamPopover');
  if (pop) {
    pop.classList.remove('open');
    pop.style.display = 'none';
  }
  if (!keepBuffer) setFotoPreview(fotoBuffer); // restaura o preview anterior
}

/* Miniatura para as listagens (foto ou inicial do nome). */
function fotoThumb(foto, nome) {
  if (foto) return '<span class="thumb thumb-click" onclick="abrirFotoPopover(\'' + esc(foto) + '\',\'' + esc(nome) + '\')" title="Ver foto de ' + esc(nome) + '"><img src="' + foto + '" alt=""></span>';
  const ini = String(nome || '?').trim().charAt(0).toUpperCase() || '?';
  return '<span class="thumb thumb-ph">' + esc(ini) + '</span>';
}

function abrirFotoPopover(src, nome) {
  let ov = document.getElementById('fotoPopoverOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'fotoPopoverOverlay';
    ov.innerHTML = '<div id="fotoPopoverBox"><img id="fotoPopoverImg" alt=""><div id="fotoPopoverNome"></div></div>';
    ov.addEventListener('click', () => ov.classList.remove('open'));
    document.body.appendChild(ov);
  }
  document.getElementById('fotoPopoverImg').src = src;
  document.getElementById('fotoPopoverNome').textContent = nome || '';
  ov.classList.add('open');
}

Object.assign(window, { abrirFotoPopover });

/* ============================================================
   CRUD — VISITANTES
   ============================================================ */
function renderVisitantes() {
  const q = norm(document.getElementById('visBusca').value);
  let rows = DB.visitantes.slice();
  if (q) rows = rows.filter(v => norm(v.nome).includes(q) || norm(v.documento).includes(q) || norm(v.empresa).includes(q));
  rows = sortRows(rows, 'visitantes');
  let html = '<thead><tr>' +
    thSort('visitantes', 'nome', 'Nome') + thSort('visitantes', 'documento', 'Documento') + thSort('visitantes', 'telefone', 'Telefone') +
    thSort('visitantes', 'empresa', 'Empresa') + thSort('visitantes', 'ativo', 'Status') + thSort('visitantes', 'obs', 'Obs.') +
    ((canWriteCadastros() || canDeleteCadastros()) ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + ((canWriteCadastros() || canDeleteCadastros()) ? 7 : 6) + '">Nenhum visitante cadastrado.</td></tr>';
  rows.forEach(v => {
    const actions = [
      canWriteCadastros() ? btnIcon('btn-ghost', 'Editar', 'abrirFormVisitante(\'' + v.id + '\')', ICO.edit) : '',
      canDeleteCadastros() ? btnIcon('btn-danger', 'Excluir', 'excluirVisitante(\'' + v.id + '\')', ICO.trash) : ''
    ].join('');
    html += '<tr><td><span class="cell-foto">' + fotoThumb(v.foto, v.nome) + '<strong>' + esc(v.nome) + '</strong></span></td><td class="mono">' + esc(v.documento) + '</td>' +
      '<td>' + esc(v.telefone || '—') + '</td><td>' + esc(v.empresa || '—') + '</td>' +
      '<td>' + (v.ativo ? '<span class="badge b-ativo">Ativo</span>' : '<span class="badge b-inativo">Inativo</span>') + '</td>' +
      '<td>' + esc(v.obs || '—') + '</td>' +
      (actions
        ? '<td class="actions">' + actions + '</td>'
        : '') + '</tr>';
  });
  document.getElementById('visTable').innerHTML = html + '</tbody>';
}

function abrirFormVisitante(idOrSeed) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil não pode alterar visitantes.')) return;
  const v = typeof idOrSeed === 'string' ? DB.visitantes.find(x => x.id === idOrSeed) : null;
  const seed = !v && idOrSeed && typeof idOrSeed === 'object' ? idOrSeed : null;
  abrirModal(v ? 'Editar visitante' : 'Novo visitante',
    '<div class="form-grid">' +
    fotoField() +
    campo('cv_nome', 'Nome *', v ? v.nome : (seed?.nome || '')) +
    campo('cv_doc', 'Documento *', v ? v.documento : (seed?.documento || '')) +
    campo('cv_tel', 'Telefone', v ? v.telefone : (seed?.telefone || '')) +
    campo('cv_empresa', 'Empresa', v ? v.empresa : (seed?.empresa || '')) +
    '<div class="field"><label>Status</label><select id="cv_ativo">' +
    '<option value="1"' + (!v || v.ativo ? ' selected' : '') + '>Ativo</option>' +
    '<option value="0"' + (v && !v.ativo ? ' selected' : '') + '>Inativo</option></select></div>' +
    '<div class="field full"><label>Observações</label><textarea id="cv_obs">' + esc(v ? v.obs : (seed?.obs || '')) + '</textarea></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarVisitante(' + (v ? '\'' + v.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
  setFotoPreview(v ? v.foto : '');
  bindDocumentoField('cv_doc');
}


/* ============================================================
   CRUD — MOTORISTAS
   ============================================================ */
function renderMotoristas() {
  const q = norm(document.getElementById('motBusca').value);
  let rows = DB.motoristas.slice();
  if (q) rows = rows.filter(m => norm(m.nome).includes(q) || norm(m.documento).includes(q) ||
    norm(m.transportadora).includes(q) || norm(m.placaPadrao).includes(q));
  rows = sortRows(rows, 'motoristas');
  let html = '<thead><tr>' +
    thSort('motoristas', 'nome', 'Nome') + thSort('motoristas', 'documento', 'CPF/RG/CNH') + thSort('motoristas', 'telefone', 'Telefone') +
    thSort('motoristas', 'transportadora', 'Transportadora') + thSort('motoristas', 'placaPadrao', 'Placa padrão') + thSort('motoristas', 'tipoVeiculo', 'Veículo') +
    thSort('motoristas', 'obs', 'Obs.') + ((canWriteCadastros() || canDeleteCadastros()) ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + ((canWriteCadastros() || canDeleteCadastros()) ? 8 : 7) + '">Nenhum motorista cadastrado.</td></tr>';
  rows.forEach(m => {
    const actions = [
      canWriteCadastros() ? btnIcon('btn-ghost', 'Editar', 'abrirFormMotorista(\'' + m.id + '\')', ICO.edit) : '',
      canDeleteCadastros() ? btnIcon('btn-danger', 'Excluir', 'excluirMotorista(\'' + m.id + '\')', ICO.trash) : ''
    ].join('');
    html += '<tr><td><span class="cell-foto">' + fotoThumb(m.foto, m.nome) + '<strong>' + esc(m.nome) + '</strong></span></td><td class="mono">' + esc(m.documento) + '</td>' +
      '<td>' + esc(m.telefone || '—') + '</td><td>' + esc(m.transportadora || '—') + '</td>' +
      '<td class="mono">' + esc(m.placaPadrao || '—') + '</td><td>' + esc(m.tipoVeiculo || '—') + '</td>' +
      '<td>' + esc(m.obs || '—') + '</td>' +
      (actions
        ? '<td class="actions">' + actions + '</td>'
        : '') + '</tr>';
  });
  document.getElementById('motTable').innerHTML = html + '</tbody>';
}

function abrirFormMotorista(idOrSeed) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil não pode alterar motoristas.')) return;
  const m = typeof idOrSeed === 'string' ? DB.motoristas.find(x => x.id === idOrSeed) : null;
  const seed = !m && idOrSeed && typeof idOrSeed === 'object' ? idOrSeed : null;
  const tipos = ['carro', 'moto', 'caminhão', 'carreta', 'utilitário', 'outro'];
  abrirModal(m ? 'Editar motorista' : 'Novo motorista',
    '<div class="form-grid">' +
    fotoField() +
    campo('cm_nome', 'Nome *', m ? m.nome : (seed?.nome || '')) +
    campo('cm_doc', 'CPF / RG / CNH *', m ? m.documento : (seed?.documento || '')) +
    campo('cm_tel', 'Telefone', m ? m.telefone : (seed?.telefone || '')) +
    campo('cm_transp', 'Transportadora', m ? m.transportadora : (seed?.transportadora || '')) +
    campo('cm_placa', 'Placa padrão', m ? m.placaPadrao : (seed?.placaPadrao || '')) +
    '<div class="field"><label>Tipo de veículo</label><select id="cm_tipoVeiculo">' +
    tipos.map(t => '<option value="' + t + '"' + (m && m.tipoVeiculo === t ? ' selected' : '') + '>' + t + '</option>').join('') +
    '</select></div>' +
    '<div class="field full"><label>Observações</label><textarea id="cm_obs">' + esc(m ? m.obs : (seed?.obs || '')) + '</textarea></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarMotorista(' + (m ? '\'' + m.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
  setFotoPreview(m ? m.foto : '');
  bindDocumentoField('cm_doc');
}


/* ============================================================
   CRUD — VEÍCULOS
   ============================================================ */
function renderVeiculos() {
  const q = norm(document.getElementById('veiBusca').value);
  let rows = DB.veiculos.slice();
  if (q) rows = rows.filter(v => norm(v.placa).includes(q) || norm(v.modelo).includes(q) || norm(v.proprietario).includes(q));
  rows = sortRows(rows, 'veiculos');
  let html = '<thead><tr>' +
    thSort('veiculos', 'placa', 'Placa') + thSort('veiculos', 'tipo', 'Tipo') + thSort('veiculos', 'modelo', 'Marca/Modelo') +
    thSort('veiculos', 'cor', 'Cor') + thSort('veiculos', 'proprietario', 'Proprietário/Empresa') + thSort('veiculos', 'motorista', 'Motorista') +
    thSort('veiculos', 'obs', 'Obs.') + ((canWriteCadastros() || canDeleteCadastros()) ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + ((canWriteCadastros() || canDeleteCadastros()) ? 8 : 7) + '">Nenhum veículo cadastrado.</td></tr>';
  rows.forEach(v => {
    const actions = [
      canWriteCadastros() ? btnIcon('btn-ghost', 'Editar', 'abrirFormVeiculo(\'' + v.id + '\')', ICO.edit) : '',
      canDeleteCadastros() ? btnIcon('btn-danger', 'Excluir', 'excluirVeiculo(\'' + v.id + '\')', ICO.trash) : ''
    ].join('');
    html += '<tr><td class="mono"><strong>' + esc(v.placa) + '</strong></td><td>' + badgeTipo(v.tipo) + '</td>' +
      '<td>' + esc(v.modelo || '—') + '</td><td>' + esc(v.cor || '—') + '</td>' +
      '<td>' + esc(v.proprietario || '—') + '</td><td>' + esc(v.motorista || '—') + '</td>' +
      '<td>' + esc(v.obs || '—') + '</td>' +
      (actions
        ? '<td class="actions">' + actions + '</td>'
        : '') + '</tr>';
  });
  document.getElementById('veiTable').innerHTML = html + '</tbody>';
}

function abrirFormVeiculo(idOrSeed) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil não pode alterar veículos.')) return;
  const v = typeof idOrSeed === 'string' ? DB.veiculos.find(x => x.id === idOrSeed) : null;
  const seed = !v && idOrSeed && typeof idOrSeed === 'object' ? idOrSeed : null;
  const tipos = ['carro', 'moto', 'caminhão', 'carreta', 'utilitário', 'outro'];
  const motoristas = DB.motoristas.map((m) => ({ nome: m.nome, documento: m.documento }));
  const motoristaSelecionado = normalizeDocumento(v?.motoristaDocumento || seed?.motoristaDocumento || '');
  abrirModal(v ? 'Editar veículo' : 'Novo veículo',
    '<div class="form-grid">' +
    campo('cve_placa', 'Placa *', v ? v.placa : (seed?.placa || '')) +
    '<div class="field"><label>Tipo</label><select id="cve_tipo">' +
    tipos.map(t => '<option value="' + t + '"' + (v && v.tipo === t ? ' selected' : '') + '>' + t + '</option>').join('') +
    '</select></div>' +
    campo('cve_modelo', 'Marca / Modelo', v ? v.modelo : (seed?.modelo || '')) +
    campo('cve_cor', 'Cor', v ? v.cor : (seed?.cor || '')) +
    campo('cve_prop', 'Proprietário / Empresa', v ? v.proprietario : (seed?.proprietario || '')) +
    '<div class="field"><label>Motorista vinculado</label><select id="cve_motorista">' +
    '<option value="">— Nenhum —</option>' +
    motoristas.map((m) => '<option value="' + esc(m.documento) + '"' + (motoristaSelecionado === normalizeDocumento(m.documento) ? ' selected' : '') + '>' + esc(m.nome) + '</option>').join('') +
    '</select></div>' +
    '<div class="field full"><label>Observações</label><textarea id="cve_obs">' + esc(v ? v.obs : (seed?.obs || '')) + '</textarea></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarVeiculo(' + (v ? '\'' + v.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
}


/* ============================================================
   CRUD — RAMAIS
   ============================================================ */
let ramalSort = { col: 'setor', dir: 1 };
let ramalSoEmrg = false;

function ordenarRamais(col) {
  if (ramalSort.col === col) ramalSort.dir *= -1;
  else { ramalSort.col = col; ramalSort.dir = 1; }
  renderRamais();
}

function toggleSoEmrg() {
  ramalSoEmrg = !ramalSoEmrg;
  const b = document.getElementById('ramalEmrgToggle');
  b.classList.toggle('btn-danger', ramalSoEmrg);
  b.classList.toggle('btn-ghost', !ramalSoEmrg);
  renderRamais();
}

function abrirFormRamal(id) {
  const r = id ? DB.ramais.find(x => x.id === id) : null;
  abrirModal(r ? 'Editar ramal' : 'Novo ramal',
    '<div class="form-grid form-grid-ramal">' +
    campo('cr_setor', 'Setor / Local *', r ? r.setor : '') +
    campo('cr_ramal', 'Ramal *', r ? r.ramal : '') +
    campo('cr_resp', 'Responsável', r ? r.responsavel : '') +
    '<div class="field"><label>Celular</label><input id="cr_celular" type="text" inputmode="numeric" maxlength="13" placeholder="51 99999 9999" oninput="mascaraCelular(this)" value="' + esc(r ? fmtCelular(r.celular) : '') + '"></div>' +
    '<div class="field"><label>E-mail</label><input id="cr_email" type="email" placeholder="nome@marcher.com.br" value="' + esc(r ? r.email : '') + '"></div>' +
    '<div class="field full"><label class="ac-proposta" style="margin:0" for="cr_emrg"><input type="checkbox" id="cr_emrg"' + (r && r.emergencia ? ' checked' : '') + '><span><strong>Contato de emergência</strong><br><span class="muted">Fica em destaque no topo da Lista de Ramais</span></span></label></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarRamal(' + (r ? '\'' + r.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
  document.getElementById('modalBox').classList.add('modal-ramal');
}


/* ============================================================
   ENTREGAS
   ============================================================ */
function abrirFormEntrega(id) {
  const e = id ? DB.entregas.find(x => x.id === id) : null;
  const tipos = [['recebimento', 'Recebimento'], ['retirada', 'Retirada'], ['coleta', 'Coleta'], ['interna', 'Entrega interna']];
  const status = [['pendente', 'Pendente'], ['recebido', 'Recebido'], ['entregue', 'Entregue'], ['cancelado', 'Cancelado']];
  abrirModal(e ? 'Editar entrega' : 'Nova entrega',
    '<div class="form-grid">' +
    '<div class="field"><label>Tipo *</label><select id="ce_tipo">' +
    tipos.map(t => '<option value="' + t[0] + '"' + (e && e.tipo === t[0] ? ' selected' : '') + '>' + t[1] + '</option>').join('') +
    '</select></div>' +
    campo('ce_fornecedor', 'Fornecedor / Transportadora *', e ? e.fornecedor : '') +
    campo('ce_motorista', 'Motorista', e ? e.motorista : '') +
    campo('ce_placa', 'Placa', e ? e.placa : '') +
    campo('ce_nf', 'Nota fiscal / Documento', e ? e.nf : '') +
    campo('ce_volumes', 'Quantidade de volumes', e ? e.volumes : '', 'number') +
    campo('ce_dest', 'Destinatário interno *', e ? e.destinatario : '') +
    campo('ce_setor', 'Setor responsável', e ? e.setor : '') +
    '<div class="field"><label>Status</label><select id="ce_status">' +
    status.map(s => '<option value="' + s[0] + '"' + (e && e.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') +
    '</select></div>' +
    '<div class="field full"><label>Descrição dos produtos</label><textarea id="ce_desc">' + esc(e ? e.descricao : '') + '</textarea></div>' +
    '<div class="field full"><label>Observações</label><textarea id="ce_obs">' + esc(e ? e.obs : '') + '</textarea></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarEntrega(' + (e ? '\'' + e.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
}


/* ============================================================
   HISTÓRICO
   ============================================================ */
function filtrarHistorico() {
  const fNome = norm(document.getElementById('h_nome').value);
  const fDoc = norm(document.getElementById('h_doc').value);
  const fEmp = norm(document.getElementById('h_empresa').value);
  const fPlaca = norm(document.getElementById('h_placa').value);
  const fTipo = document.getElementById('h_tipo').value;
  const fStatus = document.getElementById('h_status').value;
  const dIni = document.getElementById('h_dataIni').value;
  const dFim = document.getElementById('h_dataFim').value;

  return DB.acessos.filter(a => {
    if (fNome && !norm(a.nome).includes(fNome)) return false;
    if (fDoc && !norm(a.documento).includes(fDoc)) return false;
    if (fEmp && !norm(a.empresa).includes(fEmp)) return false;
    if (fPlaca && !norm(a.placa).includes(fPlaca)) return false;
    if (fTipo && a.tipo !== fTipo) return false;
    if (fStatus && a.status !== fStatus) return false;
    const dataEntrada = a.entrada.slice(0, 10);
    if (dIni && dataEntrada < dIni) return false;
    if (dFim && dataEntrada > dFim) return false;
    return true;
  }).sort((a, b) => b.entrada.localeCompare(a.entrada));
}

function renderHistorico() {
  const rows = sortRows(filtrarHistorico(), 'historico');
  let html = '<thead><tr>' +
    thSort('historico', 'entrada', 'Entrada') + thSort('historico', 'saida', 'Saída') + thSort('historico', 'tipo', 'Tipo') +
    thSort('historico', 'nome', 'Nome') + thSort('historico', 'documento', 'Documento') + thSort('historico', 'empresa', 'Empresa') +
    thSort('historico', 'placa', 'Placa') + thSort('historico', 'motivo', 'Motivo') + thSort('historico', 'visitado', 'Visitado') +
    thSort('historico', 'status', 'Status') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="10">Nenhum registro encontrado com os filtros atuais.</td></tr>';
  rows.forEach(a => {
    html += '<tr><td class="mono">' + fmtDataHora(a.entrada) + '</td><td class="mono">' + fmtDataHora(a.saida) + '</td>' +
      '<td>' + badgeTipo(a.tipo) + '</td><td><strong>' + esc(a.nome) + '</strong></td>' +
      '<td class="mono">' + esc(a.documento) + '</td><td>' + esc(a.empresa || '—') + '</td>' +
      '<td class="mono">' + esc(a.placa || '—') + '</td><td>' + esc(a.motivo || '—') + '</td>' +
      '<td>' + esc(a.visitado || '—') + '</td><td>' + badgeStatus(a.status) + '</td></tr>';
  });
  document.getElementById('histTable').innerHTML = html + '</tbody>';
  initFloatingScrollbar(document.getElementById('histTableWrap'));
}

let _floatingHScrollCleanup = null;
function initFloatingScrollbar(wrap) {
  if (_floatingHScrollCleanup) { _floatingHScrollCleanup(); _floatingHScrollCleanup = null; }
  if (!wrap) return;
  const track = document.createElement('div');
  track.className = 'floating-hscroll';
  const inner = document.createElement('div');
  inner.className = 'floating-hscroll-inner';
  track.appendChild(inner);
  document.body.appendChild(track);
  let syncing = false, visible = false;
  function updateGeometry() {
    const hasOverflow = wrap.scrollWidth > wrap.clientWidth;
    track.style.display = (visible && hasOverflow) ? 'block' : 'none';
    if (!visible || !hasOverflow) return;
    const rect = wrap.getBoundingClientRect();
    track.style.left = rect.left + 'px';
    track.style.width = rect.width + 'px';
    inner.style.width = wrap.scrollWidth + 'px';
    track.scrollLeft = wrap.scrollLeft;
  }
  function onWrapScroll() { if (!syncing) { syncing = true; track.scrollLeft = wrap.scrollLeft; syncing = false; } }
  function onTrackScroll() { if (!syncing) { syncing = true; wrap.scrollLeft = track.scrollLeft; syncing = false; } }
  wrap.addEventListener('scroll', onWrapScroll);
  track.addEventListener('scroll', onTrackScroll);
  const ro = new ResizeObserver(updateGeometry);
  ro.observe(wrap);
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; updateGeometry(); });
  io.observe(wrap);
  updateGeometry();
  _floatingHScrollCleanup = () => {
    wrap.removeEventListener('scroll', onWrapScroll);
    track.removeEventListener('scroll', onTrackScroll);
    ro.disconnect(); io.disconnect(); track.remove();
  };
}

function limparFiltrosHistorico() {
  ['h_nome','h_doc','h_empresa','h_placa','h_dataIni','h_dataFim'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('h_tipo').value = '';
  document.getElementById('h_status').value = '';
  renderHistorico();
  toast('Filtros do histórico limpos.');
}

function limparTodosFiltros() {
  ['h_nome','h_doc','h_empresa','h_placa','h_dataIni','h_dataFim','entregaBusca','saidaBusca','visBusca','motBusca','veiBusca'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('h_tipo').value = '';
  document.getElementById('h_status').value = '';
  document.getElementById('entregaStatusFiltro').value = '';
  renderAll();
  toast('Todos os filtros foram limpos.');
}

/* ============================================================
   EXPORTAÇÃO / BACKUP
   ============================================================ */
function downloadArquivo(nome, conteudo, mime) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCSV(headers, rows) {
  const sep = ';';
  const lines = [headers.map(csvCell).join(sep)];
  rows.forEach(r => lines.push(r.map(csvCell).join(sep)));
  return '\uFEFF' + lines.join('\r\n'); // BOM p/ Excel pt-BR
}

function exportarHistoricoCSV() {
  if (!ensureAllowed(canAccessReports(), 'Seu perfil não pode gerar relatórios.')) return;
  const rows = filtrarHistorico();
  if (!rows.length) { toast('Nenhum registro para exportar.', 'warn'); return; }
  const csv = toCSV(
    ['Entrada', 'Saida', 'Tipo', 'Nome', 'Documento', 'Empresa', 'Telefone', 'Placa', 'Motivo', 'Visitado', 'Status', 'Observacoes'],
    rows.map(a => [fmtDataHora(a.entrada), fmtDataHora(a.saida), a.tipo, a.nome, a.documento, a.empresa, a.telefone, a.placa, a.motivo, a.visitado, a.status, a.obs])
  );
  downloadArquivo('historico_portaria_' + dataArquivo() + '.csv', csv, 'text/csv;charset=utf-8');
  toast('Histórico exportado em CSV (' + rows.length + ' registros).');
}

function exportarEntregasCSV() {
  if (!ensureAllowed(canAccessReports(), 'Seu perfil não pode gerar relatórios.')) return;
  if (!DB.entregas.length) { toast('Nenhuma entrega para exportar.', 'warn'); return; }
  const csv = toCSV(
    ['Data', 'Tipo', 'Fornecedor/Transportadora', 'Motorista', 'Placa', 'NF/Documento', 'Descricao', 'Volumes', 'Destinatário', 'Setor', 'Status', 'Observacoes'],
    DB.entregas.map(e => [fmtDataHora(e.data), e.tipo, e.fornecedor, e.motorista, e.placa, e.nf, e.descricao, e.volumes, e.destinatario, e.setor, e.status, e.obs])
  );
  downloadArquivo('entregas_' + dataArquivo() + '.csv', csv, 'text/csv;charset=utf-8');
  toast('Entregas exportadas em CSV (' + DB.entregas.length + ' registros).');
}

function dataArquivo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function backupJSON() {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem gerar backup completo.')) return;
  downloadArquivo('backup_controla_marcher_' + dataArquivo() + '.json',
    JSON.stringify({ app: 'Controla Marcher', versao: 1, geradoEm: new Date().toISOString(), dados: DB }, null, 2),
    'application/json');
  toast('Backup JSON gerado.');
}

function restaurarJSON(ev) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem restaurar dados.')) {
    ev.target.value = '';
    return;
  }
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const obj = JSON.parse(reader.result);
      const dados = obj && obj.dados ? obj.dados : obj;
      if (!dados || !Array.isArray(dados.acessos)) {
        toast('Arquivo inválido: não é um backup do Controla Marcher.', 'error');
        return;
      }
      DB = {
        acessos: dados.acessos || [],
        visitantes: dados.visitantes || [],
        motoristas: dados.motoristas || [],
        veiculos: dados.veiculos || [],
        entregas: dados.entregas || [],
        ramais: Array.isArray(dados.ramais) ? dados.ramais : seedRamais()
      };
      saveDB();
      renderAll();
      toast('Dados restaurados com sucesso (' + DB.acessos.length + ' acessos).');
    } catch (e) {
      toast('Erro ao ler o arquivo JSON.', 'error');
    }
  };
  reader.readAsText(file, 'utf-8');
  ev.target.value = '';
}

async function carregarArquivados(force) {
  if (!canManageUsers()) return;
  const tipo = document.getElementById('arquivadosTipo')?.value || 'visitantes';
  if (!force && Array.isArray(ARQUIVADOS[tipo]) && ARQUIVADOS[tipo].length) {
    renderArquivados();
    return;
  }
  try {
    if (!PERFIS_USUARIOS.length) PERFIS_USUARIOS = await loadProfilesRemote();
    ARQUIVADOS[tipo] = await repo.loadArchived(tipo);
    renderArquivados();
  } catch (e) {
    toast(e.message || 'Falha ao carregar arquivados.', 'error');
  }
}

function archiveMainLabel(tipo, row) {
  if (tipo === 'visitantes' || tipo === 'motoristas') return row.nome || 'Sem nome';
  if (tipo === 'veiculos') return row.placa || 'Sem placa';
  if (tipo === 'ramais') return row.setor || 'Sem setor';
  if (tipo === 'entregas') return row.fornecedor || 'Sem fornecedor';
  return row.id || 'Registro';
}

function archiveSubLabel(tipo, row) {
  if (tipo === 'visitantes') return row.documento || 'Sem documento';
  if (tipo === 'motoristas') return (row.documento || 'Sem documento') + (row.transportadora ? ' · ' + row.transportadora : '');
  if (tipo === 'veiculos') return (row.modelo || 'Sem modelo') + (row.proprietario ? ' · ' + row.proprietario : '');
  if (tipo === 'ramais') return (row.ramal || 'Sem ramal') + (row.responsavel ? ' · ' + row.responsavel : '');
  if (tipo === 'entregas') return (row.nf || 'Sem NF') + (row.destinatario ? ' · ' + row.destinatario : '');
  return row.id || '';
}

function archiveDeletedByLabel(row) {
  const userId = row.deleted_by || '';
  const user = (PERFIS_USUARIOS || []).find((u) => u.id === userId);
  if (user) {
    const nome = ((user.nome || '') + ' ' + (user.sobrenome || '')).trim();
    return nome || user.email || userId;
  }
  return userId || 'Não identificado';
}

function renderArquivados() {
  const host = document.getElementById('arquivadosTable');
  const tipo = document.getElementById('arquivadosTipo')?.value || 'visitantes';
  if (!host || !canManageUsers()) return;
  const rows = Array.isArray(ARQUIVADOS[tipo]) ? ARQUIVADOS[tipo] : [];
  let html = '<thead><tr><th>Registro</th><th>Arquivado em</th><th>Arquivado por</th><th></th></tr></thead><tbody>';
  if (!rows.length) {
    html += '<tr class="empty-row"><td colspan="4">Nenhum registro arquivado em ' + archiveEntityLabel(tipo).toLowerCase() + '.</td></tr>';
  }
  rows.forEach((row) => {
    html += '<tr>' +
      '<td><div class="restore-meta"><span class="restore-main">' + esc(archiveMainLabel(tipo, row)) + '</span><span class="restore-sub">' + esc(archiveSubLabel(tipo, row)) + '</span></div></td>' +
      '<td class="mono">' + esc(fmtDataHora(row.deleted_at)) + '</td>' +
      '<td>' + esc(archiveDeletedByLabel(row)) + '</td>' +
      '<td class="actions">' + btnIcon('btn-success', 'Restaurar', 'restaurarArquivado(\'' + tipo + '\', \'' + row.id + '\')', ICO.check) + '</td>' +
      '</tr>';
  });
  host.innerHTML = html + '</tbody>';
}

async function restaurarArquivado(tipo, id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem restaurar registros arquivados.')) return;
  const row = (ARQUIVADOS[tipo] || []).find((item) => item.id === id);
  if (!row) return;
  const restored = Object.assign({}, row, { deleted_at: null, deleted_by: null });
  try {
    await repo.saveRow(tipo, restored);
    ARQUIVADOS[tipo] = (ARQUIVADOS[tipo] || []).filter((item) => item.id !== id);
    await loadData();
    renderAll();
    renderArquivados();
    toast('Registro restaurado em ' + archiveEntityLabel(tipo) + '.');
  } catch (e) {
    toast(e.message || 'Falha ao restaurar registro arquivado.', 'error');
  }
}

async function carregarAuditoria(force) {
  if (!canManageUsers()) return;
  if (!force && Array.isArray(AUDITORIA) && AUDITORIA.length) {
    renderAuditoria();
    return;
  }
  try {
    if (!PERFIS_USUARIOS.length) PERFIS_USUARIOS = await loadProfilesRemote();
    AUDITORIA = await repo.loadAuditLogs({ limit: 120 });
    renderAuditoria();
  } catch (e) {
    toast(e.message || 'Falha ao carregar auditoria.', 'error');
  }
}

function auditActionLabel(action) {
  const key = String(action || '').toUpperCase();
  if (key === 'INSERT') return 'Criação';
  if (key === 'UPDATE') return 'Edição';
  if (key === 'DELETE') return 'Exclusão';
  return key || 'A\u00E7\u00E3o';
}

function auditActionBadge(action) {
  const key = String(action || '').toUpperCase();
  const cls = key === 'INSERT' ? 'b-dentro' : key === 'DELETE' ? 'b-problema' : 'b-pendente';
  return '<span class="badge ' + cls + '">' + auditActionLabel(key) + '</span>';
}

function auditActorLabel(row) {
  const userId = row.actor_user_id || '';
  const user = (PERFIS_USUARIOS || []).find((u) => u.id === userId);
  if (user) {
    const nome = ((user.nome || '') + ' ' + (user.sobrenome || '')).trim();
    return nome || user.email || userId;
  }
  return row.actor_role || userId || 'Sistema';
}

function pickAuditRecord(row) {
  return row.new_data || row.old_data || {};
}

function auditMainLabel(row) {
  const ref = pickAuditRecord(row);
  if (row.tabela === 'visitantes' || row.tabela === 'motoristas') return ref.nome || 'Sem nome';
  if (row.tabela === 'veiculos') return ref.placa || 'Sem placa';
  if (row.tabela === 'acessos') return ref.nome || 'Sem nome';
  if (row.tabela === 'ramais') return ref.setor || 'Sem setor';
  if (row.tabela === 'entregas') return ref.fornecedor || 'Sem fornecedor';
  return row.registro_id || 'Registro';
}

function auditSubLabel(row) {
  const ref = pickAuditRecord(row);
  if (row.tabela === 'visitantes') return ref.documento || 'Sem documento';
  if (row.tabela === 'motoristas') return (ref.documento || 'Sem documento') + (ref.transportadora ? ' · ' + ref.transportadora : '');
  if (row.tabela === 'veiculos') return (ref.modelo || 'Sem modelo') + (ref.proprietario ? ' · ' + ref.proprietario : '');
  if (row.tabela === 'acessos') return (ref.documento || 'Sem documento') + (ref.empresa ? ' · ' + ref.empresa : '');
  if (row.tabela === 'ramais') return (ref.ramal || 'Sem ramal') + (ref.responsavel ? ' · ' + ref.responsavel : '');
  if (row.tabela === 'entregas') return (ref.nf || 'Sem NF') + (ref.destinatario ? ' · ' + ref.destinatario : '');
  return row.registro_id || '';
}

function renderAuditoria() {
  const host = document.getElementById('auditoriaTable');
  const tabela = document.getElementById('auditoriaTabela')?.value || '';
  const acao = document.getElementById('auditoriaAcao')?.value || '';
  if (!host || !canManageUsers()) return;
  const rows = (AUDITORIA || []).filter((row) =>
    (!tabela || row.tabela === tabela) &&
    (!acao || String(row.acao || '').toUpperCase() === acao)
  );
  let html = '<thead><tr><th>A\u00E7\u00E3o</th><th>Registro</th><th>Usu\u00E1rio</th><th>Data / hora</th></tr></thead><tbody>';
  if (!rows.length) {
    html += '<tr class="empty-row"><td colspan="4">Nenhum evento encontrado para os filtros aplicados.</td></tr>';
  }
  rows.forEach((row) => {
    html += '<tr>' +
      '<td><div class="audit-meta"><span>' + auditActionBadge(row.acao) + '</span><span class="audit-sub">' + esc(archiveEntityLabel(row.tabela)) + '</span></div></td>' +
      '<td><div class="audit-meta"><span class="audit-main">' + esc(auditMainLabel(row)) + '</span><span class="audit-sub">' + esc(auditSubLabel(row)) + '</span></div></td>' +
      '<td>' + esc(auditActorLabel(row)) + '</td>' +
      '<td class="mono">' + esc(fmtDataHora(row.created_at)) + '</td>' +
      '</tr>';
  });
  host.innerHTML = html + '</tbody>';
}

/* ============================================================
   BUSCA GLOBAL
   ============================================================ */
const searchInput = document.getElementById('globalSearch');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', debounce(function () {
  const q = norm(this.value.trim());
  if (q.length < 2) { searchResults.classList.remove('open'); return; }
  const hits = [];

  DB.acessos.forEach(a => {
    if (norm(a.nome).includes(q) || norm(a.documento).includes(q) || norm(a.placa).includes(q) || norm(a.empresa).includes(q)) {
      hits.push({ type: 'Acesso', view: 'historico', main: a.nome, sub: a.documento + ' · ' + (a.empresa || 'sem empresa') + ' · ' + fmtDataHora(a.entrada), status: a.status });
    }
  });
  DB.visitantes.forEach(v => {
    if (norm(v.nome).includes(q) || norm(v.documento).includes(q) || norm(v.empresa).includes(q)) {
      hits.push({ type: 'Visitante', view: 'visitantes', main: v.nome, sub: v.documento + ' · ' + (v.empresa || '—') });
    }
  });
  DB.motoristas.forEach(m => {
    if (norm(m.nome).includes(q) || norm(m.documento).includes(q) || norm(m.placaPadrao).includes(q) || norm(m.transportadora).includes(q)) {
      hits.push({ type: 'Motorista', view: 'motoristas', main: m.nome, sub: (m.transportadora || '—') + ' · ' + (m.placaPadrao || 'sem placa') });
    }
  });
  DB.veiculos.forEach(v => {
    if (norm(v.placa).includes(q) || norm(v.modelo).includes(q) || norm(v.proprietario).includes(q)) {
      hits.push({ type: 'Veículo', view: 'veiculos', main: v.placa + ' — ' + (v.modelo || ''), sub: v.proprietario || '—' });
    }
  });
  DB.entregas.forEach(e => {
    if (norm(e.fornecedor).includes(q) || norm(e.nf).includes(q) || norm(e.placa).includes(q) || norm(e.motorista).includes(q)) {
      hits.push({ type: 'Entrega', view: 'entregas', main: e.fornecedor + ' · ' + (e.nf || 'sem NF'), sub: fmtDataHora(e.data) + ' · ' + e.status });
    }
  });
  DB.ramais.forEach(r => {
    if (norm(r.setor).includes(q) || norm(r.ramal).includes(q) || norm(r.responsavel).includes(q) || norm(r.celular).includes(q) || norm(r.email).includes(q)) {
      hits.push({ type: 'Ramal', view: 'ramais', main: r.setor + ' — ramal ' + r.ramal, sub: (r.responsavel || '—') + (r.celular ? ' · ' + r.celular : '') });
    }
  });

  if (!hits.length) {
    searchResults.innerHTML = '<div class="sr-empty">Nenhum resultado para "' + esc(this.value) + '".</div>';
  } else {
    searchResults.innerHTML = hits.filter((h) => canAccessView(h.view)).slice(0, 12).map((h, i) =>
      '<div class="sr-item" data-view="' + h.view + '">' +
      '<div class="sr-type">' + h.type + (h.status ? ' · ' + h.status : '') + '</div>' +
      '<div><strong>' + esc(h.main) + '</strong></div>' +
      '<div class="muted">' + esc(h.sub) + '</div></div>'
    ).join('');
    if (!searchResults.innerHTML) {
      searchResults.innerHTML = '<div class="sr-empty">Nenhum resultado disponível para o seu perfil.</div>';
    }
    searchResults.querySelectorAll('.sr-item').forEach(el => {
      el.addEventListener('click', () => {
        searchResults.classList.remove('open');
        searchInput.value = '';
        showView(el.dataset.view);
      });
    });
  }
  searchResults.classList.add('open');
}, 300));

document.addEventListener('click', function (e) {
  if (!e.target.closest('.search-wrap')) searchResults.classList.remove('open');
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { searchResults.classList.remove('open'); fecharModal(); }
});

/* ---------- Helpers de formulário ---------- */
function campo(id, label, valor, tipo) {
  const obrig = label.includes('*');
  const lbl = label.replace(' *', '');
  return '<div class="field"><label>' + esc(lbl) + (obrig ? ' <span class="req">*</span>' : '') + '</label>' +
    '<input id="' + id + '" type="' + (tipo || 'text') + '" value="' + esc(valor == null ? '' : valor) + '"></div>';
}

/* ============================================================
   AUTOCOMPLETE — Controle de Entrada (puxa dos cadastros)
   ============================================================ */

/* Match tolerante: ignora acento/caixa e também pontuação
   (ex.: "12345678" casa com "123.456.78-9"; "abc1d23" casa com "ABC1D23"). */
function temMatch(campo, q) {
  const c = norm(campo);
  if (c.includes(q)) return true;
  const cs = c.replace(/[^a-z0-9]/g, '');
  const qs = q.replace(/[^a-z0-9]/g, '');
  return qs.length >= 2 && cs.includes(qs);
}

/* Sugestões de PESSOA (visitantes + motoristas) — usado em Nome e Documento. */
function sugestoesPessoa(q) {
  const out = [];
  DB.visitantes.forEach(v => {
    if (temMatch(v.nome, q) || temMatch(v.documento, q) || temMatch(v.empresa, q)) {
      out.push({
        tag: 'Visitante', inativo: !v.ativo,
        label: v.nome,
        sub: v.documento + (v.empresa ? ' · ' + v.empresa : '') + (v.telefone ? ' · ' + v.telefone : ''),
        payload: { tipo: 'visitante', nome: v.nome, documento: v.documento, telefone: v.telefone || '', empresa: v.empresa || '', placa: '' }
      });
    }
  });
  DB.motoristas.forEach(m => {
    if (temMatch(m.nome, q) || temMatch(m.documento, q) || temMatch(m.transportadora, q) || temMatch(m.placaPadrao, q)) {
      out.push({
        tag: 'Motorista', inativo: m.ativo === false,
        label: m.nome,
        sub: m.documento + (m.transportadora ? ' · ' + m.transportadora : '') + (m.placaPadrao ? ' · ' + m.placaPadrao : ''),
        payload: { tipo: 'motorista', nome: m.nome, documento: m.documento, telefone: m.telefone || '', empresa: m.transportadora || '', placa: m.placaPadrao || '' }
      });
    }
  });
  return out;
}

/* Sugestões de VEÍCULO (veículos cadastrados + placas padrão de motoristas) — usado em Placa.
   Ao escolher, tenta completar com o motorista vinculado. */
function sugestoesVeiculo(q) {
  const out = [];
  const placasVistas = new Set();
  DB.veiculos.forEach(v => {
    if (temMatch(v.placa, q) || temMatch(v.modelo, q) || temMatch(v.proprietario, q) || temMatch(v.motorista, q)) {
      placasVistas.add(normalizePlaca(v.placa));
      const mot = DB.motoristas.find((m) => {
        if (v.motoristaDocumento) return normalizeDocumento(m.documento) === normalizeDocumento(v.motoristaDocumento);
        return normalizePlaca(m.placaPadrao) && normalizePlaca(m.placaPadrao) === normalizePlaca(v.placa);
      }) || null;
      out.push({
        tag: 'Veículo',
        label: v.placa + (v.modelo ? ' — ' + v.modelo : ''),
        sub: (v.proprietario || 'sem proprietário') + (v.motorista ? ' · ' + v.motorista : ''),
        payload: {
          tipo: mot ? 'motorista' : '',
          placa: v.placa,
          nome: mot ? mot.nome : '',
          documento: mot ? mot.documento : '',
          telefone: mot ? (mot.telefone || '') : '',
          empresa: mot ? (mot.transportadora || v.proprietario || '') : (v.proprietario || '')
        }
      });
    }
  });
  DB.motoristas.forEach(m => {
    if (m.placaPadrao && temMatch(m.placaPadrao, q) && !placasVistas.has(normalizePlaca(m.placaPadrao))) {
      out.push({
        tag: 'Placa padrão',
        label: m.placaPadrao + ' — ' + m.nome,
        sub: 'Motorista' + (m.transportadora ? ' · ' + m.transportadora : ''),
        payload: { tipo: 'motorista', placa: m.placaPadrao, nome: m.nome, documento: m.documento, telefone: m.telefone || '', empresa: m.transportadora || '' }
      });
    }
  });
  return out;
}

/* Preenche o formulário de entrada sem apagar o que já foi digitado
   (só sobrescreve campos para os quais o cadastro tem valor). */
function preencherEntradaCom(p) {
  const set = (id, val) => { if (val != null && val !== '') document.getElementById(id).value = val; };
  if (p.tipo) document.getElementById('e_tipo').value = p.tipo;
  set('e_nome', p.nome);
  set('e_doc', p.documento);
  set('e_empresa', p.empresa);
  set('e_tel', p.telefone);
  set('e_placa', p.placa);
  toast('Cadastro carregado: ' + (p.nome || p.placa));
}

/* Componente genérico de autocomplete preso a um input. */
function setupAutocomplete(inputId, getSugestoes, aoSelecionar) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const host = input.parentElement;
  host.classList.add('ac-host');
  const box = document.createElement('div');
  box.className = 'ac-results';
  host.appendChild(box);
  let itens = [];
  let ativo = -1;

  function fechar() { box.classList.remove('open'); ativo = -1; }

  function render() {
    if (!itens.length) {
      box.innerHTML = '<div class="ac-empty">Nenhum cadastro corresponde.</div>';
      box.classList.add('open');
      return;
    }
    box.innerHTML = itens.map((it, i) =>
      '<div class="ac-item' + (i === ativo ? ' active' : '') + '" data-i="' + i + '">' +
      '<div class="ac-main"><span class="ac-tag' + (it.inativo ? ' inativo' : '') + '">' + esc(it.tag) + '</span>' +
      '<strong>' + esc(it.label) + '</strong>' + (it.inativo ? ' <span class="muted">(inativo)</span>' : '') + '</div>' +
      '<div class="ac-sub">' + esc(it.sub) + '</div></div>'
    ).join('');
    box.classList.add('open');
    box.querySelectorAll('.ac-item').forEach(el => {
      el.addEventListener('mousedown', (e) => { // mousedown dispara antes do blur do input
        e.preventDefault();
        escolher(parseInt(el.dataset.i, 10));
      });
    });
  }

  function escolher(i) {
    const it = itens[i];
    if (!it) return;
    aoSelecionar(it.payload);
    fechar();
  }

  input.addEventListener('input', debounce(function () {
    const q = norm(this.value.trim());
    if (q.length < 2) { fechar(); return; }
    itens = getSugestoes(q).slice(0, 8);
    ativo = -1;
    render();
  }, 200));

  input.addEventListener('keydown', function (e) {
    if (!box.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); ativo = Math.min(ativo + 1, itens.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = Math.max(ativo - 1, 0); render(); }
    else if (e.key === 'Enter') { if (ativo >= 0) { e.preventDefault(); escolher(ativo); } }
    else if (e.key === 'Escape') { fechar(); }
  });

  input.addEventListener('blur', () => setTimeout(fechar, 120));
}

setupAutocomplete('e_nome', sugestoesPessoa, preencherEntradaCom);
setupAutocomplete('e_doc', sugestoesPessoa, preencherEntradaCom);
setupAutocomplete('e_placa', sugestoesVeiculo, preencherEntradaCom);
bindDocumentoField('e_doc');

/* ============================================================
   ÁREA DO USUÁRIO (protótipo — perfis de acesso evoluem depois)
   ============================================================ */
const LIMITE_NOME = 18;   // nome + sobrenome exibidos no rodapé
const USER_KEY = 'controlaMarcher_user';

let USUARIO = { nome: 'Ricardo', sobrenome: 'Guimaraes', celular: '', email: '', perfil: ROLE_SUPER_ADMIN, foto: '' };
try {
  const u = JSON.parse(localStorage.getItem(USER_KEY));
  if (u && typeof u === 'object') USUARIO = Object.assign(USUARIO, u);
} catch (e) { /* ignora */ }

function saveUsuario() {
  try { localStorage.setItem(USER_KEY, JSON.stringify(USUARIO)); } catch (e) { /* ignora */ }
}

function renderUserCard() {
  const card = document.getElementById('userCard');
  if (!card) return;
  const nomeExib = (USUARIO.nome + ' ' + (USUARIO.sobrenome || '')).trim();
  const avatar = USUARIO.foto
    ? '<img src="' + USUARIO.foto + '" alt="">'
    : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3.2"/><path d="M5.5 19.5c0-3.4 2.9-5.2 6.5-5.2s6.5 1.8 6.5 5.2"/></svg>';
  card.innerHTML =
    '<div class="user-avatar">' + avatar + '</div>' +
    '<div class="user-info">' +
    '<div class="user-name">' + esc(nomeExib) + '</div>' +
    '<div class="user-role">' + esc(USUARIO.perfil) + '</div>' +
    '</div>';
}


function perfilBadge(perfil) {
  const normalizado = normalizeRole(perfil);
  const cls = normalizado === ROLE_SUPER_ADMIN
    ? 'perfil-super-admin'
    : normalizado === ROLE_ADMIN
      ? 'perfil-admin'
      : normalizado === ROLE_SEGURANCA
        ? 'perfil-seguranca'
        : 'perfil-consulta';
  return '<span class="perfil-chip ' + cls + '">' + esc(normalizado) + '</span>';
}

function statusBadge(ativo) {
  return ativo === false
    ? '<span class="badge b-inativo">Inativo</span>'
    : '<span class="badge b-ativo">Ativo</span>';
}

async function recarregarUsuarios() {
  if (!canManageUsers()) return;
  try {
    PERFIS_USUARIOS = await loadProfilesRemote();
    renderUsuarios();
  } catch (e) {
    toast(e.message || 'Falha ao carregar usuários.', 'error');
  }
}

async function salvarPerfilUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem alterar perfis.')) return;
  if (USUARIO.id && id === USUARIO.id) {
    toast('Seu próprio perfil deve ser mantido como está nesta tela.', 'warn');
    return;
  }
  const el = document.getElementById('perfil_' + id);
  if (!el) return;
  const perfilDestino = normalizeRole(el.value);
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!canEditUserRole(usuarioAlvo?.perfil) || !getAssignableRoles().includes(perfilDestino)) {
    toast('Seu perfil não pode aplicar essa alteração.', 'warn');
    return;
  }
  try {
    await updateProfileRoleRemote(id, perfilDestino);
    await recarregarUsuarios();
    toast('Perfil atualizado com sucesso.');
  } catch (e) {
    toast(e.message || 'Falha ao atualizar perfil.', 'error');
  }
}

function abrirAjudaCadastroUsuario() {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem cadastrar usuários.')) return;
  const perfisDisponiveis = getAssignableRoles();
  abrirModal('Cadastrar usuário',
    '<div class="form-grid">' +
    '<div class="field full"><label>E-mail <span class="req">*</span></label><input id="novoUserEmail" type="email" placeholder="nome@empresa.com.br"></div>' +
    '<div class="field full"><label>Perfil inicial</label><select id="novoUserPerfil">' +
    perfisDisponiveis.map((perfil) => '<option value="' + perfil + '">' + perfil + '</option>').join('') +
    '</select></div>' +
    '<div class="field full"><div class="muted">O sistema vai enviar um e-mail para a pessoa concluir o cadastro, definir a senha e entrar com o perfil escolhido.</div></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="cadastrarUsuarioConvite()">Enviar convite</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>', true);
}

async function cadastrarUsuarioConvite() {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem cadastrar usuários.')) return;
  const email = document.getElementById('novoUserEmail')?.value.trim().toLowerCase();
  const perfil = normalizeRole(document.getElementById('novoUserPerfil')?.value || ROLE_CONSULTA);
  if (!email) {
    toast('Informe o e-mail do usuário.', 'error');
    return;
  }
  if (!getAssignableRoles().includes(perfil)) {
    toast('Seu perfil não pode convidar usuários com esse papel.', 'warn');
    return;
  }
  try {
    await inviteUserRemote(email, perfil);
    fecharModal();
    await recarregarUsuarios();
    toast('Convite enviado para ' + email + '.');
  } catch (e) {
    toast(e.message || 'Falha ao enviar convite.', 'error');
  }
}

function renderUsuarios() {
  const host = document.getElementById('usersTable');
  if (!host) return;
  if (!canManageUsers()) {
    host.innerHTML = '<tbody><tr class="empty-row"><td>Somente Admin e Super Admin acessam esta ?rea.</td></tr></tbody>';
    return;
  }
  const q = norm((document.getElementById('usuariosBusca')?.value || '').trim());
  const rows = (PERFIS_USUARIOS || []).filter((u) => {
    if (!q) return true;
    return norm((u.nome || '') + ' ' + (u.sobrenome || '')).includes(q)
      || norm(u.email || '').includes(q)
      || norm(u.perfil || '').includes(q);
  });
  let html = '<thead><tr><th>Usu\u00E1rio</th><th>E-mail</th><th>Perfil atual</th><th>Trocar perfil</th><th></th></tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="5">Nenhum usu\u00E1rio encontrado.</td></tr>';
  rows.forEach((u) => {
    const perfilAtual = normalizeRole(u.perfil);
    const nome = ((u.nome || '') + ' ' + (u.sobrenome || '')).trim() || 'Sem nome';
    const locked = USUARIO.id && u.id === USUARIO.id;
    const bloqueadoPorPapel = !canEditUserRole(perfilAtual);
    const disabled = locked || bloqueadoPorPapel;
    const opcoesPerfil = getAssignableRoles().includes(perfilAtual)
      ? getAssignableRoles()
      : [perfilAtual].concat(getAssignableRoles());
    html += '<tr><td><strong>' + esc(nome) + '</strong></td>' +
      '<td>' + esc(u.email || '\u2014') + '</td>' +
      '<td><div class="users-status-cell">' + perfilBadge(perfilAtual) + statusBadge(u.ativo) + '</div></td>' +
      '<td><select id="perfil_' + u.id + '"' + (disabled ? ' disabled' : '') + '>' +
      opcoesPerfil.map((perfil) => '<option value="' + perfil + '"' + (perfilAtual === perfil ? ' selected' : '') + '>' + perfil + '</option>').join('') +
      '</select></td>' +
      '<td>' + (locked
        ? '<span class="users-lock">Usu\u00E1rio atual</span>'
        : bloqueadoPorPapel
          ? '<span class="users-lock">Somente Super Admin</span>'
          : '<div class="users-actions">' +
              btnIcon('btn-primary', 'Salvar perfil', 'salvarPerfilUsuario(\'' + u.id + '\')', ICO.check) +
              btnIcon('btn-secondary', 'Definir nova senha', 'abrirNovaSenhaUsuario(\'' + u.id + '\')', ICO.key) +
              btnIcon(u.ativo === false ? 'btn-success' : 'btn-ghost', u.ativo === false ? 'Ativar usu\u00E1rio' : 'Desativar usu\u00E1rio', 'alternarStatusUsuario(\'' + u.id + '\')', ICO.power) +
              btnIcon('btn-danger', 'Excluir usu\u00E1rio', 'excluirUsuario(\'' + u.id + '\')', ICO.trash) +
            '</div>') + '</td></tr>';
  });
  host.innerHTML = html + '</tbody>';
}

function abrirAreaUsuario() {
  const u = USUARIO;
  abrirModal('\u00C1rea do usu\u00E1rio',
    '<div class="form-grid">' +
    fotoField() +
    '<div class="field"><label>Nome <span class="req">*</span></label><input id="us_nome" type="text" maxlength="' + LIMITE_NOME + '" placeholder="Nome" value="' + esc(u.nome) + '"></div>' +
    '<div class="field"><label>Sobrenome</label><input id="us_sobrenome" type="text" maxlength="' + LIMITE_NOME + '" placeholder="Sobrenome" value="' + esc(u.sobrenome || '') + '"></div>' +
    '<div class="field"><label>Celular</label><input id="us_celular" type="text" inputmode="numeric" maxlength="13" placeholder="51 99999 9999" oninput="mascaraCelular(this)" value="' + esc(fmtCelular(u.celular)) + '"></div>' +
    '<div class="field"><label>E-mail</label><input id="us_email" type="email" placeholder="nome@marcher.com.br" value="' + esc(u.email || '') + '"></div>' +
    '<div class="field"><label>Perfil de acesso</label><div>' + perfilBadge(u.perfil || 'Consulta') + '</div></div>' +
    '<div class="field full"><div class="muted" style="font-size:.74rem">Seu perfil \u00E9 gerenciado pelo administrador na tela Usu\u00E1rios e Perfis.</div></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarUsuario()">Salvar</button>' +
    '<button class="btn btn-secondary" onclick="logoutUsuario()">Sair</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
  setFotoPreview(u.foto || '');
}

async function logoutUsuario() {
  try {
    await logout();
  } catch (e) {
    toast(e.message || 'Falha ao sair do sistema.', 'error');
  }
}

function abrirNovaSenhaUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem alterar usu\u00E1rios.')) return;
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!usuarioAlvo) return;
  if (USUARIO.id && id === USUARIO.id) {
    toast('Use "Esqueci minha senha" para redefinir sua pr\u00F3pria senha.', 'warn');
    return;
  }
  if (!canEditUserRole(usuarioAlvo.perfil)) {
    toast('Seu perfil n\u00E3o pode alterar este usu\u00E1rio.', 'warn');
    return;
  }
  const nome = ((usuarioAlvo.nome || '') + ' ' + (usuarioAlvo.sobrenome || '')).trim() || usuarioAlvo.email || 'Sem nome';
  abrirModal('Definir nova senha',
    '<div class="form-grid">' +
    '<div class="field full"><div class="muted">Defina uma nova senha para <strong>' + esc(nome) + '</strong>. O usu\u00E1rio poder\u00E1 entrar imediatamente com ela.</div></div>' +
    '<div class="field"><label>Nova senha <span class="req">*</span></label><input id="user_password_new" type="password" minlength="6" autocomplete="new-password" placeholder="M\u00EDnimo de 6 caracteres"></div>' +
    '<div class="field"><label>Confirmar senha <span class="req">*</span></label><input id="user_password_confirm" type="password" minlength="6" autocomplete="new-password" placeholder="Repita a nova senha"></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="confirmarNovaSenhaUsuario(\'' + id + '\')">Salvar nova senha</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>', true);
}
async function confirmarNovaSenhaUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem alterar usu\u00E1rios.')) return;
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!usuarioAlvo) return;
  const senha = document.getElementById('user_password_new')?.value || '';
  const confirmarSenha = document.getElementById('user_password_confirm')?.value || '';
  if (!senha || senha.length < 6) {
    toast('A nova senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }
  if (senha !== confirmarSenha) {
    toast('A confirma\u00E7\u00E3o da senha n\u00E3o confere.', 'error');
    return;
  }
  try {
    await setUserPasswordRemote(id, senha);
    fecharModal();
    toast('Nova senha definida com sucesso.');
  } catch (e) {
    toast(e.message || 'Falha ao definir a nova senha.', 'error');
  }
}
async function alternarStatusUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem alterar usuários.')) return;
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!usuarioAlvo) return;
  if (USUARIO.id && id === USUARIO.id) {
    toast('Você não pode desativar seu próprio usuário.', 'warn');
    return;
  }
  if (!canEditUserRole(usuarioAlvo.perfil)) {
    toast('Seu perfil não pode alterar este usuário.', 'warn');
    return;
  }
  const proximoAtivo = usuarioAlvo.ativo === false;
  try {
    await updateUserStatusRemote(id, proximoAtivo);
    await recarregarUsuarios();
    toast(proximoAtivo ? 'Usu\u00E1rio ativado.' : 'Usu\u00E1rio desativado.');
  } catch (e) {
    toast(e.message || 'Falha ao alterar status do usuário.', 'error');
  }
}

function excluirUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem excluir usuários.')) return;
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!usuarioAlvo) return;
  if (USUARIO.id && id === USUARIO.id) {
    toast('Você não pode excluir seu próprio usuário.', 'warn');
    return;
  }
  if (!canEditUserRole(usuarioAlvo.perfil)) {
    toast('Seu perfil não pode excluir este usuário.', 'warn');
    return;
  }
  const nome = ((usuarioAlvo.nome || '') + ' ' + (usuarioAlvo.sobrenome || '')).trim() || usuarioAlvo.email || 'Sem nome';
  confirmar('Excluir o usuário "' + nome + '"? Esta ação não pode ser desfeita.', async function () {
    try {
      await deleteUserRemote(id);
      await recarregarUsuarios();
      toast('Usu\u00E1rio exclu\u00EDdo.');
    } catch (e) {
      toast(e.message || 'Falha ao excluir usuário.', 'error');
    }
  });
}

async function salvarUsuario() {
  const nome = document.getElementById('us_nome').value.trim();
  const sobrenome = document.getElementById('us_sobrenome').value.trim();
  if (!nome) { toast('Informe ao menos o nome.', 'error'); return; }
  const completo = (nome + ' ' + sobrenome).trim();
  if (completo.length > LIMITE_NOME) {
    toast('Nome + sobrenome deve ter até ' + LIMITE_NOME + ' caracteres (atual: ' + completo.length + ').', 'error');
    return;
  }
  USUARIO.nome = nome;
  USUARIO.sobrenome = sobrenome;
  USUARIO.celular = fmtCelular(document.getElementById('us_celular').value);
  USUARIO.email = document.getElementById('us_email').value.trim();
  try {
    setFotoCarregando(true);
    USUARIO.foto = await uploadPhotoIfNeeded('profiles', USUARIO.id || 'perfil', fotoBuffer, USUARIO.foto || '');
    saveUsuario();
    await saveProfileRemote(USUARIO);
    renderUserCard();
    fecharModal();
    toast('Perfil atualizado.');
  } catch (e) {
    setFotoCarregando(false);
    toast(e.message || 'Falha ao salvar perfil.', 'error');
  }
}

function oferecerCadastro(reg) {
  if (!ensureAllowed(canQuickSaveCadastros(), 'Seu perfil não pode salvar cadastros rápidos pela entrada.')) return false;
  const propostas = [];
  const docN = norm(reg.documento).replace(/[^a-z0-9]/g, '');
  let tabela = null;
  let rotulo = '';
  if (reg.tipo === 'motorista') { tabela = 'motoristas'; rotulo = 'motorista'; }
  else if (reg.tipo === 'visitante' || reg.tipo === 'prestador') { tabela = 'visitantes'; rotulo = 'visitante'; }

  if (tabela && docN) {
    const existe = DB[tabela].some((x) => norm(x.documento).replace(/[^a-z0-9]/g, '') === docN);
    if (!existe) {
      propostas.push({
        titulo: 'Cadastrar ' + rotulo,
        linhas: [reg.nome, reg.documento, reg.empresa, reg.telefone].filter(Boolean),
        salvar: () => {
          if (tabela === 'motoristas') {
            const novo = { id: uid(), nome: reg.nome, documento: reg.documento, telefone: reg.telefone || '', transportadora: reg.empresa || '', placaPadrao: reg.placa || '', tipoVeiculo: 'outro', obs: '', ativo: true };
            DB.motoristas.push(novo);
            return { entity: 'motoristas', row: novo };
          }
          const novo = { id: uid(), nome: reg.nome, documento: reg.documento, telefone: reg.telefone || '', empresa: reg.empresa || '', obs: reg.tipo === 'prestador' ? 'Prestador de serviço' : '', ativo: true };
          DB.visitantes.push(novo);
          return { entity: 'visitantes', row: novo };
        }
      });
    }
  }

  if (reg.placa) {
    const existe = DB.veiculos.some((v) => norm(v.placa) === norm(reg.placa));
    if (!existe) {
      propostas.push({
        titulo: 'Cadastrar veículo',
        linhas: [reg.placa, reg.empresa, reg.tipo === 'motorista' ? ('Motorista: ' + reg.nome) : ''].filter(Boolean),
        salvar: () => {
          const novo = { id: uid(), placa: reg.placa, tipo: 'outro', modelo: '', cor: '', proprietario: reg.empresa || '', motorista: reg.tipo === 'motorista' ? reg.nome : '', obs: '' };
          DB.veiculos.push(novo);
          return { entity: 'veiculos', row: novo };
        }
      });
    }
  }

  if (!propostas.length) return false;

  const corpo =
    '<p class="confirm-text">Estes dados ainda não estão nos cadastros. Salvar para agilizar as próximas entradas?</p>' +
    propostas.map((p, i) =>
      '<label class="ac-proposta" for="prop_' + i + '"><input type="checkbox" id="prop_' + i + '" checked>' +
      '<span><strong>' + esc(p.titulo) + '</strong><br><span class="muted">' + esc(p.linhas.join(' | ')) + '</span></span></label>'
    ).join('') +
    '<div class="form-foot" style="margin-top:14px">' +
    '<button class="btn btn-primary" id="propSalvar">Salvar selecionados</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Agora não</button></div>';

  abrirModal('Atualizar cadastros', corpo, true);
  document.getElementById('propSalvar').onclick = function () {
    let n = 0;
    propostas.forEach((p, i) => {
      if (document.getElementById('prop_' + i).checked) {
        const salvo = p.salvar();
        if (salvo) saveDB(salvo.entity, salvo.row);
        n++;
      }
    });
    if (n) { renderAll(); toast(n === 1 ? 'Cadastro salvo.' : n + ' cadastros salvos.'); }
    fecharModal();
  };
  return true;
}

function renderSaida() {
  const q = norm(document.getElementById('saidaBusca').value);
  let rows = DB.acessos.filter(a => a.status === 'Dentro');
  if (q) rows = rows.filter(a => norm(a.nome).includes(q) || norm(a.documento).includes(q) || norm(a.placa).includes(q));
  rows = sortRows(rows, 'saida');
  let html = '<thead><tr>' +
    thSort('saida', 'entrada', 'Entrada') + thSort('saida', 'tipo', 'Tipo') + thSort('saida', 'nome', 'Nome') +
    thSort('saida', 'documento', 'Documento') + thSort('saida', 'empresa', 'Empresa') + thSort('saida', 'placa', 'Placa') +
    thSort('saida', 'visitado', 'Visitado') + (canWriteOperacao() ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canWriteOperacao() ? 8 : 7) + '">Ninguém dentro no momento.</td></tr>';
  rows.forEach(a => {
    html += '<tr><td class="mono">' + fmtDataHora(a.entrada) + '</td><td>' + badgeTipo(a.tipo) + '</td>' +
      '<td><strong>' + esc(a.nome) + '</strong></td><td class="mono">' + esc(a.documento) + '</td>' +
      '<td>' + esc(a.empresa || '—') + '</td><td class="mono">' + esc(a.placa || '—') + '</td>' +
      '<td>' + esc(a.visitado || '—') + '</td>' +
      (canWriteOperacao() ? '<td>' + btnIcon('btn-success', 'Registrar saída', 'registrarSaida(\'' + a.id + '\')', ICO.exit) + '</td>' : '') + '</tr>';
  });
  document.getElementById('saidaTable').innerHTML = html + '</tbody>';
}

function registrarSaida(id) {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil não pode registrar saídas.')) return;
  const a = DB.acessos.find(x => x.id === id);
  if (!a) return;
  a.saida = new Date().toISOString();
  a.status = 'Saiu';
  saveDB('acessos', a);
  toast('Saída registrada: ' + a.nome);
  renderAll();
}

async function salvarVisitante(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil não pode salvar visitantes.')) return;
  const nome = document.getElementById('cv_nome').value.trim();
  const doc = document.getElementById('cv_doc').value.trim();
  if (!nome || !doc) { toast('Preencha Nome e Documento.', 'error'); return; }
  const validacaoDoc = validarDocumento(doc);
  if (!validacaoDoc.ok) { toast(validacaoDoc.msg, 'error'); return; }
  const dados = {
    nome,
    documento: doc,
    telefone: document.getElementById('cv_tel').value.trim(),
    empresa: document.getElementById('cv_empresa').value.trim(),
    obs: document.getElementById('cv_obs').value.trim(),
    foto: fotoBuffer,
    ativo: document.getElementById('cv_ativo').value === '1'
  };
  let row;
  if (id) {
    row = DB.visitantes.find(x => x.id === id);
  } else {
    row = Object.assign({ id: uid() }, dados);
  }
  try {
    setFotoCarregando(true);
    const fotoAnterior = row.foto || '';
    const fotoFinal = await uploadPhotoIfNeeded('visitantes', row.id, fotoBuffer, fotoAnterior);
    Object.assign(row, dados, { foto: fotoFinal });
    if (!id) DB.visitantes.push(row);
    saveDB('visitantes', row);
    fecharModal();
    renderVisitantes();
    toast(id ? 'Visitante atualizado.' : 'Visitante cadastrado.');
    retomarEntradaPendenteSePossivel();
  } catch (e) {
    setFotoCarregando(false);
    toast(e.message || 'Falha ao salvar visitante.', 'error');
  }
}

function excluirVisitante(id) {
  if (!ensureAllowed(canDeleteCadastros(), 'Somente Admin e Super Admin podem excluir visitantes.')) return;
  const v = DB.visitantes.find(x => x.id === id);
  confirmar('Excluir o visitante "' + v.nome + '"? O registro será arquivado para evitar perda de dados.', async function () {
    DB.visitantes = DB.visitantes.filter(x => x.id !== id);
    softDeleteRow('visitantes', v);
    renderVisitantes();
    toast('Visitante arquivado.');
  });
}

async function salvarMotorista(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil não pode salvar motoristas.')) return;
  const nome = document.getElementById('cm_nome').value.trim();
  const doc = document.getElementById('cm_doc').value.trim();
  if (!nome || !doc) { toast('Preencha Nome e Documento.', 'error'); return; }
  const validacaoDoc = validarDocumento(doc);
  if (!validacaoDoc.ok) { toast(validacaoDoc.msg, 'error'); return; }
  const dados = {
    nome,
    documento: doc,
    telefone: document.getElementById('cm_tel').value.trim(),
    transportadora: document.getElementById('cm_transp').value.trim(),
    placaPadrao: normalizePlaca(document.getElementById('cm_placa').value),
    tipoVeiculo: document.getElementById('cm_tipoVeiculo').value,
    foto: fotoBuffer,
    obs: document.getElementById('cm_obs').value.trim()
  };
  let row;
  if (id) {
    row = DB.motoristas.find(x => x.id === id);
  } else {
    row = Object.assign({ id: uid() }, dados);
  }
  try {
    setFotoCarregando(true);
    const fotoAnterior = row.foto || '';
    const fotoFinal = await uploadPhotoIfNeeded('motoristas', row.id, fotoBuffer, fotoAnterior);
    Object.assign(row, dados, { foto: fotoFinal });
    if (!id) DB.motoristas.push(row);
    saveDB('motoristas', row);
    fecharModal();
    renderMotoristas();
    toast(id ? 'Motorista atualizado.' : 'Motorista cadastrado.');
    retomarEntradaPendenteSePossivel();
  } catch (e) {
    setFotoCarregando(false);
    toast(e.message || 'Falha ao salvar motorista.', 'error');
  }
}

function excluirMotorista(id) {
  if (!ensureAllowed(canDeleteCadastros(), 'Somente Admin e Super Admin podem excluir motoristas.')) return;
  const m = DB.motoristas.find(x => x.id === id);
  confirmar('Excluir o motorista "' + m.nome + '"? O registro será arquivado para evitar perda de dados.', async function () {
    DB.motoristas = DB.motoristas.filter(x => x.id !== id);
    softDeleteRow('motoristas', m);
    renderMotoristas();
    toast('Motorista arquivado.');
  });
}

function salvarVeiculo(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil não pode salvar veículos.')) return;
  const placa = normalizePlaca(document.getElementById('cve_placa').value);
  if (!placa) { toast('Informe a placa do veículo.', 'error'); return; }
  const motoristaDocumento = document.getElementById('cve_motorista').value.trim();
  const motoristaVinculado = motoristaDocumento
    ? DB.motoristas.find((m) => normalizeDocumento(m.documento) === normalizeDocumento(motoristaDocumento))
    : null;
  const dados = {
    placa,
    tipo: document.getElementById('cve_tipo').value,
    modelo: document.getElementById('cve_modelo').value.trim(),
    cor: document.getElementById('cve_cor').value.trim(),
    proprietario: document.getElementById('cve_prop').value.trim(),
    motorista: motoristaVinculado ? motoristaVinculado.nome : '',
    motoristaDocumento: motoristaVinculado ? motoristaVinculado.documento : '',
    obs: document.getElementById('cve_obs').value.trim()
  };
  let row;
  if (id) {
    row = DB.veiculos.find(x => x.id === id);
    Object.assign(row, dados);
    toast('Veículo atualizado.');
  } else {
    row = Object.assign({ id: uid() }, dados);
    DB.veiculos.push(row);
    toast('Veículo cadastrado.');
  }
  saveDB('veiculos', row);
  fecharModal();
  renderVeiculos();
  retomarEntradaPendenteSePossivel();
}

function excluirVeiculo(id) {
  if (!ensureAllowed(canDeleteCadastros(), 'Somente Admin e Super Admin podem excluir veículos.')) return;
  const v = DB.veiculos.find(x => x.id === id);
  confirmar('Excluir o veículo "' + v.placa + '"? O registro será arquivado para evitar perda de dados.', function () {
    DB.veiculos = DB.veiculos.filter(x => x.id !== id);
    softDeleteRow('veiculos', v);
    renderVeiculos();
    toast('Veículo arquivado.');
  });
}

function toggleEmergencia(id) {
  if (!ensureAllowed(canFavoriteRamais(), 'Seu perfil não pode favoritar contatos.')) return;
  const r = DB.ramais.find(x => x.id === id);
  if (!r) return;
  r.emergencia = !r.emergencia;
  saveDB('ramais', r);
  renderRamais();
  toast(r.emergencia ? 'Adicionado à emergência: ' + r.setor : 'Removido da emergência: ' + r.setor);
}

function renderRamais() {
  const sortPt = (a, b, f) => String(a[f] || '').localeCompare(String(b[f] || ''), 'pt', { numeric: true, sensitivity: 'base' });
  const emrg = DB.ramais.filter(r => r.emergencia).sort((a, b) => sortPt(a, b, 'setor'));
  const cont = document.getElementById('ramaisEmergencia');
  if (emrg.length) {
    cont.style.display = '';
    cont.innerHTML = '<div class="emrg-head">Contatos de emergência</div><div class="emrg-grid">' +
      emrg.map(r => {
        const tel = (r.celular || '').replace(/[^0-9+]/g, '');
        return '<div class="emrg-card">' +
          '<div class="ec-setor">' + esc(r.setor) + '</div>' +
          '<div class="ec-nome">' + esc(r.responsavel || '—') + '</div>' +
          '<div class="ec-linha">Ramal <strong>' + esc(r.ramal || '—') + '</strong></div>' +
          (r.celular ? '<div class="ec-linha"><a href="tel:' + esc(tel) + '">' + esc(fmtCelular(r.celular)) + '</a></div>' : '') +
          '</div>';
      }).join('') + '</div>';
  } else {
    cont.style.display = 'none';
    cont.innerHTML = '';
  }

  const q = norm(document.getElementById('ramalBusca').value);
  let rows = DB.ramais.slice();
  if (ramalSoEmrg) rows = rows.filter(r => r.emergencia);
  if (q) rows = rows.filter(r => norm(r.setor).includes(q) || norm(r.ramal).includes(q) || norm(r.responsavel).includes(q) || norm(r.celular).includes(q) || norm(r.email).includes(q));
  rows.sort((a, b) => ramalSort.dir * sortPt(a, b, ramalSort.col));

  const ind = c => ramalSort.col === c ? ' <span class="sort-ind">' + (ramalSort.dir > 0 ? '&#9650;' : '&#9660;') + '</span>' : '';
  let html = '<colgroup>' +
    '<col style="width:32px">' +
    '<col style="width:18%">' +
    '<col style="width:62px">' +
    '<col style="width:24%">' +
    '<col style="width:132px">' +
    '<col style="width:215px">' +
    (canManageRamais() ? '<col style="width:92px">' : '') +
    '</colgroup><thead><tr>' +
    '<th title="Emergência"></th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'setor\')">Setor / Local' + ind('setor') + '</th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'ramal\')">Ramal' + ind('ramal') + '</th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'responsavel\')">Responsável' + ind('responsavel') + '</th>' +
    '<th>Celular</th><th>E-mail</th>' + (canManageRamais() ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canManageRamais() ? 7 : 6) + '">Nenhum ramal encontrado.</td></tr>';
  rows.forEach(r => {
    const tel = (r.celular || '').replace(/[^0-9+]/g, '');
    html += '<tr class="' + (r.emergencia ? 'emrg-row' : '') + '">' +
      '<td>' + (canFavoriteRamais()
        ? '<button class="star-btn' + (r.emergencia ? ' on' : '') + '" title="' + (r.emergencia ? 'Remover de emergência' : 'Marcar como contato de emergência') + '" onclick="toggleEmergencia(\'' + r.id + '\')">' + (r.emergencia ? '★' : '☆') + '</button>'
        : (r.emergencia ? '★' : '')) + '</td>' +
      '<td><strong>' + esc(r.setor) + '</strong></td><td class="mono">' + esc(r.ramal || '—') + '</td>' +
      '<td>' + esc(r.responsavel || '—') + '</td>' +
      '<td class="mono">' + (r.celular ? '<a href="tel:' + esc(tel) + '">' + esc(fmtCelular(r.celular)) + '</a>' : '—') + '</td>' +
      '<td>' + (r.email ? '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>' : '—') + '</td>' +
      (canManageRamais() ? '<td class="actions">' + btnIcon('btn-ghost', 'Editar', 'abrirFormRamal(\'' + r.id + '\')', ICO.edit) + btnIcon('btn-danger', 'Excluir', 'excluirRamal(\'' + r.id + '\')', ICO.trash) + '</td>' : '') +
      '</tr>';
  });
  document.getElementById('ramaisTable').innerHTML = html + '</tbody>';
}

function salvarRamal(id) {
  if (!ensureAllowed(canManageRamais(), 'Somente Admin e Super Admin podem salvar ramais.')) return;
  const setor = document.getElementById('cr_setor').value.trim();
  const ramal = document.getElementById('cr_ramal').value.trim();
  if (!setor || !ramal) { toast('Preencha Setor e Ramal.', 'error'); return; }
  const dados = {
    setor,
    ramal,
    responsavel: document.getElementById('cr_resp').value.trim(),
    celular: fmtCelular(document.getElementById('cr_celular').value),
    email: document.getElementById('cr_email').value.trim(),
    emergencia: document.getElementById('cr_emrg').checked,
    obs: id ? ((DB.ramais.find(x => x.id === id) || {}).obs || '') : ''
  };
  let row;
  if (id) {
    row = DB.ramais.find(x => x.id === id);
    Object.assign(row, dados);
    toast('Ramal atualizado.');
  } else {
    row = Object.assign({ id: uid() }, dados);
    DB.ramais.push(row);
    toast('Ramal cadastrado.');
  }
  saveDB('ramais', row);
  fecharModal();
  renderRamais();
}

function excluirRamal(id) {
  if (!ensureAllowed(canManageRamais(), 'Somente Admin e Super Admin podem excluir ramais.')) return;
  const r = DB.ramais.find(x => x.id === id);
  confirmar('Excluir o ramal de "' + r.setor + '"? O registro será arquivado para evitar perda de dados.', function () {
    DB.ramais = DB.ramais.filter(x => x.id !== id);
    softDeleteRow('ramais', r);
    renderRamais();
    toast('Ramal arquivado.');
  });
}

function renderEntregas() {
  const q = norm(document.getElementById('entregaBusca').value);
  const st = document.getElementById('entregaStatusFiltro').value;
  let rows = DB.entregas.slice();
  if (q) rows = rows.filter(e => norm(e.fornecedor).includes(q) || norm(e.nf).includes(q) || norm(e.motorista).includes(q) || norm(e.placa).includes(q) || norm(e.descricao).includes(q));
  if (st) rows = rows.filter(e => e.status === st);
  rows = sortRows(rows, 'entregas');
  let html = '<thead><tr>' +
    thSort('entregas', 'data', 'Data') + thSort('entregas', 'tipo', 'Tipo') + thSort('entregas', 'fornecedor', 'Fornecedor/Transp.') +
    thSort('entregas', 'nf', 'NF/Doc.') + thSort('entregas', 'descricao', 'Produtos') + thSort('entregas', 'volumes', 'Vol.') +
    thSort('entregas', 'destinatario', 'Destinatário') + thSort('entregas', 'setor', 'Setor') + thSort('entregas', 'status', 'Status') +
    (canWriteOperacao() ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canWriteOperacao() ? 10 : 9) + '">Nenhuma entrega encontrada.</td></tr>';
  rows.forEach(e => {
    html += '<tr><td class="mono">' + fmtDataHora(e.data) + '</td><td>' + badgeTipo(e.tipo) + '</td>' +
      '<td><strong>' + esc(e.fornecedor) + '</strong></td><td class="mono">' + esc(e.nf || '—') + '</td>' +
      '<td>' + esc(e.descricao || '—') + '</td><td class="mono">' + esc(e.volumes) + '</td>' +
      '<td>' + esc(e.destinatario || '—') + '</td><td>' + esc(e.setor || '—') + '</td>' +
      '<td>' + badgeStatus(e.status) + '</td>' +
      (canWriteOperacao()
        ? '<td class="actions">' +
          (e.status !== 'entregue' && e.status !== 'cancelado' ? btnIcon('btn-success', 'Marcar como entregue', 'baixarEntrega(\'' + e.id + '\')', ICO.check) : '') +
          btnIcon('btn-ghost', 'Editar', 'abrirFormEntrega(\'' + e.id + '\')', ICO.edit) +
          btnIcon('btn-danger', 'Excluir', 'excluirEntrega(\'' + e.id + '\')', ICO.trash) + '</td>'
        : '') + '</tr>';
  });
  document.getElementById('entregasTable').innerHTML = html + '</tbody>';
}

function salvarEntrega(id) {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil não pode salvar entregas.')) return;
  const fornecedor = document.getElementById('ce_fornecedor').value.trim();
  const destinatario = document.getElementById('ce_dest').value.trim();
  if (!fornecedor) { toast('Informe o fornecedor ou transportadora.', 'error'); return; }
  if (!destinatario) { toast('Informe o destinatário interno.', 'error'); return; }
  const dados = {
    tipo: document.getElementById('ce_tipo').value,
    fornecedor,
    motorista: document.getElementById('ce_motorista').value.trim(),
    placa: document.getElementById('ce_placa').value.trim().toUpperCase(),
    nf: document.getElementById('ce_nf').value.trim(),
    descricao: document.getElementById('ce_desc').value.trim(),
    volumes: parseInt(document.getElementById('ce_volumes').value, 10) || 0,
    destinatario,
    setor: document.getElementById('ce_setor').value.trim(),
    status: document.getElementById('ce_status').value,
    obs: document.getElementById('ce_obs').value.trim()
  };
  let row;
  if (id) {
    row = DB.entregas.find(x => x.id === id);
    Object.assign(row, dados);
    toast('Entrega atualizada.');
  } else {
    row = Object.assign({ id: uid(), data: new Date().toISOString() }, dados);
    DB.entregas.push(row);
    toast('Entrega registrada.');
  }
  saveDB('entregas', row);
  fecharModal();
  renderEntregas();
  renderDashboard();
}

function baixarEntrega(id) {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil não pode baixar entregas.')) return;
  const e = DB.entregas.find(x => x.id === id);
  if (!e) return;
  e.status = 'entregue';
  saveDB('entregas', e);
  renderEntregas();
  renderDashboard();
  toast('Entrega baixada como "Entregue": ' + e.fornecedor);
}

function excluirEntrega(id) {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil não pode excluir entregas.')) return;
  const e = DB.entregas.find(x => x.id === id);
  confirmar('Excluir a entrega de "' + e.fornecedor + '" (' + (e.nf || 'sem NF') + ')? O registro será arquivado para evitar perda de dados.', function () {
    DB.entregas = DB.entregas.filter(x => x.id !== id);
    softDeleteRow('entregas', e);
    renderEntregas();
    renderDashboard();
    toast('Entrega arquivada.');
  });
}


/* ---------- Render geral ---------- */
function renderAll() {
  renderDashboard();
  renderSaida();
  renderVisitantes();
  renderMotoristas();
  renderVeiculos();
  renderEntregas();
  renderHistorico();
  renderRamais();
  renderUsuarios();
}



/* ---- expõe handlers usados em onclick inline ---- */
Object.assign(window, {
  abrirAreaUsuario,
  abrirAjudaCadastroUsuario,
  cadastrarUsuarioConvite,
  abrirFormEntrega,
  abrirFormMotorista,
  abrirFormRamal,
  abrirFormVeiculo,
  abrirFormVisitante,
  backupJSON,
  baixarEntrega,
  capturarFotoWebcam,
  carregarFoto,
  excluirEntrega,
  excluirMotorista,
  excluirRamal,
  excluirVeiculo,
  excluirVisitante,
  exportarEntregasCSV,
  exportarHistoricoCSV,
  fecharModal,
  limparFiltrosHistorico,
  limparFormEntrada,
  limparTodosFiltros,
  mascaraCelular,
  ordenarRamais,
  ordenarTabela,
  pararWebcam,
  trocarWebcamSelecionada,
  registrarEntrada,
  registrarSaida,
  retomarEntradaPendente,
  cancelarEntradaPendente,
  removerFoto,
  renderEntregas,
  renderHistorico,
  renderArquivados,
  renderAuditoria,
  renderMotoristas,
  renderRamais,
  renderSaida,
  renderUsuarios,
  renderVeiculos,
  renderVisitantes,
  recarregarUsuarios,
  carregarAuditoria,
  restaurarArquivado,
  restaurarJSON,
  alternarStatusUsuario,
  salvarEntrega,
  salvarMotorista,
  salvarPerfilUsuario,
  abrirNovaSenhaUsuario,
  confirmarNovaSenhaUsuario,
  salvarRamal,
  salvarUsuario,
  salvarVeiculo,
  salvarVisitante,
  excluirUsuario,
  showView,
  tirarFotoWebcam,
  toggleEmergencia,
  toggleSoEmrg,
  logoutUsuario
});

/* ---- API consumida pelo bootstrap (main.js) ---- */
export function setUsuario(u) {
  if (u) Object.assign(USUARIO, u, { perfil: normalizeRole(u.perfil) });
  ROLE = normalizeRole(USUARIO.perfil);
  USUARIO.perfil = ROLE;
  renderUserCard();
}
export function renderApp() { renderUserCard(); renderAll(); }
export function applyRole(perfil) {
  ROLE = normalizeRole(perfil);
  USUARIO.perfil = ROLE;
  document.body.classList.remove('role-super-admin', 'role-admin', 'role-seguranca', 'role-consulta');
  if (ROLE === ROLE_SUPER_ADMIN) document.body.classList.add('role-super-admin');
  else if (ROLE === ROLE_ADMIN) document.body.classList.add('role-admin');
  else if (ROLE === ROLE_SEGURANCA) document.body.classList.add('role-seguranca');
  else document.body.classList.add('role-consulta');
}





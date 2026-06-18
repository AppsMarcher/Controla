/* ============================================================
   CONTROLA MARCHER — App (UI)  •  módulo principal
   Persistência via camada de dados (Supabase ou localStorage)
   ============================================================ */
import { repo } from './data/repo.js';
import { deleteUserRemote, inviteUserRemote, loadProfilesRemote, logout, saveProfileRemote, updateProfileRoleRemote, updateUserStatusRemote } from './auth.js';
import { seedRamais } from './data/seed.js';
import { deleteManagedPhoto, uploadPhotoIfNeeded } from './data/storage.js';

const ROLE_SUPER_ADMIN = 'Super Admin';
const ROLE_ADMIN = 'Admin';
const ROLE_SEGURANCA = 'Seguranca';
const ROLE_CONSULTA = 'Consulta';

let ROLE = ROLE_SUPER_ADMIN;
let PERFIS_USUARIOS = [];
const PERFIS_ACESSO = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SEGURANCA, ROLE_CONSULTA];

let DB = {};                 // cache em memória (hidratado em loadData)

export async function loadData() { DB = await repo.loadAll(); }

function saveDB(entity, row) {
  const p = entity && row ? repo.saveRow(entity, row) : repo.replaceAll(DB);
  p.catch((e) => toast('Falha ao salvar dados: ' + (e.message || e), 'error'));
}

function deleteDB(entity, id) {
  const p = repo.deleteRow(entity, id);
  p.catch((e) => toast('Falha ao salvar dados: ' + (e.message || e), 'error'));
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
  toast(msg || 'Seu perfil nao permite esta acao.', 'warn');
  return false;
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
  power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.4 5.6a8 8 0 1 1-12.8 0"/></svg>'
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
  const ind = s.col === col ? ' <span class="sort-ind">' + (s.dir > 0 ? '▲' : '▼') + '</span>' : '';
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

/* ---------- Toast ---------- */
function toast(msg, kind) {
  const box = document.getElementById('toastBox');
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2800);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- Modal ---------- */
function abrirModal(titulo, bodyHTML, small) {
  document.getElementById('modalTitle').textContent = titulo;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalBox').classList.toggle('small', !!small);
  document.getElementById('modalOverlay').classList.add('open');
}
function fecharModal() {
  if (typeof pararWebcam === 'function') pararWebcam(true);
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
    toast('Seu perfil nao pode acessar esta area.', 'warn');
    name = 'dashboard';
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const sec = document.getElementById('view-' + name);
  if (sec) sec.classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.getElementById('sidebar').classList.remove('open');
  if (name === 'usuarios') recarregarUsuarios();
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
    html += '<tr><td class="mono">' + fmtHora(a.entrada) + '</td><td>' + badgeTipo(a.tipo) + '</td><td><strong>' + esc(a.nome) + '</strong></td><td>' +
      esc(a.empresa || '—') + '</td><td class="mono">' + esc(a.placa || '—') + '</td><td>' + badgeStatus(a.status) + '</td></tr>';
  });
  document.getElementById('dashTable').innerHTML = html + '</tbody>';
}

/* ============================================================
   ENTRADA
   ============================================================ */
function limparFormEntrada() {
  ['e_nome','e_doc','e_empresa','e_tel','e_placa','e_visitado','e_motivo','e_obs'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('e_tipo').value = 'interno';
}

function registrarEntrada() {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil nao pode registrar entradas.')) return;
  const nome = document.getElementById('e_nome').value.trim();
  const doc = document.getElementById('e_doc').value.trim();
  if (!nome || !doc) {
    toast('Preencha pelo menos Nome e Documento.', 'error');
    return;
  }
  const docNorm = norm(doc).replace(/[^a-z0-9]/g, '');
  const jaDentro = DB.acessos.find(a => a.status === 'Dentro' &&
    norm(a.documento).replace(/[^a-z0-9]/g, '') === docNorm);
  if (jaDentro) {
    toast('Entrada bloqueada: ' + jaDentro.nome + ' (doc. ' + jaDentro.documento + ') já está dentro sem registro de saída.', 'warn');
    return;
  }
  const reg = {
    id: uid(),
    tipo: document.getElementById('e_tipo').value,
    nome: nome,
    documento: doc,
    empresa: document.getElementById('e_empresa').value.trim(),
    telefone: document.getElementById('e_tel').value.trim(),
    placa: document.getElementById('e_placa').value.trim().toUpperCase(),
    motivo: document.getElementById('e_motivo').value.trim(),
    visitado: document.getElementById('e_visitado').value.trim(),
    obs: document.getElementById('e_obs').value.trim(),
    entrada: new Date().toISOString(),
    saida: null,
    status: 'Dentro'
  };
  DB.acessos.push(reg);
  saveDB('acessos', reg);
  limparFormEntrada();
  toast('Entrada registrada: ' + reg.nome);
  showView('dashboard');
  oferecerCadastro(reg);
}

/* Após registrar uma entrada, oferece salvar o que ainda não existe nos cadastros,
   mantendo os vínculos (motorista + veículo já saem linkados entre si). */
function oferecerCadastro_legacy(reg) {
  const propostas = [];
  const docN = norm(reg.documento).replace(/[^a-z0-9]/g, '');

  // ----- Pessoa -----
  let tabela = null, rotulo = '';
  if (reg.tipo === 'motorista') { tabela = 'motoristas'; rotulo = 'motorista'; }
  else if (reg.tipo === 'visitante' || reg.tipo === 'prestador') { tabela = 'visitantes'; rotulo = 'visitante'; }

  if (tabela && docN) {
    const existe = DB[tabela].some(x => norm(x.documento).replace(/[^a-z0-9]/g, '') === docN);
    if (!existe) {
      propostas.push({
        titulo: 'Cadastrar ' + rotulo,
        linhas: [reg.nome, reg.documento, reg.empresa, reg.telefone].filter(Boolean),
        salvar: () => {
          if (tabela === 'motoristas') {
            DB.motoristas.push({ id: uid(), nome: reg.nome, documento: reg.documento, telefone: reg.telefone || '', transportadora: reg.empresa || '', placaPadrao: reg.placa || '', tipoVeiculo: 'outro', obs: '', ativo: true });
          } else {
            DB.visitantes.push({ id: uid(), nome: reg.nome, documento: reg.documento, telefone: reg.telefone || '', empresa: reg.empresa || '', obs: reg.tipo === 'prestador' ? 'Prestador de serviço' : '', ativo: true });
          }
        }
      });
    }
  }

  // ----- Veículo -----
  if (reg.placa) {
    const placaN = norm(reg.placa);
    const existe = DB.veiculos.some(v => norm(v.placa) === placaN);
    if (!existe) {
      propostas.push({
        titulo: 'Cadastrar veículo',
        linhas: [reg.placa, reg.empresa, reg.tipo === 'motorista' ? ('Motorista: ' + reg.nome) : ''].filter(Boolean),
        salvar: () => {
          DB.veiculos.push({ id: uid(), placa: reg.placa, tipo: 'outro', modelo: '', cor: '', proprietario: reg.empresa || '', motorista: reg.tipo === 'motorista' ? reg.nome : '', obs: '' });
        }
      });
    }
  }

  if (!propostas.length) return false;

  const corpo =
    '<p class="confirm-text">Estes dados ainda não estão nos cadastros. Salvar para agilizar as próximas entradas?</p>' +
    propostas.map((p, i) =>
      '<label class="ac-proposta" for="prop_' + i + '"><input type="checkbox" id="prop_' + i + '" checked>' +
      '<span><strong>' + esc(p.titulo) + '</strong><br><span class="muted">' + esc(p.linhas.join(' · ')) + '</span></span></label>'
    ).join('') +
    '<div class="form-foot" style="margin-top:14px">' +
    '<button class="btn btn-primary" id="propSalvar">Salvar selecionados</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Agora não</button></div>';

  abrirModal('Atualizar cadastros', corpo, true);
  document.getElementById('propSalvar').onclick = function () {
    let n = 0;
    propostas.forEach((p, i) => {
      if (document.getElementById('prop_' + i).checked) { p.salvar(); n++; }
    });
    if (n) { saveDB(); renderAll(); toast(n === 1 ? 'Cadastro salvo.' : n + ' cadastros salvos.'); }
    fecharModal();
  };
  return true;
}

/* ============================================================
   SAÍDA
   ============================================================ */
function renderSaida_legacy() {
  const q = norm(document.getElementById('saidaBusca').value);
  let rows = DB.acessos.filter(a => a.status === 'Dentro');
  if (q) {
    rows = rows.filter(a =>
      norm(a.nome).includes(q) || norm(a.documento).includes(q) || norm(a.placa).includes(q));
  }
  rows = sortRows(rows, 'saida');
  let html = '<thead><tr>' +
    thSort('saida', 'entrada', 'Entrada') + thSort('saida', 'tipo', 'Tipo') + thSort('saida', 'nome', 'Nome') +
    thSort('saida', 'documento', 'Documento') + thSort('saida', 'empresa', 'Empresa') + thSort('saida', 'placa', 'Placa') +
    thSort('saida', 'visitado', 'Visitado') + '<th></th></tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="8">Ninguém dentro no momento.</td></tr>';
  rows.forEach(a => {
    html += '<tr><td class="mono">' + fmtDataHora(a.entrada) + '</td><td>' + badgeTipo(a.tipo) + '</td>' +
      '<td><strong>' + esc(a.nome) + '</strong></td><td class="mono">' + esc(a.documento) + '</td>' +
      '<td>' + esc(a.empresa || '—') + '</td><td class="mono">' + esc(a.placa || '—') + '</td>' +
      '<td>' + esc(a.visitado || '—') + '</td>' +
      '<td>' + btnIcon('btn-success', 'Registrar saída', 'registrarSaida(\'' + a.id + '\')', ICO.exit) + '</td></tr>';
  });
  document.getElementById('saidaTable').innerHTML = html + '</tbody>';
}

function registrarSaida_legacy(id) {
  const a = DB.acessos.find(x => x.id === id);
  if (!a) return;
  a.saida = new Date().toISOString();
  a.status = 'Saiu';
  saveDB('acessos');
  toast('Saída registrada: ' + a.nome);
  renderAll();
}

/* ============================================================
   FOTO — upload (com redução) + predisposição p/ webcam
   Usado nos cadastros de Visitante e Motorista.
   ============================================================ */
let fotoBuffer = '';        // foto selecionada no formulário aberto (data URL)
let _webcamStream = null;   // stream ativa, se houver

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
        '<div id="fotoWebcamActions" class="foto-actions"></div>' +
        '<div class="muted" style="font-size:.72rem">Clique na foto para enviar um arquivo (JPG ou PNG) — a imagem é reduzida automaticamente. Webcam quando disponível (HTTPS).</div>' +
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

/* ----- Webcam (predisposição funcional) ----- */
function capturarFotoWebcam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Webcam indisponível neste contexto (requer HTTPS ou localhost).', 'warn');
    return;
  }
  const prev = document.getElementById('fotoPreview');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    .then(function (stream) {
      _webcamStream = stream;
      prev.innerHTML = '<video id="fotoVideo" autoplay playsinline muted></video>';
      document.getElementById('fotoVideo').srcObject = stream;
      const acts = document.getElementById('fotoWebcamActions');
      acts.innerHTML =
        '<button type="button" class="btn btn-primary btn-sm" onclick="tirarFotoWebcam()">Capturar</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" onclick="pararWebcam()">Cancelar</button>';
    })
    .catch(function () { toast('Não foi possível acessar a webcam.', 'error'); });
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
  const acts = document.getElementById('fotoWebcamActions');
  if (acts) acts.innerHTML = '';
  if (!keepBuffer) setFotoPreview(fotoBuffer); // restaura o preview anterior
}

/* Miniatura para as listagens (foto ou inicial do nome). */
function fotoThumb(foto, nome) {
  if (foto) return '<span class="thumb"><img src="' + foto + '" alt=""></span>';
  const ini = String(nome || '?').trim().charAt(0).toUpperCase() || '?';
  return '<span class="thumb thumb-ph">' + esc(ini) + '</span>';
}

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
    (canWriteCadastros() ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canWriteCadastros() ? 7 : 6) + '">Nenhum visitante cadastrado.</td></tr>';
  rows.forEach(v => {
    html += '<tr><td><span class="cell-foto">' + fotoThumb(v.foto, v.nome) + '<strong>' + esc(v.nome) + '</strong></span></td><td class="mono">' + esc(v.documento) + '</td>' +
      '<td>' + esc(v.telefone || '—') + '</td><td>' + esc(v.empresa || '—') + '</td>' +
      '<td>' + (v.ativo ? '<span class="badge b-ativo">Ativo</span>' : '<span class="badge b-inativo">Inativo</span>') + '</td>' +
      '<td>' + esc(v.obs || '—') + '</td>' +
      (canWriteCadastros()
        ? '<td class="actions">' + btnIcon('btn-ghost', 'Editar', 'abrirFormVisitante(\'' + v.id + '\')', ICO.edit) +
          btnIcon('btn-danger', 'Excluir', 'excluirVisitante(\'' + v.id + '\')', ICO.trash) + '</td>'
        : '') + '</tr>';
  });
  document.getElementById('visTable').innerHTML = html + '</tbody>';
}

function abrirFormVisitante(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode alterar visitantes.')) return;
  const v = id ? DB.visitantes.find(x => x.id === id) : null;
  abrirModal(v ? 'Editar visitante' : 'Novo visitante',
    '<div class="form-grid">' +
    fotoField() +
    campo('cv_nome', 'Nome *', v ? v.nome : '') +
    campo('cv_doc', 'Documento *', v ? v.documento : '') +
    campo('cv_tel', 'Telefone', v ? v.telefone : '') +
    campo('cv_empresa', 'Empresa', v ? v.empresa : '') +
    '<div class="field"><label>Status</label><select id="cv_ativo">' +
    '<option value="1"' + (!v || v.ativo ? ' selected' : '') + '>Ativo</option>' +
    '<option value="0"' + (v && !v.ativo ? ' selected' : '') + '>Inativo</option></select></div>' +
    '<div class="field full"><label>Observações</label><textarea id="cv_obs">' + esc(v ? v.obs : '') + '</textarea></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarVisitante(' + (v ? '\'' + v.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
  setFotoPreview(v ? v.foto : '');
}

function salvarVisitante_legacy(id) {
  const nome = document.getElementById('cv_nome').value.trim();
  const doc = document.getElementById('cv_doc').value.trim();
  if (!nome || !doc) { toast('Preencha Nome e Documento.', 'error'); return; }
  const dados = {
    nome: nome, documento: doc,
    telefone: document.getElementById('cv_tel').value.trim(),
    empresa: document.getElementById('cv_empresa').value.trim(),
    obs: document.getElementById('cv_obs').value.trim(),
    foto: fotoBuffer,
    ativo: document.getElementById('cv_ativo').value === '1'
  };
  if (id) {
    Object.assign(DB.visitantes.find(x => x.id === id), dados);
    toast('Visitante atualizado.');
  } else {
    DB.visitantes.push(Object.assign({ id: uid() }, dados));
    toast('Visitante cadastrado.');
  }
  saveDB('visitantes'); fecharModal(); renderVisitantes();
}

function excluirVisitante_legacy(id) {
  const v = DB.visitantes.find(x => x.id === id);
  confirmar('Excluir o visitante "' + v.nome + '"? Esta ação não pode ser desfeita.', function () {
    DB.visitantes = DB.visitantes.filter(x => x.id !== id);
    saveDB('visitantes'); renderVisitantes(); toast('Visitante excluído.');
  });
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
    thSort('motoristas', 'obs', 'Obs.') + (canWriteCadastros() ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canWriteCadastros() ? 8 : 7) + '">Nenhum motorista cadastrado.</td></tr>';
  rows.forEach(m => {
    html += '<tr><td><span class="cell-foto">' + fotoThumb(m.foto, m.nome) + '<strong>' + esc(m.nome) + '</strong></span></td><td class="mono">' + esc(m.documento) + '</td>' +
      '<td>' + esc(m.telefone || '—') + '</td><td>' + esc(m.transportadora || '—') + '</td>' +
      '<td class="mono">' + esc(m.placaPadrao || '—') + '</td><td>' + esc(m.tipoVeiculo || '—') + '</td>' +
      '<td>' + esc(m.obs || '—') + '</td>' +
      (canWriteCadastros()
        ? '<td class="actions">' + btnIcon('btn-ghost', 'Editar', 'abrirFormMotorista(\'' + m.id + '\')', ICO.edit) +
          btnIcon('btn-danger', 'Excluir', 'excluirMotorista(\'' + m.id + '\')', ICO.trash) + '</td>'
        : '') + '</tr>';
  });
  document.getElementById('motTable').innerHTML = html + '</tbody>';
}

function abrirFormMotorista(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode alterar motoristas.')) return;
  const m = id ? DB.motoristas.find(x => x.id === id) : null;
  const tipos = ['carro', 'moto', 'caminhão', 'carreta', 'utilitário', 'outro'];
  abrirModal(m ? 'Editar motorista' : 'Novo motorista',
    '<div class="form-grid">' +
    fotoField() +
    campo('cm_nome', 'Nome *', m ? m.nome : '') +
    campo('cm_doc', 'CPF / RG / CNH *', m ? m.documento : '') +
    campo('cm_tel', 'Telefone', m ? m.telefone : '') +
    campo('cm_transp', 'Transportadora', m ? m.transportadora : '') +
    campo('cm_placa', 'Placa padrão', m ? m.placaPadrao : '') +
    '<div class="field"><label>Tipo de veículo</label><select id="cm_tipoVeiculo">' +
    tipos.map(t => '<option value="' + t + '"' + (m && m.tipoVeiculo === t ? ' selected' : '') + '>' + t + '</option>').join('') +
    '</select></div>' +
    '<div class="field full"><label>Observações</label><textarea id="cm_obs">' + esc(m ? m.obs : '') + '</textarea></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarMotorista(' + (m ? '\'' + m.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
  setFotoPreview(m ? m.foto : '');
}

function salvarMotorista_legacy(id) {
  const nome = document.getElementById('cm_nome').value.trim();
  const doc = document.getElementById('cm_doc').value.trim();
  if (!nome || !doc) { toast('Preencha Nome e Documento.', 'error'); return; }
  const dados = {
    nome: nome, documento: doc,
    telefone: document.getElementById('cm_tel').value.trim(),
    transportadora: document.getElementById('cm_transp').value.trim(),
    placaPadrao: document.getElementById('cm_placa').value.trim().toUpperCase(),
    tipoVeiculo: document.getElementById('cm_tipoVeiculo').value,
    foto: fotoBuffer,
    obs: document.getElementById('cm_obs').value.trim()
  };
  if (id) {
    Object.assign(DB.motoristas.find(x => x.id === id), dados);
    toast('Motorista atualizado.');
  } else {
    DB.motoristas.push(Object.assign({ id: uid() }, dados));
    toast('Motorista cadastrado.');
  }
  saveDB('motoristas'); fecharModal(); renderMotoristas();
}

function excluirMotorista_legacy(id) {
  const m = DB.motoristas.find(x => x.id === id);
  confirmar('Excluir o motorista "' + m.nome + '"? Esta ação não pode ser desfeita.', function () {
    DB.motoristas = DB.motoristas.filter(x => x.id !== id);
    saveDB('motoristas'); renderMotoristas(); toast('Motorista excluído.');
  });
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
    thSort('veiculos', 'obs', 'Obs.') + (canWriteCadastros() ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canWriteCadastros() ? 8 : 7) + '">Nenhum veículo cadastrado.</td></tr>';
  rows.forEach(v => {
    html += '<tr><td class="mono"><strong>' + esc(v.placa) + '</strong></td><td>' + badgeTipo(v.tipo) + '</td>' +
      '<td>' + esc(v.modelo || '—') + '</td><td>' + esc(v.cor || '—') + '</td>' +
      '<td>' + esc(v.proprietario || '—') + '</td><td>' + esc(v.motorista || '—') + '</td>' +
      '<td>' + esc(v.obs || '—') + '</td>' +
      (canWriteCadastros()
        ? '<td class="actions">' + btnIcon('btn-ghost', 'Editar', 'abrirFormVeiculo(\'' + v.id + '\')', ICO.edit) +
          btnIcon('btn-danger', 'Excluir', 'excluirVeiculo(\'' + v.id + '\')', ICO.trash) + '</td>'
        : '') + '</tr>';
  });
  document.getElementById('veiTable').innerHTML = html + '</tbody>';
}

function abrirFormVeiculo(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode alterar veiculos.')) return;
  const v = id ? DB.veiculos.find(x => x.id === id) : null;
  const tipos = ['carro', 'moto', 'caminhão', 'carreta', 'utilitário', 'outro'];
  const motoristas = DB.motoristas.map(m => m.nome);
  abrirModal(v ? 'Editar veículo' : 'Novo veículo',
    '<div class="form-grid">' +
    campo('cve_placa', 'Placa *', v ? v.placa : '') +
    '<div class="field"><label>Tipo</label><select id="cve_tipo">' +
    tipos.map(t => '<option value="' + t + '"' + (v && v.tipo === t ? ' selected' : '') + '>' + t + '</option>').join('') +
    '</select></div>' +
    campo('cve_modelo', 'Marca / Modelo', v ? v.modelo : '') +
    campo('cve_cor', 'Cor', v ? v.cor : '') +
    campo('cve_prop', 'Proprietário / Empresa', v ? v.proprietario : '') +
    '<div class="field"><label>Motorista vinculado</label><select id="cve_motorista">' +
    '<option value="">— Nenhum —</option>' +
    motoristas.map(n => '<option value="' + esc(n) + '"' + (v && v.motorista === n ? ' selected' : '') + '>' + esc(n) + '</option>').join('') +
    '</select></div>' +
    '<div class="field full"><label>Observações</label><textarea id="cve_obs">' + esc(v ? v.obs : '') + '</textarea></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarVeiculo(' + (v ? '\'' + v.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
}

function salvarVeiculo_legacy(id) {
  const placa = document.getElementById('cve_placa').value.trim().toUpperCase();
  if (!placa) { toast('Informe a placa do veículo.', 'error'); return; }
  const dados = {
    placa: placa,
    tipo: document.getElementById('cve_tipo').value,
    modelo: document.getElementById('cve_modelo').value.trim(),
    cor: document.getElementById('cve_cor').value.trim(),
    proprietario: document.getElementById('cve_prop').value.trim(),
    motorista: document.getElementById('cve_motorista').value,
    obs: document.getElementById('cve_obs').value.trim()
  };
  if (id) {
    Object.assign(DB.veiculos.find(x => x.id === id), dados);
    toast('Veículo atualizado.');
  } else {
    DB.veiculos.push(Object.assign({ id: uid() }, dados));
    toast('Veículo cadastrado.');
  }
  saveDB('veiculos'); fecharModal(); renderVeiculos();
}

function excluirVeiculo_legacy(id) {
  const v = DB.veiculos.find(x => x.id === id);
  confirmar('Excluir o veículo de placa "' + v.placa + '"? Esta ação não pode ser desfeita.', function () {
    DB.veiculos = DB.veiculos.filter(x => x.id !== id);
    saveDB('veiculos'); renderVeiculos(); toast('Veículo excluído.');
  });
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

function toggleEmergencia_legacy(id) {
  const r = DB.ramais.find(x => x.id === id);
  if (!r) return;
  r.emergencia = !r.emergencia;
  saveDB('ramais');
  renderRamais();
  toast(r.emergencia ? 'Adicionado à emergência: ' + r.setor : 'Removido da emergência: ' + r.setor);
}

function renderRamais_legacy() {
  const sortPt = (a, b, f) => String(a[f] || '').localeCompare(String(b[f] || ''), 'pt', { numeric: true, sensitivity: 'base' });

  /* ---- Faixa de contatos de emergência (destaque no topo) ---- */
  const emrg = DB.ramais.filter(r => r.emergencia).sort((a, b) => sortPt(a, b, 'setor'));
  const cont = document.getElementById('ramaisEmergencia');
  if (emrg.length) {
    cont.style.display = '';
    cont.innerHTML = '<div class="emrg-head">⚠ Contatos de emergência</div><div class="emrg-grid">' +
      emrg.map(r => {
        const tel = (r.celular || '').replace(/[^0-9+]/g, '');
        return '<div class="emrg-card">' +
          '<div class="ec-setor">' + esc(r.setor) + '</div>' +
          '<div class="ec-nome">' + esc(r.responsavel || '—') + '</div>' +
          '<div class="ec-linha">Ramal <strong>' + esc(r.ramal || '—') + '</strong></div>' +
          (r.celular ? '<div class="ec-linha">📱 <a href="tel:' + esc(tel) + '">' + esc(fmtCelular(r.celular)) + '</a></div>' : '') +
          '</div>';
      }).join('') + '</div>';
  } else {
    cont.style.display = 'none';
    cont.innerHTML = '';
  }

  /* ---- Tabela ---- */
  const q = norm(document.getElementById('ramalBusca').value);
  let rows = DB.ramais.slice();
  if (ramalSoEmrg) rows = rows.filter(r => r.emergencia);
  if (q) rows = rows.filter(r =>
    norm(r.setor).includes(q) || norm(r.ramal).includes(q) || norm(r.responsavel).includes(q) ||
    norm(r.celular).includes(q) || norm(r.email).includes(q));
  rows.sort((a, b) => ramalSort.dir * sortPt(a, b, ramalSort.col));

  const ind = c => ramalSort.col === c ? ' <span class="sort-ind">' + (ramalSort.dir > 0 ? '▲' : '▼') + '</span>' : '';
  let html = '<colgroup>' +
    '<col style="width:32px">' +        // estrela
    '<col style="width:18%">' +         // setor
    '<col style="width:62px">' +        // ramal
    '<col>' +                           // responsável (flex)
    '<col style="width:118px">' +       // celular (xx xxxxx xxxx)
    '<col style="width:215px">' +       // e-mail (nome@marcher.com.br)
    '<col style="width:13%">' +         // obs
    '<col style="width:92px">' +        // ações (ícones)
    '</colgroup>' +
    '<thead><tr>' +
    '<th title="Emergência"></th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'setor\')">Setor / Local' + ind('setor') + '</th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'ramal\')">Ramal' + ind('ramal') + '</th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'responsavel\')">Responsável' + ind('responsavel') + '</th>' +
    '<th>Celular</th><th>E-mail</th><th>Obs.</th><th></th></tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="8">Nenhum ramal encontrado.</td></tr>';
  rows.forEach(r => {
    const tel = (r.celular || '').replace(/[^0-9+]/g, '');
    html += '<tr class="' + (r.emergencia ? 'emrg-row' : '') + '">' +
      '<td><button class="star-btn' + (r.emergencia ? ' on' : '') + '" title="' + (r.emergencia ? 'Remover de emergência' : 'Marcar como contato de emergência') + '" onclick="toggleEmergencia(\'' + r.id + '\')">' + (r.emergencia ? '★' : '☆') + '</button></td>' +
      '<td><strong>' + esc(r.setor) + '</strong></td><td class="mono">' + esc(r.ramal || '—') + '</td>' +
      '<td>' + esc(r.responsavel || '—') + '</td>' +
      '<td class="mono">' + (r.celular ? '<a href="tel:' + esc(tel) + '">' + esc(fmtCelular(r.celular)) + '</a>' : '—') + '</td>' +
      '<td>' + (r.email ? '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>' : '—') + '</td>' +
      '<td>' + esc(r.obs || '—') + '</td>' +
      '<td class="actions">' + btnIcon('btn-ghost', 'Editar', 'abrirFormRamal(\'' + r.id + '\')', ICO.edit) +
      btnIcon('btn-danger', 'Excluir', 'excluirRamal(\'' + r.id + '\')', ICO.trash) + '</td></tr>';
  });
  document.getElementById('ramaisTable').innerHTML = html + '</tbody>';
}

function abrirFormRamal(id) {
  const r = id ? DB.ramais.find(x => x.id === id) : null;
  abrirModal(r ? 'Editar ramal' : 'Novo ramal',
    '<div class="form-grid">' +
    campo('cr_setor', 'Setor / Local *', r ? r.setor : '') +
    campo('cr_ramal', 'Ramal *', r ? r.ramal : '') +
    campo('cr_resp', 'Responsável', r ? r.responsavel : '') +
    '<div class="field"><label>Celular</label><input id="cr_celular" type="text" inputmode="numeric" maxlength="13" placeholder="51 99999 9999" oninput="mascaraCelular(this)" value="' + esc(r ? fmtCelular(r.celular) : '') + '"></div>' +
    '<div class="field"><label>E-mail</label><input id="cr_email" type="email" placeholder="nome@marcher.com.br" value="' + esc(r ? r.email : '') + '"></div>' +
    '<div class="field full"><label>Observações</label><textarea id="cr_obs">' + esc(r ? r.obs : '') + '</textarea></div>' +
    '<div class="field full"><label class="ac-proposta" style="margin:0" for="cr_emrg"><input type="checkbox" id="cr_emrg"' + (r && r.emergencia ? ' checked' : '') + '><span><strong>Contato de emergência</strong><br><span class="muted">Fica em destaque no topo da Lista de Ramais</span></span></label></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarRamal(' + (r ? '\'' + r.id + '\'' : 'null') + ')">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
}

function salvarRamal_legacy(id) {
  const setor = document.getElementById('cr_setor').value.trim();
  const ramal = document.getElementById('cr_ramal').value.trim();
  if (!setor || !ramal) { toast('Preencha Setor e Ramal.', 'error'); return; }
  const dados = {
    setor: setor, ramal: ramal,
    responsavel: document.getElementById('cr_resp').value.trim(),
    celular: fmtCelular(document.getElementById('cr_celular').value),
    email: document.getElementById('cr_email').value.trim(),
    emergencia: document.getElementById('cr_emrg').checked,
    obs: document.getElementById('cr_obs').value.trim()
  };
  if (id) {
    Object.assign(DB.ramais.find(x => x.id === id), dados);
    toast('Ramal atualizado.');
  } else {
    DB.ramais.push(Object.assign({ id: uid() }, dados));
    toast('Ramal cadastrado.');
  }
  saveDB('ramais'); fecharModal(); renderRamais();
}

function excluirRamal_legacy(id) {
  const r = DB.ramais.find(x => x.id === id);
  confirmar('Excluir o ramal de "' + r.setor + '"? Esta ação não pode ser desfeita.', function () {
    DB.ramais = DB.ramais.filter(x => x.id !== id);
    saveDB('ramais'); renderRamais(); toast('Ramal excluído.');
  });
}

/* ============================================================
   ENTREGAS
   ============================================================ */
function renderEntregas_legacy() {
  const q = norm(document.getElementById('entregaBusca').value);
  const st = document.getElementById('entregaStatusFiltro').value;
  let rows = DB.entregas.slice();
  if (q) rows = rows.filter(e => norm(e.fornecedor).includes(q) || norm(e.nf).includes(q) ||
    norm(e.motorista).includes(q) || norm(e.placa).includes(q) || norm(e.descricao).includes(q));
  if (st) rows = rows.filter(e => e.status === st);
  rows = sortRows(rows, 'entregas');
  let html = '<thead><tr>' +
    thSort('entregas', 'data', 'Data') + thSort('entregas', 'tipo', 'Tipo') + thSort('entregas', 'fornecedor', 'Fornecedor/Transp.') +
    thSort('entregas', 'nf', 'NF/Doc.') + thSort('entregas', 'descricao', 'Produtos') + thSort('entregas', 'volumes', 'Vol.') +
    thSort('entregas', 'destinatario', 'Destinatário') + thSort('entregas', 'setor', 'Setor') + thSort('entregas', 'status', 'Status') +
    '<th></th></tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="10">Nenhuma entrega encontrada.</td></tr>';
  rows.forEach(e => {
    html += '<tr><td class="mono">' + fmtDataHora(e.data) + '</td><td>' + badgeTipo(e.tipo) + '</td>' +
      '<td><strong>' + esc(e.fornecedor) + '</strong></td><td class="mono">' + esc(e.nf || '—') + '</td>' +
      '<td>' + esc(e.descricao || '—') + '</td><td class="mono">' + esc(e.volumes) + '</td>' +
      '<td>' + esc(e.destinatario || '—') + '</td><td>' + esc(e.setor || '—') + '</td>' +
      '<td>' + badgeStatus(e.status) + '</td><td class="actions">' +
      (e.status !== 'entregue' && e.status !== 'cancelado'
        ? btnIcon('btn-success', 'Marcar como entregue', 'baixarEntrega(\'' + e.id + '\')', ICO.check) : '') +
      btnIcon('btn-ghost', 'Editar', 'abrirFormEntrega(\'' + e.id + '\')', ICO.edit) +
      btnIcon('btn-danger', 'Excluir', 'excluirEntrega(\'' + e.id + '\')', ICO.trash) + '</td></tr>';
  });
  document.getElementById('entregasTable').innerHTML = html + '</tbody>';
}

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
    campo('ce_dest', 'Destinatário interno', e ? e.destinatario : '') +
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

function salvarEntrega_legacy(id) {
  const fornecedor = document.getElementById('ce_fornecedor').value.trim();
  if (!fornecedor) { toast('Informe o fornecedor ou transportadora.', 'error'); return; }
  const dados = {
    tipo: document.getElementById('ce_tipo').value,
    fornecedor: fornecedor,
    motorista: document.getElementById('ce_motorista').value.trim(),
    placa: document.getElementById('ce_placa').value.trim().toUpperCase(),
    nf: document.getElementById('ce_nf').value.trim(),
    descricao: document.getElementById('ce_desc').value.trim(),
    volumes: parseInt(document.getElementById('ce_volumes').value, 10) || 0,
    destinatario: document.getElementById('ce_dest').value.trim(),
    setor: document.getElementById('ce_setor').value.trim(),
    status: document.getElementById('ce_status').value,
    obs: document.getElementById('ce_obs').value.trim()
  };
  if (id) {
    Object.assign(DB.entregas.find(x => x.id === id), dados);
    toast('Entrega atualizada.');
  } else {
    DB.entregas.push(Object.assign({ id: uid(), data: new Date().toISOString() }, dados));
    toast('Entrega registrada.');
  }
  saveDB('entregas'); fecharModal(); renderEntregas(); renderDashboard();
}

function baixarEntrega_legacy(id) {
  const e = DB.entregas.find(x => x.id === id);
  if (!e) return;
  e.status = 'entregue';
  saveDB('entregas'); renderEntregas(); renderDashboard();
  toast('Entrega baixada como "Entregue": ' + e.fornecedor);
}

function excluirEntrega_legacy(id) {
  const e = DB.entregas.find(x => x.id === id);
  confirmar('Excluir a entrega de "' + e.fornecedor + '" (' + (e.nf || 'sem NF') + ')? Esta ação não pode ser desfeita.', function () {
    DB.entregas = DB.entregas.filter(x => x.id !== id);
    saveDB('entregas'); renderEntregas(); renderDashboard(); toast('Entrega excluída.');
  });
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
  if (!ensureAllowed(canAccessReports(), 'Seu perfil nao pode gerar relatorios.')) return;
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
  if (!ensureAllowed(canAccessReports(), 'Seu perfil nao pode gerar relatorios.')) return;
  if (!DB.entregas.length) { toast('Nenhuma entrega para exportar.', 'warn'); return; }
  const csv = toCSV(
    ['Data', 'Tipo', 'Fornecedor/Transportadora', 'Motorista', 'Placa', 'NF/Documento', 'Descricao', 'Volumes', 'Destinatario', 'Setor', 'Status', 'Observacoes'],
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

/* ============================================================
   BUSCA GLOBAL
   ============================================================ */
const searchInput = document.getElementById('globalSearch');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', function () {
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
      searchResults.innerHTML = '<div class="sr-empty">Nenhum resultado disponivel para o seu perfil.</div>';
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
});

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
      placasVistas.add(norm(v.placa));
      const mot = v.motorista ? DB.motoristas.find(m => m.nome === v.motorista) : null;
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
    if (m.placaPadrao && temMatch(m.placaPadrao, q) && !placasVistas.has(norm(m.placaPadrao))) {
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

  input.addEventListener('input', function () {
    const q = norm(this.value.trim());
    if (q.length < 2) { fechar(); return; }
    itens = getSugestoes(q).slice(0, 8);
    ativo = -1;
    render();
  });

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

function abrirAreaUsuario_legacy() {
  const u = USUARIO;
  abrirModal('Área do usuário',
    '<div class="form-grid">' +
    fotoField() +
    '<div class="field"><label>Nome <span class="req">*</span></label><input id="us_nome" type="text" maxlength="' + LIMITE_NOME + '" placeholder="Nome" value="' + esc(u.nome) + '"></div>' +
    '<div class="field"><label>Sobrenome</label><input id="us_sobrenome" type="text" maxlength="' + LIMITE_NOME + '" placeholder="Sobrenome" value="' + esc(u.sobrenome || '') + '"></div>' +
    '<div class="field"><label>Celular</label><input id="us_celular" type="text" inputmode="numeric" maxlength="13" placeholder="51 99999 9999" oninput="mascaraCelular(this)" value="' + esc(fmtCelular(u.celular)) + '"></div>' +
    '<div class="field"><label>E-mail</label><input id="us_email" type="email" placeholder="nome@marcher.com.br" value="' + esc(u.email || '') + '"></div>' +
    '<div class="field"><label>Perfil de acesso</label><select id="us_perfil">' +
    '<option value="Administrador"' + (u.perfil === 'Administrador' ? ' selected' : '') + '>Administrador</option>' +
    '<option value="Porteiro"' + (u.perfil === 'Porteiro' ? ' selected' : '') + '>Porteiro</option></select></div>' +
    '<div class="field full"><div class="muted" style="font-size:.74rem">Nome + sobrenome são limitados a ' + LIMITE_NOME + ' caracteres para não quebrar no rodapé. As permissões de cada perfil serão definidas na próxima etapa.</div></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-primary" onclick="salvarUsuario()">Salvar</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>');
  setFotoPreview(u.foto || '');
}

function salvarUsuario_legacy() {
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
  USUARIO.perfil = document.getElementById('us_perfil').value;
  USUARIO.foto = fotoBuffer;
  saveUsuario();
  saveProfileRemote(USUARIO);
  renderUserCard();
  fecharModal();
  toast('Perfil atualizado.');
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
    toast(e.message || 'Falha ao carregar usuarios.', 'error');
  }
}

async function salvarPerfilUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem alterar perfis.')) return;
  if (USUARIO.id && id === USUARIO.id) {
    toast('Seu proprio perfil deve ser mantido como esta nesta tela.', 'warn');
    return;
  }
  const el = document.getElementById('perfil_' + id);
  if (!el) return;
  const perfilDestino = normalizeRole(el.value);
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!canEditUserRole(usuarioAlvo?.perfil) || !getAssignableRoles().includes(perfilDestino)) {
    toast('Seu perfil nao pode aplicar essa alteracao.', 'warn');
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

function abrirAjudaCadastroUsuario_legacy() {
  abrirModal('Cadastrar usuario',
    '<div class="form-grid">' +
    '<div class="field full"><div class="report-card" style="padding:14px 16px;box-shadow:none;border:1px solid #e3e3de">' +
    '<h4>Como cadastrar um novo usuario</h4>' +
    '<p>O login ainda e criado no painel do Supabase. Depois ele aparece aqui para voce definir o perfil.</p>' +
    '<p><strong>Passo 1.</strong> Abra o projeto no Supabase.</p>' +
    '<p><strong>Passo 2.</strong> Va em <strong>Authentication &gt; Users</strong>.</p>' +
    '<p><strong>Passo 3.</strong> Clique em <strong>Add user</strong> e informe e-mail e senha.</p>' +
    '<p><strong>Passo 4.</strong> Volte nesta tela e clique em <strong>Atualizar lista</strong>.</p>' +
    '<p><strong>Passo 5.</strong> Escolha o perfil <strong>Administrador</strong>, <strong>Segurança</strong> ou <strong>Consultas</strong> e salve.</p>' +
    '</div></div>' +
    '<div class="field full"><div class="muted">Se voce quiser, eu posso colocar depois um backend seguro para criar usuarios direto pelo app. Hoje isso nao e feito no front porque exigiria credenciais administrativas do Supabase.</div></div>' +
    '</div><div class="form-foot">' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Fechar</button></div>', true);
}

function abrirAjudaCadastroUsuario() {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem cadastrar usuarios.')) return;
  const perfisDisponiveis = getAssignableRoles();
  abrirModal('Cadastrar usuario',
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
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem cadastrar usuarios.')) return;
  const email = document.getElementById('novoUserEmail')?.value.trim().toLowerCase();
  const perfil = normalizeRole(document.getElementById('novoUserPerfil')?.value || ROLE_CONSULTA);
  if (!email) {
    toast('Informe o e-mail do usuario.', 'error');
    return;
  }
  if (!getAssignableRoles().includes(perfil)) {
    toast('Seu perfil nao pode convidar usuarios com esse papel.', 'warn');
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
    host.innerHTML = '<tbody><tr class="empty-row"><td>Somente Admin e Super Admin acessam esta area.</td></tr></tbody>';
    return;
  }
  const q = norm((document.getElementById('usuariosBusca')?.value || '').trim());
  const rows = (PERFIS_USUARIOS || []).filter((u) => {
    if (!q) return true;
    return norm((u.nome || '') + ' ' + (u.sobrenome || '')).includes(q)
      || norm(u.email || '').includes(q)
      || norm(u.perfil || '').includes(q);
  });
  let html = '<thead><tr><th>Usuario</th><th>E-mail</th><th>Perfil atual</th><th>Trocar perfil</th><th></th></tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="5">Nenhum usuario encontrado.</td></tr>';
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
      '<td>' + esc(u.email || '—') + '</td>' +
      '<td><div class="users-status-cell">' + perfilBadge(perfilAtual) + statusBadge(u.ativo) + '</div></td>' +
      '<td><select id="perfil_' + u.id + '"' + (disabled ? ' disabled' : '') + '>' +
      opcoesPerfil.map((perfil) => '<option value="' + perfil + '"' + (perfilAtual === perfil ? ' selected' : '') + '>' + perfil + '</option>').join('') +
      '</select></td>' +
      '<td>' + (locked
        ? '<span class="users-lock">Usuario atual</span>'
        : bloqueadoPorPapel
          ? '<span class="users-lock">Somente Super Admin</span>'
          : '<div class="users-actions">' +
              btnIcon('btn-primary', 'Salvar perfil', 'salvarPerfilUsuario(\'' + u.id + '\')', ICO.check) +
              btnIcon(u.ativo === false ? 'btn-success' : 'btn-ghost', u.ativo === false ? 'Ativar usuario' : 'Desativar usuario', 'alternarStatusUsuario(\'' + u.id + '\')', ICO.power) +
              btnIcon('btn-danger', 'Excluir usuario', 'excluirUsuario(\'' + u.id + '\')', ICO.trash) +
            '</div>') + '</td></tr>';
  });
  host.innerHTML = html + '</tbody>';
}

function abrirAreaUsuario() {
  const u = USUARIO;
  abrirModal('Area do usuario',
    '<div class="form-grid">' +
    fotoField() +
    '<div class="field"><label>Nome <span class="req">*</span></label><input id="us_nome" type="text" maxlength="' + LIMITE_NOME + '" placeholder="Nome" value="' + esc(u.nome) + '"></div>' +
    '<div class="field"><label>Sobrenome</label><input id="us_sobrenome" type="text" maxlength="' + LIMITE_NOME + '" placeholder="Sobrenome" value="' + esc(u.sobrenome || '') + '"></div>' +
    '<div class="field"><label>Celular</label><input id="us_celular" type="text" inputmode="numeric" maxlength="13" placeholder="51 99999 9999" oninput="mascaraCelular(this)" value="' + esc(fmtCelular(u.celular)) + '"></div>' +
    '<div class="field"><label>E-mail</label><input id="us_email" type="email" placeholder="nome@marcher.com.br" value="' + esc(u.email || '') + '"></div>' +
    '<div class="field"><label>Perfil de acesso</label><div>' + perfilBadge(u.perfil || 'Consultas') + '</div></div>' +
    '<div class="field full"><div class="muted" style="font-size:.74rem">Seu perfil e gerenciado pelo administrador na tela Usuarios e Perfis.</div></div>' +
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

async function alternarStatusUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem alterar usuarios.')) return;
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!usuarioAlvo) return;
  if (USUARIO.id && id === USUARIO.id) {
    toast('Voce nao pode desativar seu proprio usuario.', 'warn');
    return;
  }
  if (!canEditUserRole(usuarioAlvo.perfil)) {
    toast('Seu perfil nao pode alterar este usuario.', 'warn');
    return;
  }
  const proximoAtivo = usuarioAlvo.ativo === false;
  try {
    await updateUserStatusRemote(id, proximoAtivo);
    await recarregarUsuarios();
    toast(proximoAtivo ? 'Usuario ativado.' : 'Usuario desativado.');
  } catch (e) {
    toast(e.message || 'Falha ao alterar status do usuario.', 'error');
  }
}

function excluirUsuario(id) {
  if (!ensureAllowed(canManageUsers(), 'Somente Admin e Super Admin podem excluir usuarios.')) return;
  const usuarioAlvo = (PERFIS_USUARIOS || []).find((u) => u.id === id);
  if (!usuarioAlvo) return;
  if (USUARIO.id && id === USUARIO.id) {
    toast('Voce nao pode excluir seu proprio usuario.', 'warn');
    return;
  }
  if (!canEditUserRole(usuarioAlvo.perfil)) {
    toast('Seu perfil nao pode excluir este usuario.', 'warn');
    return;
  }
  const nome = ((usuarioAlvo.nome || '') + ' ' + (usuarioAlvo.sobrenome || '')).trim() || usuarioAlvo.email || 'Sem nome';
  confirmar('Excluir o usuario "' + nome + '"? Esta acao nao pode ser desfeita.', async function () {
    try {
      await deleteUserRemote(id);
      await recarregarUsuarios();
      toast('Usuario excluido.');
    } catch (e) {
      toast(e.message || 'Falha ao excluir usuario.', 'error');
    }
  });
}

async function salvarUsuario() {
  const nome = document.getElementById('us_nome').value.trim();
  const sobrenome = document.getElementById('us_sobrenome').value.trim();
  if (!nome) { toast('Informe ao menos o nome.', 'error'); return; }
  const completo = (nome + ' ' + sobrenome).trim();
  if (completo.length > LIMITE_NOME) {
    toast('Nome + sobrenome deve ter ate ' + LIMITE_NOME + ' caracteres (atual: ' + completo.length + ').', 'error');
    return;
  }
  USUARIO.nome = nome;
  USUARIO.sobrenome = sobrenome;
  USUARIO.celular = fmtCelular(document.getElementById('us_celular').value);
  USUARIO.email = document.getElementById('us_email').value.trim();
  try {
    USUARIO.foto = await uploadPhotoIfNeeded('profiles', USUARIO.id || 'perfil', fotoBuffer, USUARIO.foto || '');
    saveUsuario();
    await saveProfileRemote(USUARIO);
    renderUserCard();
    fecharModal();
    toast('Perfil atualizado.');
  } catch (e) {
    toast(e.message || 'Falha ao salvar perfil.', 'error');
  }
}

function oferecerCadastro(reg) {
  if (!ensureAllowed(canQuickSaveCadastros(), 'Seu perfil nao pode salvar cadastros rapidos pela entrada.')) return false;
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
          const novo = { id: uid(), nome: reg.nome, documento: reg.documento, telefone: reg.telefone || '', empresa: reg.empresa || '', obs: reg.tipo === 'prestador' ? 'Prestador de servico' : '', ativo: true };
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
        titulo: 'Cadastrar veiculo',
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
    '<p class="confirm-text">Estes dados ainda nao estao nos cadastros. Salvar para agilizar as proximas entradas?</p>' +
    propostas.map((p, i) =>
      '<label class="ac-proposta" for="prop_' + i + '"><input type="checkbox" id="prop_' + i + '" checked>' +
      '<span><strong>' + esc(p.titulo) + '</strong><br><span class="muted">' + esc(p.linhas.join(' | ')) + '</span></span></label>'
    ).join('') +
    '<div class="form-foot" style="margin-top:14px">' +
    '<button class="btn btn-primary" id="propSalvar">Salvar selecionados</button>' +
    '<button class="btn btn-ghost" onclick="fecharModal()">Agora nao</button></div>';

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
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canWriteOperacao() ? 8 : 7) + '">Ninguem dentro no momento.</td></tr>';
  rows.forEach(a => {
    html += '<tr><td class="mono">' + fmtDataHora(a.entrada) + '</td><td>' + badgeTipo(a.tipo) + '</td>' +
      '<td><strong>' + esc(a.nome) + '</strong></td><td class="mono">' + esc(a.documento) + '</td>' +
      '<td>' + esc(a.empresa || '—') + '</td><td class="mono">' + esc(a.placa || '—') + '</td>' +
      '<td>' + esc(a.visitado || '—') + '</td>' +
      (canWriteOperacao() ? '<td>' + btnIcon('btn-success', 'Registrar saida', 'registrarSaida(\'' + a.id + '\')', ICO.exit) + '</td>' : '') + '</tr>';
  });
  document.getElementById('saidaTable').innerHTML = html + '</tbody>';
}

function registrarSaida(id) {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil nao pode registrar saidas.')) return;
  const a = DB.acessos.find(x => x.id === id);
  if (!a) return;
  a.saida = new Date().toISOString();
  a.status = 'Saiu';
  saveDB('acessos', a);
  toast('Saida registrada: ' + a.nome);
  renderAll();
}

async function salvarVisitante(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode salvar visitantes.')) return;
  const nome = document.getElementById('cv_nome').value.trim();
  const doc = document.getElementById('cv_doc').value.trim();
  if (!nome || !doc) { toast('Preencha Nome e Documento.', 'error'); return; }
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
    const fotoAnterior = row.foto || '';
    const fotoFinal = await uploadPhotoIfNeeded('visitantes', row.id, fotoBuffer, fotoAnterior);
    Object.assign(row, dados, { foto: fotoFinal });
    if (!id) DB.visitantes.push(row);
    saveDB('visitantes', row);
    fecharModal();
    renderVisitantes();
    toast(id ? 'Visitante atualizado.' : 'Visitante cadastrado.');
  } catch (e) {
    toast(e.message || 'Falha ao salvar visitante.', 'error');
  }
}

function excluirVisitante(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode excluir visitantes.')) return;
  const v = DB.visitantes.find(x => x.id === id);
  confirmar('Excluir o visitante "' + v.nome + '"? Esta acao nao pode ser desfeita.', async function () {
    DB.visitantes = DB.visitantes.filter(x => x.id !== id);
    deleteDB('visitantes', id);
    try { await deleteManagedPhoto(v.foto || ''); } catch (e) { console.warn(e); }
    renderVisitantes();
    toast('Visitante excluido.');
  });
}

async function salvarMotorista(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode salvar motoristas.')) return;
  const nome = document.getElementById('cm_nome').value.trim();
  const doc = document.getElementById('cm_doc').value.trim();
  if (!nome || !doc) { toast('Preencha Nome e Documento.', 'error'); return; }
  const dados = {
    nome,
    documento: doc,
    telefone: document.getElementById('cm_tel').value.trim(),
    transportadora: document.getElementById('cm_transp').value.trim(),
    placaPadrao: document.getElementById('cm_placa').value.trim().toUpperCase(),
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
    const fotoAnterior = row.foto || '';
    const fotoFinal = await uploadPhotoIfNeeded('motoristas', row.id, fotoBuffer, fotoAnterior);
    Object.assign(row, dados, { foto: fotoFinal });
    if (!id) DB.motoristas.push(row);
    saveDB('motoristas', row);
    fecharModal();
    renderMotoristas();
    toast(id ? 'Motorista atualizado.' : 'Motorista cadastrado.');
  } catch (e) {
    toast(e.message || 'Falha ao salvar motorista.', 'error');
  }
}

function excluirMotorista(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode excluir motoristas.')) return;
  const m = DB.motoristas.find(x => x.id === id);
  confirmar('Excluir o motorista "' + m.nome + '"? Esta acao nao pode ser desfeita.', async function () {
    DB.motoristas = DB.motoristas.filter(x => x.id !== id);
    deleteDB('motoristas', id);
    try { await deleteManagedPhoto(m.foto || ''); } catch (e) { console.warn(e); }
    renderMotoristas();
    toast('Motorista excluido.');
  });
}

function salvarVeiculo(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode salvar veiculos.')) return;
  const placa = document.getElementById('cve_placa').value.trim().toUpperCase();
  if (!placa) { toast('Informe a placa do veiculo.', 'error'); return; }
  const dados = {
    placa,
    tipo: document.getElementById('cve_tipo').value,
    modelo: document.getElementById('cve_modelo').value.trim(),
    cor: document.getElementById('cve_cor').value.trim(),
    proprietario: document.getElementById('cve_prop').value.trim(),
    motorista: document.getElementById('cve_motorista').value.trim(),
    obs: document.getElementById('cve_obs').value.trim()
  };
  let row;
  if (id) {
    row = DB.veiculos.find(x => x.id === id);
    Object.assign(row, dados);
    toast('Veiculo atualizado.');
  } else {
    row = Object.assign({ id: uid() }, dados);
    DB.veiculos.push(row);
    toast('Veiculo cadastrado.');
  }
  saveDB('veiculos', row);
  fecharModal();
  renderVeiculos();
}

function excluirVeiculo(id) {
  if (!ensureAllowed(canWriteCadastros(), 'Seu perfil nao pode excluir veiculos.')) return;
  const v = DB.veiculos.find(x => x.id === id);
  confirmar('Excluir o veiculo "' + v.placa + '"? Esta acao nao pode ser desfeita.', function () {
    DB.veiculos = DB.veiculos.filter(x => x.id !== id);
    deleteDB('veiculos', id);
    renderVeiculos();
    toast('Veiculo excluido.');
  });
}

function toggleEmergencia(id) {
  if (!ensureAllowed(canFavoriteRamais(), 'Seu perfil nao pode favoritar contatos.')) return;
  const r = DB.ramais.find(x => x.id === id);
  if (!r) return;
  r.emergencia = !r.emergencia;
  saveDB('ramais', r);
  renderRamais();
  toast(r.emergencia ? 'Adicionado a emergencia: ' + r.setor : 'Removido da emergencia: ' + r.setor);
}

function renderRamais() {
  const sortPt = (a, b, f) => String(a[f] || '').localeCompare(String(b[f] || ''), 'pt', { numeric: true, sensitivity: 'base' });
  const emrg = DB.ramais.filter(r => r.emergencia).sort((a, b) => sortPt(a, b, 'setor'));
  const cont = document.getElementById('ramaisEmergencia');
  if (emrg.length) {
    cont.style.display = '';
    cont.innerHTML = '<div class="emrg-head">Contatos de emergencia</div><div class="emrg-grid">' +
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

  const ind = c => ramalSort.col === c ? ' <span class="sort-ind">' + (ramalSort.dir > 0 ? '▲' : '▼') + '</span>' : '';
  let html = '<colgroup>' +
    '<col style="width:32px">' +
    '<col style="width:18%">' +
    '<col style="width:62px">' +
    '<col>' +
    '<col style="width:118px">' +
    '<col style="width:215px">' +
    '<col style="width:13%">' +
    (canManageRamais() ? '<col style="width:92px">' : '') +
    '</colgroup><thead><tr>' +
    '<th title="Emergencia"></th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'setor\')">Setor / Local' + ind('setor') + '</th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'ramal\')">Ramal' + ind('ramal') + '</th>' +
    '<th class="th-sort" onclick="ordenarRamais(\'responsavel\')">Responsavel' + ind('responsavel') + '</th>' +
    '<th>Celular</th><th>E-mail</th><th>Obs.</th>' + (canManageRamais() ? '<th></th>' : '') + '</tr></thead><tbody>';
  if (!rows.length) html += '<tr class="empty-row"><td colspan="' + (canManageRamais() ? 8 : 7) + '">Nenhum ramal encontrado.</td></tr>';
  rows.forEach(r => {
    const tel = (r.celular || '').replace(/[^0-9+]/g, '');
    html += '<tr class="' + (r.emergencia ? 'emrg-row' : '') + '">' +
      '<td>' + (canFavoriteRamais()
        ? '<button class="star-btn' + (r.emergencia ? ' on' : '') + '" title="' + (r.emergencia ? 'Remover de emergencia' : 'Marcar como contato de emergencia') + '" onclick="toggleEmergencia(\'' + r.id + '\')">' + (r.emergencia ? '★' : '☆') + '</button>'
        : (r.emergencia ? '★' : '')) + '</td>' +
      '<td><strong>' + esc(r.setor) + '</strong></td><td class="mono">' + esc(r.ramal || '—') + '</td>' +
      '<td>' + esc(r.responsavel || '—') + '</td>' +
      '<td class="mono">' + (r.celular ? '<a href="tel:' + esc(tel) + '">' + esc(fmtCelular(r.celular)) + '</a>' : '—') + '</td>' +
      '<td>' + (r.email ? '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>' : '—') + '</td>' +
      '<td>' + esc(r.obs || '—') + '</td>' +
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
    obs: document.getElementById('cr_obs').value.trim()
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
  confirmar('Excluir o ramal de "' + r.setor + '"? Esta acao nao pode ser desfeita.', function () {
    DB.ramais = DB.ramais.filter(x => x.id !== id);
    deleteDB('ramais', id);
    renderRamais();
    toast('Ramal excluido.');
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
    thSort('entregas', 'destinatario', 'Destinatario') + thSort('entregas', 'setor', 'Setor') + thSort('entregas', 'status', 'Status') +
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
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil nao pode salvar entregas.')) return;
  const fornecedor = document.getElementById('ce_fornecedor').value.trim();
  if (!fornecedor) { toast('Informe o fornecedor ou transportadora.', 'error'); return; }
  const dados = {
    tipo: document.getElementById('ce_tipo').value,
    fornecedor,
    motorista: document.getElementById('ce_motorista').value.trim(),
    placa: document.getElementById('ce_placa').value.trim().toUpperCase(),
    nf: document.getElementById('ce_nf').value.trim(),
    descricao: document.getElementById('ce_desc').value.trim(),
    volumes: parseInt(document.getElementById('ce_volumes').value, 10) || 0,
    destinatario: document.getElementById('ce_dest').value.trim(),
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
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil nao pode baixar entregas.')) return;
  const e = DB.entregas.find(x => x.id === id);
  if (!e) return;
  e.status = 'entregue';
  saveDB('entregas', e);
  renderEntregas();
  renderDashboard();
  toast('Entrega baixada como "Entregue": ' + e.fornecedor);
}

function excluirEntrega(id) {
  if (!ensureAllowed(canWriteOperacao(), 'Seu perfil nao pode excluir entregas.')) return;
  const e = DB.entregas.find(x => x.id === id);
  confirmar('Excluir a entrega de "' + e.fornecedor + '" (' + (e.nf || 'sem NF') + ')? Esta acao nao pode ser desfeita.', function () {
    DB.entregas = DB.entregas.filter(x => x.id !== id);
    deleteDB('entregas', id);
    renderEntregas();
    renderDashboard();
    toast('Entrega excluida.');
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
  registrarEntrada,
  registrarSaida,
  removerFoto,
  renderEntregas,
  renderHistorico,
  renderMotoristas,
  renderRamais,
  renderSaida,
  renderUsuarios,
  renderVeiculos,
  renderVisitantes,
  recarregarUsuarios,
  restaurarJSON,
  alternarStatusUsuario,
  salvarEntrega,
  salvarMotorista,
  salvarPerfilUsuario,
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



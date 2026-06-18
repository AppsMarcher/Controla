/* Autenticacao + perfil. Em modo localStorage nao ha login;
   em modo Supabase exige login e le a tabela `profiles`. */
import { USE_SUPABASE } from './config.js';
import { supabase } from './data/client.js';

const PROFILE_FIELDS = 'id, nome, sobrenome, celular, email, foto, perfil, created_at';

export async function ensureAuth() {
  if (!USE_SUPABASE) return null;

  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user;

  return await showLogin();
}

function showLogin() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('loginOverlay');
    const form = document.getElementById('loginForm');
    const err = document.getElementById('loginErr');
    const btn = document.getElementById('loginBtn');
    const passInput = document.getElementById('loginPass');
    const passToggle = document.getElementById('loginPassToggle');
    const eyeOpen = passToggle?.querySelector('.eye-open');
    const eyeClosed = passToggle?.querySelector('.eye-closed');
    overlay.style.display = 'flex';

    if (passToggle && passInput && !passToggle.dataset.bound) {
      passToggle.dataset.bound = '1';
      passToggle.addEventListener('click', () => {
        const visible = passInput.type === 'text';
        passInput.type = visible ? 'password' : 'text';
        passToggle.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
        passToggle.setAttribute('title', visible ? 'Mostrar senha' : 'Ocultar senha');
        if (eyeOpen) eyeOpen.hidden = !visible;
        if (eyeClosed) eyeClosed.hidden = visible;
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPass').value;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (error) { err.textContent = 'E-mail ou senha invalidos.'; return; }
      overlay.style.display = 'none';
      resolve(data.user);
    });
  });
}

export async function currentProfile() {
  if (!USE_SUPABASE) return null;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', u.user.id)
    .maybeSingle();

  if (error) throw new Error('Falha ao carregar perfil: ' + error.message);
  if (data) return data;

  const novo = {
    id: u.user.id,
    nome: u.user.email.split('@')[0],
    sobrenome: '',
    celular: '',
    email: u.user.email,
    foto: '',
    perfil: 'Consulta'
  };
  const { error: createError } = await supabase.from('profiles').upsert(novo);
  if (createError) throw new Error('Falha ao criar perfil inicial: ' + createError.message);
  return novo;
}

export async function saveProfileRemote(usuario) {
  if (!USE_SUPABASE) return;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase.from('profiles').upsert({
    id: u.user.id,
    nome: usuario.nome,
    sobrenome: usuario.sobrenome,
    celular: usuario.celular,
    email: usuario.email,
    foto: usuario.foto
  });
  if (error) throw new Error('Falha ao salvar perfil: ' + error.message);
}

export async function loadProfilesRemote() {
  if (!USE_SUPABASE) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .order('created_at', { ascending: true });
  if (error) throw new Error('Falha ao carregar usuarios: ' + error.message);
  return data || [];
}

export async function updateProfileRoleRemote(id, perfil) {
  if (!USE_SUPABASE) return;
  const { error } = await supabase.from('profiles').update({ perfil }).eq('id', id);
  if (error) throw new Error('Falha ao atualizar perfil: ' + error.message);
}

export async function inviteUserRemote(email, perfil) {
  if (!USE_SUPABASE) throw new Error('Convite disponivel apenas com Supabase ativo.');
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email, perfil }
  });
  if (error) throw new Error('Falha ao enviar convite: ' + error.message);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export async function logout() {
  if (USE_SUPABASE) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Falha ao encerrar a sessao: ' + error.message);
  }
  try {
    sessionStorage.clear();
  } catch (e) { /* ignora */ }
  try {
    localStorage.removeItem('controla_user');
  } catch (e) { /* ignora */ }
  window.location.href = window.location.origin + window.location.pathname;
}

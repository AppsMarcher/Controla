/* Autenticação + perfil. Em modo localStorage não há login;
   em modo Supabase exige login e lê a tabela `profiles`. */
import { USE_SUPABASE } from './config.js';
import { supabase } from './data/client.js';

const PROFILE_FIELDS = 'id, nome, sobrenome, celular, email, foto, ativo, perfil, created_at';

function isRecoveryFlow() {
  const raw = window.location.hash + '&' + window.location.search;
  return /(?:^|[?#&])type=recovery(?:&|$)/.test(raw);
}

function getRecoveryRedirectUrl() {
  const { protocol, origin, pathname } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  return origin + pathname;
}

function setPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  const eyeOpen = toggle?.querySelector('.eye-open');
  const eyeClosed = toggle?.querySelector('.eye-closed');
  if (!toggle || !input || toggle.dataset.bound) return;
  toggle.dataset.bound = '1';
  toggle.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    toggle.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
    toggle.setAttribute('title', visible ? 'Mostrar senha' : 'Ocultar senha');
    if (eyeOpen) eyeOpen.hidden = !visible;
    if (eyeClosed) eyeClosed.hidden = visible;
  });
}

export async function ensureAuth() {
  if (!USE_SUPABASE) return null;

  const { data } = await supabase.auth.getSession();
  if (isRecoveryFlow()) {
    return await showRecovery(data.session?.user || null);
  }
  if (data.session) return data.session.user;

  return await showLogin();
}

function showLogin() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('loginOverlay');
    const form = document.getElementById('loginForm');
    const loginMode = document.getElementById('loginMode');
    const recoveryMode = document.getElementById('recoveryMode');
    const err = document.getElementById('loginErr');
    const btn = document.getElementById('loginBtn');
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    overlay.style.display = 'flex';
    if (loginMode) loginMode.style.display = '';
    if (recoveryMode) recoveryMode.style.display = 'none';

    setPasswordToggle('loginPassToggle', 'loginPass');

    if (forgotBtn && !forgotBtn.dataset.bound) {
      forgotBtn.dataset.bound = '1';
      forgotBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        err.textContent = '';
        if (!email) {
          err.textContent = 'Informe seu e-mail para receber o link de recuperação.';
          return;
        }
        forgotBtn.disabled = true;
        try {
          const redirectTo = getRecoveryRedirectUrl();
          const options = redirectTo ? { redirectTo } : undefined;
          const { error } = await supabase.auth.resetPasswordForEmail(email, options);
          if (error) throw error;
          err.textContent = 'Enviamos um link de redefinição para seu e-mail.';
        } catch (e) {
          err.textContent = e?.message || 'Não foi possível enviar o e-mail de recuperação.';
        } finally {
          forgotBtn.disabled = false;
        }
      });
    }

    if (!form.dataset.loginBound) {
      form.dataset.loginBound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (recoveryMode && recoveryMode.style.display !== 'none') return;
        err.textContent = '';
        btn.disabled = true;
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPass').value;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        btn.disabled = false;
        if (error) { err.textContent = 'E-mail ou senha inválidos.'; return; }
        overlay.style.display = 'none';
        resolve(data.user);
      });
    } else {
      form._resolveLogin = resolve;
    }
    form._resolveLogin = resolve;
  });
}

function showRecovery(userFromSession) {
  return new Promise((resolve, reject) => {
    const overlay = document.getElementById('loginOverlay');
    const form = document.getElementById('loginForm');
    const loginMode = document.getElementById('loginMode');
    const recoveryMode = document.getElementById('recoveryMode');
    const err = document.getElementById('recoveryErr');
    const btn = document.getElementById('recoveryBtn');
    const pass = document.getElementById('recoveryPass');
    const confirm = document.getElementById('recoveryPassConfirm');

    overlay.style.display = 'flex';
    if (loginMode) loginMode.style.display = 'none';
    if (recoveryMode) recoveryMode.style.display = '';
    if (err) err.textContent = '';

    setPasswordToggle('recoveryPassToggle', 'recoveryPass');
    setPasswordToggle('recoveryPassConfirmToggle', 'recoveryPassConfirm');

    if (!btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        err.textContent = '';
        const senha = pass.value;
        const confirmar = confirm.value;
        if (!senha || senha.length < 6) {
          err.textContent = 'A nova senha deve ter pelo menos 6 caracteres.';
          return;
        }
        if (senha !== confirmar) {
          err.textContent = 'A confirmação da senha não confere.';
          return;
        }
        btn.disabled = true;
        try {
          const { data, error } = await supabase.auth.updateUser({ password: senha });
          if (error) throw error;
          window.history.replaceState({}, '', window.location.pathname);
          overlay.style.display = 'none';
          resolve(data.user || userFromSession);
        } catch (e) {
          err.textContent = 'Não foi possível atualizar a senha.';
        } finally {
          btn.disabled = false;
        }
      });
    }

    form._resolveLogin = resolve;
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
  if (data) {
    if (data.ativo === false) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error('Usuário desativado. Procure um administrador.');
    }
    return data;
  }

  const novo = {
    id: u.user.id,
    nome: u.user.email.split('@')[0],
    sobrenome: '',
    celular: '',
    email: u.user.email,
    foto: '',
    ativo: true,
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
  if (error) throw new Error('Falha ao carregar usuários: ' + error.message);
  return data || [];
}

export async function updateProfileRoleRemote(id, perfil) {
  if (!USE_SUPABASE) return;
  const { error } = await supabase.from('profiles').update({ perfil }).eq('id', id);
  if (error) throw new Error('Falha ao atualizar perfil: ' + error.message);
}

export async function inviteUserRemote(email, perfil) {
  if (!USE_SUPABASE) throw new Error('Convite disponível apenas com Supabase ativo.');
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email, perfil }
  });
  if (error) throw new Error('Falha ao enviar convite: ' + error.message);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export async function updateUserStatusRemote(id, ativo) {
  if (!USE_SUPABASE) return;
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'set_active', userId: id, ativo }
  });
  if (error) throw new Error('Falha ao atualizar status do usuário: ' + error.message);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export async function deleteUserRemote(id) {
  if (!USE_SUPABASE) return;
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action: 'delete_user', userId: id }
  });
  if (error) throw new Error('Falha ao excluir usuário: ' + error.message);
  if (data?.error) throw new Error(data.error);
  return data || {};
}

export async function logout() {
  if (USE_SUPABASE) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Falha ao encerrar a sessão: ' + error.message);
  }
  try {
    sessionStorage.clear();
  } catch (e) { /* ignora */ }
  try {
    localStorage.removeItem('controla_user');
  } catch (e) { /* ignora */ }
  window.location.href = window.location.origin + window.location.pathname;
}

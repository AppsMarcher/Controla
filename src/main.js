/* Ponto de entrada. Ordem: login (se Supabase) -> perfil -> dados -> render. */
import { ensureAuth, currentProfile } from './auth.js';
import { loadData, renderApp, setUsuario, applyRole } from './app.js';
import { BACKEND } from './data/repo.js';

(async () => {
  try {
    await ensureAuth();                 // bloqueia até logar (modo Supabase)

    const prof = await currentProfile(); // null no modo local
    if (prof) {
      setUsuario(prof);
      applyRole(prof.perfil);
    }

    await loadData();                    // hidrata o cache a partir do backend ativo
    renderApp();

    console.info('[Controla Marcher] backend de dados:', BACKEND);
  } catch (e) {
    console.error(e);
    alert('Erro ao iniciar o aplicativo: ' + (e.message || e));
  }
})();

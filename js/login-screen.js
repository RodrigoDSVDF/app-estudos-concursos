/* ================================================================
 * login-screen.js — Tela de login (mostrada antes do app)
 * ================================================================ */

const LoginScreen = {
  /** Mostra a tela de login */
  show() {
    const overlay = $('#loginOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
    document.body.style.overflow = 'hidden';

    // Esconde o app shell atrás
    const appShell = $('#appShell');
    if (appShell) appShell.style.display = 'none';

    // Bind do botão de login (uma única vez)
    this._bindLoginButton();
  },

  /** Esconde a tela de login */
  hide() {
    const overlay = $('#loginOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => { overlay.hidden = true; }, 220);
    document.body.style.overflow = '';

    // Mostra o app shell
    const appShell = $('#appShell');
    if (appShell) appShell.style.display = '';

    // Esconde loading e erro
    const loading = $('#loginLoading');
    if (loading) loading.hidden = true;
    const error = $('#loginError');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
  },

  _bound: false,
  _bindLoginButton() {
    if (this._bound) return;
    this._bound = true;
    const btn = $('#btnGoogleLogin');
    if (btn) {
      btn.addEventListener('click', () => this.loginComGoogle());
    }
  },

  /** Inicia login com Google */
  async loginComGoogle() {
    const btn = $('#btnGoogleLogin');
    const loading = $('#loginLoading');
    const error = $('#loginError');

    if (btn) btn.disabled = true;
    if (loading) loading.hidden = false;
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }

    try {
      // Chama o Auth que vai redirecionar para o Google
      await Auth.signInWithGoogle();
      // O navegador será redirecionado, mas se demorar muito, mostra erro
      setTimeout(() => {
        if (loading && !loading.hidden) {
          if (error) {
            error.textContent = 'O redirecionamento demorou mais que o esperado. Verifique se o provedor Google está ativado no Supabase (Authentication → Providers → Google).';
            error.hidden = false;
          }
          if (btn) btn.disabled = false;
          if (loading) loading.hidden = true;
        }
      }, 5000);
    } catch (err) {
      console.error('Erro no login:', err);
      if (error) {
        error.textContent = err.message || 'Erro ao iniciar login com Google.';
        error.hidden = false;
      }
      if (btn) btn.disabled = false;
      if (loading) loading.hidden = true;
    }
  }
};

// Bind do botão de logout no sidebar (após DOM pronto)
document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = $('#btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      if (typeof App !== 'undefined' && App.logout) {
        App.logout();
      } else {
        Auth.signOut().then(() => LoginScreen.show());
      }
    });
  }
});

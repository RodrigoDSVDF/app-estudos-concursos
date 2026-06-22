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

    // Esconde o "Carregando..." inicial
    const initialLoading = document.getElementById('initialLoading');
    if (initialLoading) initialLoading.style.display = 'none';

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

    // Reseta TUDO: loading, erro, botão Google, mensagem
    this._resetLoading();
    const error = $('#loginError');
    if (error) {
      error.hidden = true;
      error.innerHTML = '';
    }
  },

  /** Reseta o estado do botão/loading para o padrão (botão Google visível) */
  _resetLoading() {
    const loading = $('#loginLoading');
    const btn = $('#btnGoogleLogin');
    if (loading) {
      loading.hidden = true;
      // Restaura conteúdo original
      loading.innerHTML = '<div class="spinner"></div><span>Conectando...</span>';
    }
    if (btn) {
      btn.disabled = false;
      btn.style.display = '';
      btn.hidden = false;
    }
  },

  /** Ativa o loading (esconde botão Google, mostra "Conectando...") */
  _ativarLoading(mensagem = 'Conectando...') {
    const btn = $('#btnGoogleLogin');
    const loading = $('#loginLoading');
    if (btn) {
      btn.style.display = 'none';
      btn.hidden = true;
    }
    if (loading) {
      loading.innerHTML = `<div class="spinner"></div><span>${Utils.escapeHTML(mensagem)}</span>`;
      loading.hidden = false;
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

  /** Mostra erro com instruções específicas baseadas na mensagem */
  mostrarErro(erroMsg) {
    const error = $('#loginError');
    const loading = $('#loginLoading');
    const btn = $('#btnGoogleLogin');

    if (loading) loading.hidden = true;
    if (btn) btn.disabled = false;

    if (!error) return;
    error.hidden = false;

    // Detecta erros conhecidos e mostra instruções específicas
    const msgLower = (erroMsg || '').toLowerCase();

    if (msgLower.includes('unsupported provider') || msgLower.includes('provider is not enabled')) {
      // ERRO MAIS COMUM: Google não ativado no Supabase
      error.innerHTML = `
        <strong>⚠️ Provedor Google não ativado</strong>
        <p style="margin: 8px 0 0; font-weight: normal;">
          Você precisa ativar o login Google no Supabase antes de usar o app.
        </p>
        <ol style="margin: 10px 0 0 20px; padding: 0; font-weight: normal; line-height: 1.6;">
          <li>Acesse o painel do Supabase</li>
          <li>Vá em <strong>Authentication → Providers</strong></li>
          <li>Clique em <strong>Google</strong></li>
          <li>Ative o toggle "Enable Sign-In with Google"</li>
          <li>Cole o <strong>Client ID</strong> e <strong>Client Secret</strong> do Google Cloud</li>
          <li>Clique em <strong>Save</strong></li>
          <li>Recarregue esta página (F5)</li>
        </ol>
        <a href="https://supabase.com/dashboard/project/zryovbcyhecxwduzdpme/auth/providers"
           target="_blank"
           style="display: inline-block; margin-top: 12px; padding: 8px 14px; background: var(--accent); color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">
          📋 Abrir Authentication → Providers
        </a>
      `;
    } else if (msgLower.includes('redirect_uri_mismatch') || msgLower.includes('redirect')) {
      error.innerHTML = `
        <strong>⚠️ URL de redirecionamento incorreta</strong>
        <p style="margin: 8px 0 0; font-weight: normal;">
          A URL de callback não está configurada no Google Cloud Console.
        </p>
        <p style="margin: 8px 0 0; font-weight: normal;">
          No Google Cloud Console (APIs & Services → Credentials), adicione esta URL em <strong>Authorized redirect URIs</strong>:
        </p>
        <code style="display: block; margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px; word-break: break-all; font-size: 11px;">
          https://zryovbcyhecxwduzdpme.supabase.co/auth/v1/callback
        </code>
      `;
    } else if (msgLower.includes('invalid_client') || msgLower.includes('client_id')) {
      error.innerHTML = `
        <strong>⚠️ Credenciais Google inválidas</strong>
        <p style="margin: 8px 0 0; font-weight: normal;">
          Verifique se o <strong>Client ID</strong> e <strong>Client Secret</strong> foram colados corretamente no Supabase (Authentication → Providers → Google).
        </p>
      `;
    } else if (msgLower.includes('fetch') || msgLower.includes('network')) {
      error.innerHTML = `
        <strong>⚠️ Erro de conexão</strong>
        <p style="margin: 8px 0 0; font-weight: normal;">
          Não foi possível conectar ao Supabase. Verifique sua internet e tente novamente.
        </p>
      `;
    } else {
      error.innerHTML = `
        <strong>⚠️ Erro ao iniciar login</strong>
        <p style="margin: 8px 0 0; font-weight: normal; word-break: break-word;">
          ${Utils.escapeHTML(erroMsg || 'Erro desconhecido')}
        </p>
        <p style="margin: 8px 0 0; font-weight: normal; font-size: 11px;">
          Abra o Console (F12) para mais detalhes.
        </p>
      `;
    }
  },

  /** Inicia login com Google */
  async loginComGoogle() {
    const error = $('#loginError');
    if (error) {
      error.hidden = true;
      error.innerHTML = '';
    }

    // Ativa loading (esconde botão Google, mostra "Conectando...")
    this._ativarLoading('Conectando...');

    try {
      // Chama o Auth que faz POST manual + redirect se sucesso.
      await Auth.signInWithGoogle();

      // Se chegou aqui, o redirect já foi iniciado OU o supabase-js está
      // trocando o code por sessão via fetch interno.

      // Timeout de segurança: se em 10 segundos ainda estamos em loading,
      // algo deu errado. Restaura o botão.
      setTimeout(() => {
        const loadingStill = $('#loginLoading');
        if (loadingStill && !loadingStill.hidden) {
          console.warn('Timeout: ainda em loading após 10s. Restaurando botão.');
          this._resetLoading();
        }
      }, 10000);
    } catch (err) {
      console.error('Erro no login:', err);
      this._resetLoading();
      this.mostrarErro(err.message || 'Erro ao iniciar login com Google.');
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

/* ================================================================
 * supabase-auth.js — Autenticação Google + gerência de sessão
 *
 * Fluxo:
 * 1. App chama Auth.init() no boot
 * 2. Se não há sessão → mostra tela de login
 * 3. Usuário clica em "Entrar com Google" → redirectTo Google OAuth
 * 4. Google retorna para a página com a sessão → Auth.init() detecta
 * 5. Auth.currentUser passa a ter uid, email, name, avatar
 * 6. App libera acesso às views
 * ================================================================ */

const Auth = {
  _currentUser: null,
  _onAuthChangeCallbacks: [],

  /** Retorna o usuário atual ou null */
  get currentUser() {
    return this._currentUser;
  },

  /** True se está logado */
  get isLogged() {
    return !!(this._currentUser && this._currentUser.id);
  },

  /** ID do usuário (atalho) */
  get userId() {
    return this._currentUser ? this._currentUser.id : null;
  },

  /** Inicializa auth — verifica sessão existente */
  async init() {
    const sb = getSupabase();

    // Escuta mudanças de auth (login, logout, refresh) — REGISTRA PRIMEIRO
    // para capturar o evento SIGNED_IN que pode disparar automaticamente
    // quando detectSessionInUrl detecta o code do OAuth na URL.
    sb.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State changed:', event, session ? '(has user)' : '(no session)');
      if (event === 'SIGNED_OUT' || !session) {
        this._currentUser = null;
      } else if (session.user) {
        this._currentUser = this._formatUser(session.user);
        // Limpa #access_token da URL assim que a sessão for estabelecida
        if (window.location.hash.includes('access_token') || window.location.search.includes('access_token')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
      this._notifyAuthChange();
    });

    // Verifica sessão existente (localStorage)
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) {
      console.warn('[Auth] Erro ao obter sessão:', error.message);
    } else if (session && session.user) {
      this._currentUser = this._formatUser(session.user);
    }

    // Se há #access_token na URL (acabou de voltar do OAuth), o supabase-js
    // deveria detectar automaticamente. Mas em domínios customizados ou
    // race conditions, pode falhar. Forçamos MÚLTIPLAS tentativas.
    const temTokenNaUrl = window.location.hash.includes('access_token') ||
                          window.location.search.includes('access_token');
    if (temTokenNaUrl) {
      console.log('[Auth] Detectado token na URL. Forçando detecção...');

      // Tentativa 1: após 300ms
      setTimeout(() => this._forcarDeteccaoSessao(), 300);
      // Tentativa 2: após 1s
      setTimeout(() => this._forcarDeteccaoSessao(), 1000);
      // Tentativa 3: após 2s
      setTimeout(() => this._forcarDeteccaoSessao(), 2000);
      // Tentativa 4: após 4s (última chance)
      setTimeout(() => this._forcarDeteccaoSessao(), 4000);
    }

    return this._currentUser;
  },

  /** Força verificação de sessão (usado quando há token na URL) */
  async _forcarDeteccaoSessao() {
    if (this._currentUser) return; // já tem sessão, nada a fazer

    try {
      const sb = getSupabase();
      const { data: { session }, error } = await sb.auth.getSession();
      if (error) {
        console.warn('[Auth] Erro na detecção forçada:', error.message);
        return;
      }
      if (session && session.user) {
        console.log('[Auth] ✓ Sessão detectada na verificação forçada!');
        this._currentUser = this._formatUser(session.user);
        // Limpa URL
        if (window.location.hash.includes('access_token') || window.location.search.includes('access_token')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        this._notifyAuthChange();
      } else {
        console.log('[Auth] Sessão ainda não estabelecida...');
      }
    } catch (err) {
      console.error('[Auth] Erro na detecção forçada:', err);
    }
  },

  /** Formata o objeto user do Supabase para o padrão do app */
  _formatUser(user) {
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0],
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      provider: user.app_metadata?.provider || 'google'
    };
  },

  /**
   * Inicia login com Google.
   * Faz uma requisição de pré-validação ao endpoint /auth/v1/settings
   * para detectar se o Google está ativado (sem iniciar redirect).
   * Depois, se OK, usa o cliente Supabase para iniciar o OAuth.
   */
  async signInWithGoogle() {
    const sb = getSupabase();
    const redirectTo = window.location.origin + window.location.pathname;

    // PRÉ-VALIDAÇÃO: chama /auth/v1/settings para ver providers ativos.
    // Este endpoint público retorna configurações de auth do projeto.
    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_ANON_KEY }
      });

      if (resp.ok) {
        const data = await resp.json();
        // O endpoint retorna { external: { google: true/false, ... } }
        const googleAtivo = data?.external?.google === true ||
                            data?.external?.google === 'true';

        if (!googleAtivo) {
          throw new Error('Unsupported provider: provider is not enabled');
        }
      }
      // Se o endpoint falhar, seguimos em frente e deixa o Supabase retornar o erro natural
    } catch (err) {
      // Se for o erro que nós mesmos lançamos, repropaga
      if (err.message && err.message.includes('Unsupported provider')) {
        throw err;
      }
      // Senão, segue em frente (não bloqueia o login por falha de diagnóstico)
      console.warn('Não foi possível validar provedores, seguindo:', err.message);
    }

    // Agora sim, inicia o OAuth com o cliente Supabase
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });

    if (error) {
      // Erro síncrono do cliente (pode conter "Unsupported provider")
      throw new Error(error.message || 'Erro ao iniciar login');
    }

    // Se chegou aqui, o redirect já foi iniciado pelo navegador.
    // Em alguns casos o Supabase JS faz POST e pega a URL de redirect da resposta;
    // em outros, faz o redirect direto. Vamos cobrir ambos:
    if (data && data.url) {
      window.location.href = data.url;
    }
  },

  /** Faz logout */
  async signOut() {
    const sb = getSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw new Error('Erro ao sair: ' + error.message);
    this._currentUser = null;
    this._notifyAuthChange();
  },

  /** Registra callback para mudanças de auth */
  onAuthChange(callback) {
    this._onAuthChangeCallbacks.push(callback);
    // Chama imediatamente com o estado atual
    callback(this._currentUser);
  },

  /** Notifica todos os callbacks registrados */
  _notifyAuthChange() {
    this._onAuthChangeCallbacks.forEach(cb => {
      try { cb(this._currentUser); }
      catch (err) { console.error('Erro em callback de auth:', err); }
    });
  }
};

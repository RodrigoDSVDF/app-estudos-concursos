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
    // Habilita persistência de sessão (localStorage)
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) {
      console.warn('Erro ao obter sessão:', error.message);
      return null;
    }
    if (session && session.user) {
      this._currentUser = this._formatUser(session.user);
    }

    // Escuta mudanças de auth (login, logout, refresh)
    sb.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_OUT' || !session) {
        this._currentUser = null;
      } else if (session.user) {
        this._currentUser = this._formatUser(session.user);
      }
      this._notifyAuthChange();
    });

    return this._currentUser;
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
   * Redireciona o navegador para o Google OAuth.
   * Após consentir, Google retorna para a URL atual com a sessão.
   */
  async signInWithGoogle() {
    const sb = getSupabase();
    // Determina a URL de redirect (mesma página atual, sem query/hash)
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account'  // sempre pedir seleção de conta
        }
      }
    });
    if (error) {
      throw new Error('Erro ao iniciar login: ' + error.message);
    }
    // O navegador será redirecionado, nada mais a fazer aqui.
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

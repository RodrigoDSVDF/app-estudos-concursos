/* ================================================================
 * supabase-auth.js — Autenticação Google + gerência de sessão
 * Refatorado para Domínio Personalizado
 * ================================================================ */

const Auth = {
  _currentUser: null,
  _onAuthChangeCallbacks: [],

  get currentUser() { return this._currentUser; },
  get isLogged() { return !!(this._currentUser && this._currentUser.id); },
  get userId() { return this._currentUser ? this._currentUser.id : null; },

  /** Inicializa auth e escuta mudanças de sessão */
  async init() {
    const sb = getSupabase();

    // 1. Escuta mudanças de auth
    sb.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] State changed:', event);
      if (event === 'SIGNED_OUT' || !session) {
        this._currentUser = null;
      } else if (session.user) {
        this._currentUser = this._formatUser(session.user);
        
        // Remove hash de tokens da URL após login bem-sucedido
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
      this._notifyAuthChange();
    });

    // 2. Verifica sessão inicial
    const { data: { session }, error } = await sb.auth.getSession();
    if (session?.user) {
      this._currentUser = this._formatUser(session.user);
    }

    return this._currentUser;
  },

  /** Formata o objeto user */
  _formatUser(user) {
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0],
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      provider: user.app_metadata?.provider || 'google'
    };
  },

  /** Inicia login com Google (simplificado e seguro) */
  async signInWithGoogle() {
    const sb = getSupabase();
    // URL exata definida no Supabase Redirect URLs
    const redirectTo = 'https://organize-o-estudo.rd-tec.dev.br/';

    console.log('[Auth] Iniciando OAuth para:', redirectTo);

    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });

    if (error) {
      console.error('[Auth] Erro ao iniciar login:', error.message);
      throw error;
    }
  },

  /** Faz logout */
  async signOut() {
    const sb = getSupabase();
    await sb.auth.signOut();
    this._currentUser = null;
    this._notifyAuthChange();
  },

  onAuthChange(callback) {
    this._onAuthChangeCallbacks.push(callback);
    callback(this._currentUser);
  },

  _notifyAuthChange() {
    this._onAuthChangeCallbacks.forEach(cb => {
      try { cb(this._currentUser); }
      catch (err) { console.error('Erro em callback de auth:', err); }
    });
  }
};

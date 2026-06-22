/* ================================================================
 * supabase-client.js — Configuração do cliente Supabase
 * ================================================================
 * Substitua estas credenciais pelas do seu projeto Supabase:
 *   - Dashboard → Project Settings → API
 *   - Copie "Project URL" e "anon public key"
 * ================================================================ */

const SUPABASE_URL = 'https://zryovbcyhecxwduzdpme.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VuRMIQ05oRXm4THTxAkZQQ_MK2qDV01';

let _supabaseClient = null;

/**
 * Retorna a instância singleton do cliente Supabase.
 * Lança erro amigável se a biblioteca não carregou.
 */
function getSupabase() {
  if (_supabaseClient) return _supabaseClient;

  if (typeof window === 'undefined' || typeof window.supabase === 'undefined') {
    throw new Error(
      'Biblioteca Supabase não carregou. Verifique sua conexão com a internet ' +
      'ou se o CDN está acessível. Se o problema persistir, baixe a biblioteca ' +
      'para assets/vendor/supabase.min.js e atualize o index.html.'
    );
  }

  _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,        // persiste sessão em localStorage
      autoRefreshToken: true,      // renova token automaticamente
      detectSessionInUrl: true,    // detecta sessão na URL (após OAuth redirect)
      storageKey: 'concursotrack-auth'
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: { 'X-Client-Info': 'concurso-track-web/1.0' }
    }
  });

  return _supabaseClient;
}

/** Testa a conexão com o Supabase (usado no diagnóstico) */
async function testarConexaoSupabase() {
  try {
    const sb = getSupabase();
    // Testa a tabela concursos (sempre deve existir após executar o schema)
    const { error } = await sb
      .from('concursos')
      .select('id')
      .limit(1);
    if (error) {
      return {
        ok: false,
        erro: error.message + '\n\nDica: execute o script supabase-schema.sql no SQL Editor.'
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: err.message };
  }
}

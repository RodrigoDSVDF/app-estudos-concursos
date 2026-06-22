/* ================================================================
 * db.js — Camada de persistência (Supabase)
 *
 * Por que Supabase em vez de IndexedDB?
 * - Dados na nuvem: acessíveis de qualquer dispositivo/navegador
 * - PostgreSQL real com FKs, índices, triggers
 * - Storage para PDFs de editais
 * - Preparado para autenticação multi-usuário no futuro
 *
 * Esta implementação mantém a MESMA interface do IndexedDB original
 * para que as views não precisem ser alteradas.
 *
 * Tabelas Supabase:
 *   concursos, materias, conteudos, sessoes, anotacoes, revisoes, editais, meta
 * ================================================================ */

/* ---------- MAPEAMENTO STORE → TABELA ---------- */
const TABLE_MAP = {
  concursos: 'concursos',
  materias: 'materias',
  conteudos: 'conteudos',
  sessoes: 'sessoes',
  anotacoes: 'anotacoes',
  revisoes: 'revisoes',
  editais: 'editais',
  meta: 'meta'
};

const DB = {
  _ready: false,

  /** Inicializa conexão com Supabase */
  async open() {
    if (this._ready) return;
    // Verifica se consegue instanciar o cliente
    const sb = getSupabase();
    this._ready = true;
    return sb;
  },

  /** Verifica se é primeira execução (sem concursos cadastrados) */
  async isFirstRun() {
    try {
      const count = await this.count('concursos');
      return count === 0;
    } catch (err) {
      console.warn('Erro ao verificar primeira execução:', err);
      return false;
    }
  },

  /** Marca primeira execução como concluída */
  async markInitialized() {
    try {
      await this.put('meta', {
        key: 'initialized',
        value: { initialized: true },
        at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Não foi possível marcar como inicializado (tabela meta pode não existir):', err.message);
    }
  },

  /** Recupera todos os registros de uma tabela */
  async getAll(store) {
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    const { data, error } = await sb.from(table).select('*');
    if (error) throw new Error(`Erro ao listar ${table}: ${error.message}`);
    return data || [];
  },

  /** Recupera por ID */
  async get(store, id) {
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    const { data, error } = await sb.from(table)
      .select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Erro ao obter ${table}: ${error.message}`);
    return data;
  },

  /** Insere ou atualiza (upsert) — injeta user_id do usuário logado */
  async put(store, obj) {
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    if (!obj.id && store !== 'meta') {
      obj.id = Utils.uuid();
    }
    // Injeta user_id automaticamente (RLS exige)
    if (Auth && Auth.userId && store !== 'meta') {
      obj.user_id = Auth.userId;
    }
    if (store === 'meta' && Auth && Auth.userId) {
      obj.user_id = Auth.userId;
    }
    const { data, error } = await sb.from(table)
      .upsert(obj, { onConflict: 'id' }).select().single();
    if (error) throw new Error(`Erro ao salvar ${table}: ${error.message}`);
    return data;
  },

  /** Insere vários em lote — injeta user_id em cada item */
  async bulkPut(store, arr) {
    if (!arr || !arr.length) return;
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    // Garante IDs e user_id
    arr.forEach(o => {
      if (!o.id && store !== 'meta') o.id = Utils.uuid();
      if (Auth && Auth.userId) o.user_id = Auth.userId;
    });
    const { data, error } = await sb.from(table)
      .upsert(arr, { onConflict: 'id' });
    if (error) throw new Error(`Erro ao salvar lote em ${table}: ${error.message}`);
    return data;
  },

  /** Remove por ID */
  async delete(store, id) {
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw new Error(`Erro ao excluir de ${table}: ${error.message}`);
  },

  /** Conta registros */
  async count(store) {
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    const { count, error } = await sb.from(table)
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(`Erro ao contar ${table}: ${error.message}`);
    return count || 0;
  },

  /** Limpa uma tabela inteira */
  async clear(store) {
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    // Supabase não tem "delete all" direto; usa filtro amplo
    // Para meta (PK = key), usa condição diferente
    if (table === 'meta') {
      const { error } = await sb.from(table).delete().neq('key', '__never_match__');
      if (error) throw new Error(`Erro ao limpar ${table}: ${error.message}`);
    } else {
      const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw new Error(`Erro ao limpar ${table}: ${error.message}`);
    }
  },

  /** Limpa TODAS as tabelas (usado em import) */
  async clearAll() {
    // Ordem importa por causa das FKs (filhas primeiro)
    const ordem = ['anotacoes', 'revisoes', 'editais', 'sessoes', 'conteudos', 'materias', 'concursos', 'meta'];
    for (const store of ordem) {
      try {
        await this.clear(store);
      } catch (err) {
        console.warn(`Erro ao limpar ${store}:`, err.message);
      }
    }
  },

  /** Busca por índice (equivale a where column = value) */
  async getByIndex(store, indexName, value) {
    const sb = getSupabase();
    const table = TABLE_MAP[store] || store;
    const { data, error } = await sb.from(table)
      .select('*').eq(indexName, value);
    if (error) throw new Error(`Erro ao buscar em ${table}: ${error.message}`);
    return data || [];
  },

  /** Exporta TODO o banco (para backup JSON) */
  async exportAll() {
    const result = {};
    for (const s of Object.keys(TABLE_MAP)) {
      result[s] = await this.getAll(s);
    }
    return result;
  },

  /** Importa objeto de backup (substitui dados atuais) */
  async importAll(data) {
    await this.clearAll();
    // Ordem importa por causa das FKs (pais primeiro)
    const ordem = ['concursos', 'materias', 'conteudos', 'sessoes', 'anotacoes', 'revisoes', 'editais', 'meta'];
    for (const s of ordem) {
      const arr = data[s] || [];
      if (arr.length) {
        try {
          await this.bulkPut(s, arr);
        } catch (err) {
          console.warn(`Erro ao importar ${s}:`, err.message);
        }
      }
    }
  }
};

/* ================================================================
 * STORES DE SERVIÇO (camada de negócio)
 * Encapsula operações de alto nível sobre o DB.
 * Mantém a MESMA interface do IndexedDB original.
 * ================================================================ */
const Service = {
  /* ====== CONCURSOS ====== */
  async listarConcursos() {
    const arr = await DB.getAll('concursos');
    return arr.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
  },
  async obterConcurso(id) { return DB.get('concursos', id); },
  async salvarConcurso(concurso) {
    if (!concurso.id) concurso.id = Utils.uuid();
    if (!concurso.criado_em) concurso.criado_em = new Date().toISOString();
    concurso.atualizado_em = new Date().toISOString();
    return DB.put('concursos', concurso);
  },
  async excluirConcurso(id) {
    // Cascade é tratado pelas FKs do Postgres (on delete cascade)
    // Editais: cascade na tabela; PDFs no Storage precisam ser removidos manualmente
    const editais = await DB.getByIndex('editais', 'concurso_id', id);
    for (const e of editais) {
      await this.excluirEdital(e.id);
    }
    await DB.delete('concursos', id);
  },

  /* ====== MATÉRIAS ====== */
  async listarMaterias(concursoId = null) {
    if (concursoId) return DB.getByIndex('materias', 'concurso_id', concursoId);
    return DB.getAll('materias');
  },
  async obterMateria(id) { return DB.get('materias', id); },
  async salvarMateria(materia) {
    if (!materia.id) materia.id = Utils.uuid();
    if (!materia.criado_em) materia.criado_em = new Date().toISOString();
    materia.atualizado_em = new Date().toISOString();
    return DB.put('materias', materia);
  },
  async excluirMateria(id) {
    // Cascade tratado pelas FKs
    await DB.delete('materias', id);
  },

  async calcularProgressoMateria(materiaId) {
    const conteudos = await DB.getByIndex('conteudos', 'materia_id', materiaId);
    if (!conteudos.length) return 0;
    const concluidos = conteudos.filter(c => c.status === 'concluido').length;
    return Math.round((concluidos / conteudos.length) * 100);
  },

  /* ====== CONTEÚDOS ====== */
  async listarConteudos(materiaId = null) {
    if (materiaId) return DB.getByIndex('conteudos', 'materia_id', materiaId);
    return DB.getAll('conteudos');
  },
  async obterConteudo(id) { return DB.get('conteudos', id); },
  async salvarConteudo(conteudo) {
    if (!conteudo.id) conteudo.id = Utils.uuid();
    if (!conteudo.criado_em) conteudo.criado_em = new Date().toISOString();
    conteudo.atualizado_em = new Date().toISOString();
    const eraConcluido = await this._isConteudoConcluido(conteudo.id);
    const salvo = await DB.put('conteudos', conteudo);
    if (!eraConcluido && conteudo.status === 'concluido') {
      await this.gerarRevisoesParaConteudo(conteudo.id);
    }
    return salvo;
  },
  async _isConteudoConcluido(id) {
    if (!id) return false;
    const c = await DB.get('conteudos', id);
    return c && c.status === 'concluido';
  },
  async excluirConteudo(id) {
    await DB.delete('conteudos', id);
  },

  /* ====== SESSÕES ====== */
  async listarSessoes(filtros = {}) {
    let sessoes = await DB.getAll('sessoes');
    if (filtros.concurso_id) sessoes = sessoes.filter(s => s.concurso_id === filtros.concurso_id);
    if (filtros.materia_id) sessoes = sessoes.filter(s => s.materia_id === filtros.materia_id);
    if (filtros.conteudo_id) sessoes = sessoes.filter(s => s.conteudo_id === filtros.conteudo_id);
    if (filtros.tipo_estudo) sessoes = sessoes.filter(s => s.tipo_estudo === filtros.tipo_estudo);
    if (filtros.nivel_concentracao_min) sessoes = sessoes.filter(s => s.nivel_concentracao >= filtros.nivel_concentracao_min);
    if (filtros.data_inicio) sessoes = sessoes.filter(s => s.data_inicio && s.data_inicio.split('T')[0] >= filtros.data_inicio);
    if (filtros.data_fim) sessoes = sessoes.filter(s => s.data_inicio && s.data_inicio.split('T')[0] <= filtros.data_fim);
    sessoes.sort((a, b) => (b.data_inicio || '').localeCompare(a.data_inicio || ''));
    return sessoes;
  },
  async obterSessao(id) { return DB.get('sessoes', id); },
  async salvarSessao(sessao) {
    if (!sessao.id) sessao.id = Utils.uuid();
    if (!sessao.criado_em) sessao.criado_em = new Date().toISOString();
    sessao.atualizado_em = new Date().toISOString();
    if (sessao.data_inicio && sessao.data_fim) {
      sessao.tempo_minutos = Utils.diffMinutes(sessao.data_inicio, sessao.data_fim);
    }
    return DB.put('sessoes', sessao);
  },
  async excluirSessao(id) {
    // Anotações vinculadas são removidas pelo cascade (on delete cascade)
    await DB.delete('sessoes', id);
  },

  /* ====== ANOTAÇÕES ====== */
  async listarAnotacoes() { return DB.getAll('anotacoes'); },
  async obterAnotacaoPorSessao(sessaoId) {
    const arr = await DB.getByIndex('anotacoes', 'sessao_id', sessaoId);
    return arr[0] || null;
  },
  async salvarAnotacao(anotacao) {
    if (!anotacao.id) anotacao.id = Utils.uuid();
    if (!anotacao.criado_em) anotacao.criado_em = new Date().toISOString();
    anotacao.atualizado_em = new Date().toISOString();
    return DB.put('anotacoes', anotacao);
  },
  async excluirAnotacao(id) {
    await DB.delete('anotacoes', id);
  },

  /* ====== REVISÕES ====== */
  async listarRevisoes(filtros = {}) {
    let revisoes = await DB.getAll('revisoes');
    if (filtros.conteudo_id) revisoes = revisoes.filter(r => r.conteudo_id === filtros.conteudo_id);
    if (filtros.status) revisoes = revisoes.filter(r => r.status === filtros.status);
    if (filtros.apenas_atrasadas) {
      const hoje = new Date().toISOString();
      revisoes = revisoes.filter(r => r.status === 'pendente' && r.data_programada < hoje);
    }
    revisoes.sort((a, b) => (a.data_programada || '').localeCompare(b.data_programada || ''));
    return revisoes;
  },
  async salvarRevisao(revisao) {
    if (!revisao.id) revisao.id = Utils.uuid();
    if (!revisao.criado_em) revisao.criado_em = new Date().toISOString();
    revisao.atualizado_em = new Date().toISOString();
    return DB.put('revisoes', revisao);
  },
  async excluirRevisao(id) {
    await DB.delete('revisoes', id);
  },

  /**
   * Gera revisões espaçadas automáticas (1, 7, 15 e 30 dias)
   * quando um conteúdo é marcado como concluído.
   */
  async gerarRevisoesParaConteudo(conteudoId, sessaoOrigemId = null) {
    const conteudo = await DB.get('conteudos', conteudoId);
    if (!conteudo) return [];
    const dataBase = new Date().toISOString();
    const intervalos = [
      { dias: 1, descricao: 'Revisão de fixação (D+1)' },
      { dias: 7, descricao: 'Revisão semanal (D+7)' },
      { dias: 15, descricao: 'Revisão quinzenal (D+15)' },
      { dias: 30, descricao: 'Revisão mensal (D+30)' }
    ];
    const criadas = [];
    for (const intervalo of intervalos) {
      const revisao = {
        id: Utils.uuid(),
        conteudo_id: conteudoId,
        materia_id: conteudo.materia_id,
        sessao_origem_id: sessaoOrigemId,
        descricao: intervalo.descricao,
        data_programada: Utils.addDays(dataBase, intervalo.dias),
        data_criacao: dataBase,
        status: 'pendente',
        concluida_em: null
      };
      try {
        const salva = await DB.put('revisoes', revisao);
        criadas.push(salva);
      } catch (err) {
        console.warn('Erro ao criar revisão:', err.message);
      }
    }
    return criadas;
  },

  /* ====== EDITAIS (com Supabase Storage) ====== */
  async salvarEdital(concursoId, file) {
    const sb = getSupabase();
    const userId = Auth.userId;
    if (!userId) throw new Error('Usuário não autenticado');

    // Caminho no storage: <user_id>/<concurso_id>/<timestamp>-<nome>
    // A pasta user_id permite que as policies RLS isolem os arquivos.
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `${userId}/${concursoId}/${Date.now()}-${safeName}`;

    // 1. Upload do arquivo para o bucket "editais"
    const { error: uploadError } = await sb.storage
      .from('editais')
      .upload(filePath, file, {
        contentType: file.type || 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });
    if (uploadError) throw new Error(`Erro no upload do edital: ${uploadError.message}`);

    // 2. Gera URL pública (bucket é público, então qualquer um com a URL pode ver)
    const { data: urlData } = sb.storage.from('editais').getPublicUrl(filePath);

    // 3. Salva metadata na tabela editais (user_id é injetado por DB.put)
    const edital = {
      id: Utils.uuid(),
      concurso_id: concursoId,
      nome_arquivo: file.name,
      tamanho: file.size,
      tipo: file.type,
      caminho_storage: filePath,
      url_publica: urlData.publicUrl,
      data_upload: new Date().toISOString()
    };
    return DB.put('editais', edital);
  },

  async listarEditais(concursoId) {
    return DB.getByIndex('editais', 'concurso_id', concursoId);
  },

  async excluirEdital(id) {
    const edital = await DB.get('editais', id);
    if (!edital) return;
    // Remove o arquivo do Storage
    if (edital.caminho_storage) {
      const sb = getSupabase();
      const { error } = await sb.storage.from('editais').remove([edital.caminho_storage]);
      if (error) console.warn('Aviso: não foi possível remover arquivo do storage:', error.message);
    }
    await DB.delete('editais', id);
  },

  /** Gera URL assinada (caso bucket não seja público) */
  async gerarUrlAssinada(editalId, expirySeconds = 3600) {
    const edital = await DB.get('editais', editalId);
    if (!edital || !edital.caminho_storage) return null;
    const sb = getSupabase();
    const { data, error } = await sb.storage.from('editais')
      .createSignedUrl(edital.caminho_storage, expirySeconds);
    if (error) throw new Error(`Erro ao gerar URL: ${error.message}`);
    return data.signedUrl;
  }
};

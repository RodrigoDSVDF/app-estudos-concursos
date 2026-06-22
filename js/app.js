/* ================================================================
 * app.js — Controlador principal do app
 * Responsável por: inicialização, roteamento de views, tema,
 * filtro global e badge de revisões.
 * ================================================================ */

const App = {
  _currentView: null,
  filtroConcurso: null,
  filtroMateria: null,
  sessaoParaAnotacao: null,
  _views: {
    dashboard: DashboardView,
    concursos: ConcursosView,
    materias: MateriasView,
    conteudos: ConteudosView,
    cronometro: CronometroView,
    sessoes: SessoesView,
    anotacoes: AnotacoesView,
    revisoes: RevisoesView,
    insights: InsightsView,
    backup: BackupView
  },

  /** Inicialização */
  async init() {
    // Bind de eventos globais
    this.bindSidebar();
    this.bindTheme();
    this.bindModal();
    this.bindConfirm();

    // Carrega tema salvo
    const savedTheme = localStorage.getItem('ct_theme') || 'light';
    this.setTheme(savedTheme);

    // Inicializa conexão com Supabase
    try {
      await DB.open();
    } catch (err) {
      console.error('Erro ao conectar ao Supabase:', err);
      this.mostrarErroFatal(
        'Não foi possível conectar ao Supabase',
        err.message + '\n\nVerifique:\n' +
        '1. Sua conexão com a internet\n' +
        '2. Se as credenciais em js/supabase-client.js estão corretas\n' +
        '3. Se o script supabase-schema.sql foi executado no Supabase'
      );
      return;
    }

    // Inicializa auth e verifica sessão
    try {
      await Auth.init();
    } catch (err) {
      console.error('Erro ao inicializar auth:', err);
    }

    // Se não está logado, mostra tela de login
    if (!Auth.isLogged) {
      LoginScreen.show();
      return;
    }

    // Auth mudou para logged-out (e.g., logout manual)
    Auth.onAuthChange(user => {
      if (!user) {
        LoginScreen.show();
      } else {
        LoginScreen.hide();
        this.iniciarApp();
      }
    });

    // Inicia o app (dados, views, etc.)
    await this.iniciarApp();
  },

  /** Inicializa o app após login confirmado */
  async iniciarApp() {
    // Atualiza UI com dados do usuário
    this.atualizarPerfilUsuario();

    // Testa a conexão (verifica se tabela existe)
    const teste = await testarConexaoSupabase();
    if (!teste.ok) {
      console.error('Teste de conexão falhou:', teste.erro);
      this.mostrarErroFatal(
        'Conexão com Supabase falhou',
        'O app não conseguiu acessar as tabelas. Erro: ' + teste.erro + '\n\n' +
        'Execute o script supabase-schema.sql no SQL Editor do Supabase:\n' +
        'https://supabase.com/dashboard/project/zryovbcyhecxwduzdpme/sql/new'
      );
      return;
    }

    // Aplica seed se primeira execução
    let novoSeed = false;
    try {
      novoSeed = await Seed.aplicarSeNecessario();
      if (novoSeed) {
        setTimeout(() => Toast.info('Bem-vindo! Adicionamos dados de exemplo para você explorar.', 'Primeira execução'), 800);
      }
    } catch (err) {
      console.warn('Erro ao aplicar seed (continuando):', err);
    }

    // Filtro global de concurso
    await this.atualizarFiltroGlobal();
    $('#globalFilterConcurso').addEventListener('change', e => {
      this.filtroConcurso = e.target.value || null;
      if (this._views[this._currentView]?.refresh) {
        this._views[this._currentView].refresh();
      } else {
        this.navigate(this._currentView);
      }
    });

    // Badge de revisões atrasadas
    await this.atualizarBadgeRevisoes();
    setInterval(() => this.atualizarBadgeRevisoes(), 60000); // a cada minuto

    // Navega para a view padrão
    this.navigate('dashboard');

    // Suporte a histórico (back/forward)
    window.addEventListener('popstate', e => {
      const view = e.state?.view || 'dashboard';
      this.navigate(view, true);
    });
  },

  /** Sidebar e navegação */
  bindSidebar() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const view = item.dataset.view;
        this.navigate(view);
        // Em mobile, fecha a sidebar
        if (window.innerWidth <= 768) {
          $('#sidebar').classList.remove('open');
          $('#sidebarOverlay').classList.remove('active');
        }
      });
    });

    $('#menuBtn').addEventListener('click', () => {
      $('#sidebar').classList.add('open');
      $('#sidebarOverlay').classList.add('active');
    });
    $('#sidebarToggle').addEventListener('click', () => {
      $('#sidebar').classList.remove('open');
      $('#sidebarOverlay').classList.remove('active');
    });
    $('#sidebarOverlay').addEventListener('click', () => {
      $('#sidebar').classList.remove('open');
      $('#sidebarOverlay').classList.remove('active');
    });
  },

  /** Navega para uma view */
  navigate(view, fromPopState = false) {
    if (!this._views[view]) {
      console.warn(`View "${view}" não encontrada.`);
      view = 'dashboard';
    }
    this._currentView = view;

    // Atualiza nav ativa
    $$('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));

    // Atualiza título
    const titles = {
      dashboard: 'Dashboard',
      concursos: 'Concursos',
      materias: 'Matérias',
      conteudos: 'Conteúdos',
      cronometro: 'Cronômetro',
      sessoes: 'Sessões de Estudo',
      anotacoes: 'Anotações',
      revisoes: 'Revisões',
      insights: 'Insights',
      backup: 'Backup & Exportação'
    };
    $('#topbarTitle').textContent = titles[view] || view;

    // Limpa container
    const container = $('#viewContainer');
    container.innerHTML = '<div class="loading">Carregando...</div>';

    // Renderiza nova view
    Promise.resolve(this._views[view].render(container)).catch(err => {
      console.error(`Erro ao renderizar view "${view}":`, err);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Erro ao carregar a página</h3>
          <p>${Utils.escapeHTML(err.message || 'Erro desconhecido')}</p>
          <button class="btn btn-primary" onclick="App.navigate('dashboard')">Voltar ao Dashboard</button>
        </div>
      `;
    });

    // Atualiza URL sem recarregar
    if (!fromPopState) {
      history.pushState({ view }, '', `#${view}`);
    }

    // Scroll para topo
    container.scrollTop = 0;
  },

  /** Tema claro/escuro */
  bindTheme() {
    $('#themeToggle').addEventListener('click', () => {
      const atual = document.documentElement.getAttribute('data-theme') || 'light';
      const novo = atual === 'light' ? 'dark' : 'light';
      this.setTheme(novo);
      // Recria gráficos para aplicar novas cores
      if (this._currentView === 'dashboard') {
        setTimeout(() => DashboardView.refresh(), 100);
      }
    });
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ct_theme', theme);
    const isDark = theme === 'dark';
    $('.theme-icon').textContent = isDark ? '☀️' : '🌙';
    $('.theme-label').textContent = isDark ? 'Tema claro' : 'Tema escuro';
  },

  /** Modal global */
  bindModal() {
    $('#modalClose').addEventListener('click', () => Modal.close());
    $('#modalOverlay').addEventListener('click', e => {
      if (e.target.id === 'modalOverlay') Modal.close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('#modalOverlay').hidden) Modal.close();
        if (!$('#confirmOverlay').hidden) Confirm._respond(false);
      }
    });
  },

  /** Confirm global */
  bindConfirm() {
    $('#confirmOk').addEventListener('click', () => Confirm._respond(true));
    $('#confirmCancel').addEventListener('click', () => Confirm._respond(false));
  },

  /** Atualiza UI com dados do usuário logado */
  atualizarPerfilUsuario() {
    const user = Auth.currentUser;
    if (!user) return;
    const avatar = $('#userAvatar');
    const name = $('#userName');
    const email = $('#userEmail');
    if (avatar) {
      if (user.avatar) {
        avatar.innerHTML = `<img src="${Utils.escapeHTML(user.avatar)}" alt="${Utils.escapeHTML(user.name)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" />`;
      } else {
        const inicial = (user.name || user.email || '?').charAt(0).toUpperCase();
        avatar.innerHTML = `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700;">${inicial}</div>`;
      }
    }
    if (name) name.textContent = user.name || '—';
    if (email) email.textContent = user.email || '';
  },

  /** Faz logout */
  async logout() {
    const ok = await Confirm.ask('Tem certeza que deseja sair?', 'Sair da conta');
    if (!ok) return;
    try {
      await Auth.signOut();
      Toast.info('Você saiu da conta.');
      LoginScreen.show();
    } catch (err) {
      Toast.error('Erro ao sair: ' + err.message);
    }
  },

  /** Mostra erro fatal (conexão, schema, etc.) e bloqueia o app */
  mostrarErroFatal(titulo, mensagem) {
    const container = $('#viewContainer');
    if (container) {
      container.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 40px auto; border-color: var(--danger); background: var(--danger-soft);">
          <h2 style="color: var(--danger); margin-bottom: 16px;">⚠️ ${Utils.escapeHTML(titulo)}</h2>
          <pre style="white-space: pre-wrap; font-family: var(--font-mono); font-size: 13px; color: var(--text-primary); margin: 0;">${Utils.escapeHTML(mensagem)}</pre>
          <div style="margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="location.reload()">🔄 Recarregar</button>
            <a class="btn btn-secondary" href="https://supabase.com/dashboard/project/zryovbcyhecxwduzdpme/sql/new" target="_blank">📋 Abrir SQL Editor</a>
          </div>
        </div>
      `;
    }
    const loading = $('#initialLoading');
    if (loading) loading.style.display = 'none';
  },

  /** Atualiza filtro global de concurso no topbar */
  async atualizarFiltroGlobal() {
    const sel = $('#globalFilterConcurso');
    if (!sel) return;
    const concursos = await Service.listarConcursos();
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todos os concursos</option>' +
      concursos.map(c => `<option value="${c.id}">${Utils.escapeHTML(c.nome)}</option>`).join('');
    sel.value = atual;
  },

  /** Atualiza badge de revisões atrasadas */
  async atualizarBadgeRevisoes() {
    const revisoes = await Service.listarRevisoes({ apenas_atrasadas: true });
    const badge = $('#revisoesBadge');
    if (revisoes.length > 0) {
      badge.textContent = revisoes.length;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
};

// Inicializa quando o DOM estiver pronto
// (compatible com scripts defer que podem executar após DOMContentLoaded)
(function initWhenReady() {
  const safeInit = () => {
    try {
      App.init();
    } catch (err) {
      console.error('Erro fatal na inicialização:', err);
      if (typeof showDiagnostic === 'function') {
        showDiagnostic('Erro fatal na inicialização: ' + err.message);
      }
      // Fallback: mostra erro no container
      const container = document.getElementById('viewContainer');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Erro ao carregar o app</h3>
            <p>${Utils.escapeHTML(err.message || 'Erro desconhecido')}</p>
            <p class="text-muted" style="font-size: 12px; margin-top: 12px;">Verifique o Console (F12) para detalhes.</p>
          </div>
        `;
      }
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
  } else {
    safeInit();
  }
})();

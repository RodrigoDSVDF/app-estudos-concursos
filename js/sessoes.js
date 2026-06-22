/* ================================================================
 * sessoes.js — Sessões de Estudo (CRUD + cronômetro integrado)
 * ================================================================ */

const SessoesView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Sessões de Estudo</h2>
          <p>Registre cada sessão de estudo para acompanhar sua evolução.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="btnIrCronometro">⏱️ Cronômetro</button>
          <button class="btn btn-primary" id="btnNovaSessao">+ Nova sessão</button>
        </div>
      </div>

      <div class="filter-bar">
        <select class="form-control" id="filtroConcurso">
          <option value="">Todos os concursos</option>
        </select>
        <select class="form-control" id="filtroMateria">
          <option value="">Todas as matérias</option>
        </select>
        <select class="form-control" id="filtroTipo">
          <option value="">Todos os tipos</option>
          <option value="teoria">Teoria</option>
          <option value="exercicios">Exercícios</option>
          <option value="revisao">Revisão</option>
          <option value="simulado">Simulado</option>
        </select>
        <input type="date" class="form-control" id="filtroDataInicio" title="De" />
        <input type="date" class="form-control" id="filtroDataFim" title="Até" />
        <select class="form-control" id="filtroConcentracao" title="Concentração mínima">
          <option value="">Concentração mín.</option>
          <option value="1">≥ 1</option>
          <option value="2">≥ 2</option>
          <option value="3">≥ 3</option>
          <option value="4">≥ 4</option>
          <option value="5">≥ 5</option>
        </select>
      </div>

      <div id="sessoesList" class="list-stack">
        <div class="loading">Carregando...</div>
      </div>
    `;

    const concursos = await Service.listarConcursos();
    concursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nome;
      $('#filtroConcurso').appendChild(opt);
    });

    if (App.filtroConcurso) {
      $('#filtroConcurso').value = App.filtroConcurso;
      await this.atualizarMateriasFiltro(App.filtroConcurso);
    } else {
      await this.atualizarMateriasFiltro();
    }

    $('#filtroConcurso').addEventListener('change', async e => {
      await this.atualizarMateriasFiltro(e.target.value);
      await this.atualizarLista();
    });
    $('#filtroMateria').addEventListener('change', () => this.atualizarLista());
    $('#filtroTipo').addEventListener('change', () => this.atualizarLista());
    $('#filtroDataInicio').addEventListener('change', () => this.atualizarLista());
    $('#filtroDataFim').addEventListener('change', () => this.atualizarLista());
    $('#filtroConcentracao').addEventListener('change', () => this.atualizarLista());
    $('#btnNovaSessao').addEventListener('click', () => this.abrirFormulario());
    $('#btnIrCronometro').addEventListener('click', () => App.navigate('cronometro'));

    await this.atualizarLista();
  },

  async atualizarMateriasFiltro(concursoId = '') {
    const materias = concursoId
      ? await Service.listarMaterias(concursoId)
      : await Service.listarMaterias();
    const sel = $('#filtroMateria');
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todas as matérias</option>';
    materias.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id; opt.textContent = m.nome;
      sel.appendChild(opt);
    });
    if (atual) sel.value = atual;
  },

  async atualizarLista() {
    const filtros = {
      concurso_id: $('#filtroConcurso').value || null,
      materia_id: $('#filtroMateria').value || null,
      tipo_estudo: $('#filtroTipo').value || null,
      data_inicio: $('#filtroDataInicio').value || null,
      data_fim: $('#filtroDataFim').value || null,
      nivel_concentracao_min: Number($('#filtroConcentracao').value) || null
    };
    const sessoes = await Service.listarSessoes(filtros);

    // Cache de nomes
    const concursos = await Service.listarConcursos();
    const materias = await Service.listarMaterias();
    const conteudos = await Service.listarConteudos();
    const cById = {}; concursos.forEach(c => cById[c.id] = c);
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const coById = {}; conteudos.forEach(c => coById[c.id] = c);

    const listEl = $('#sessoesList');
    if (!sessoes.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>Nenhuma sessão encontrada</h3>
          <p>Registre sua primeira sessão de estudo ou use o cronômetro.</p>
          <div class="flex gap-8 justify-center">
            <button class="btn btn-secondary" onclick="App.navigate('cronometro')">⏱️ Usar cronômetro</button>
            <button class="btn btn-primary" onclick="SessoesView.abrirFormulario()">+ Nova sessão</button>
          </div>
        </div>
      `;
      return;
    }

    const tipoLabels = {
      teoria: 'Teoria', exercicios: 'Exercícios', revisao: 'Revisão', simulado: 'Simulado'
    };

    listEl.innerHTML = '';
    for (const s of sessoes) {
      const concurso = cById[s.concurso_id];
      const materia = mById[s.materia_id];
      const conteudo = coById[s.conteudo_id];
      const dataHora = Utils.formatDateTime(s.data_inicio);
      const duracao = Utils.formatDuration(s.tempo_minutos);
      const concentracao = '●'.repeat(s.nivel_concentracao || 0) + '○'.repeat(5 - (s.nivel_concentracao || 0));

      const item = el(`
        <div class="list-item" data-id="${s.id}">
          <div class="list-item-content">
            <div class="list-item-title">
              ${dataHora}
              <span class="badge-pill draft">${tipoLabels[s.tipo_estudo] || s.tipo_estudo}</span>
              <span class="badge-pill ${s.tipo_estudo === 'simulado' ? 'progress' : 'pending'}">${duracao}</span>
            </div>
            <div class="list-item-subtitle">
              ${concurso ? Utils.escapeHTML(concurso.nome) : '—'} • ${materia ? Utils.escapeHTML(materia.nome) : '—'} • ${conteudo ? Utils.escapeHTML(conteudo.nome) : '—'}
            </div>
            <div class="list-item-subtitle mt-8">
              <span title="Concentração">🎯 ${concentracao}</span>
              <span title="Compreensão">📖 ${s.nivel_compreensao || '-'}/5</span>
              <span title="Energia">⚡ ${s.nivel_energia || '-'}/5</span>
              <span title="Técnica">🛠️ ${Utils.escapeHTML((s.tecnica || '').replace(/_/g, ' '))}</span>
            </div>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-ghost btn-sm" data-action="anotar" title="Anotações">🗒️</button>
            <button class="btn btn-ghost btn-sm" data-action="editar" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="excluir" title="Excluir">🗑️</button>
          </div>
        </div>
      `);
      item.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'editar') this.abrirFormulario(s.id);
        else if (action === 'excluir') this.excluir(s);
        else if (action === 'anotar') {
          App.sessaoParaAnotacao = s.id;
          App.navigate('anotacoes');
        }
      });
      listEl.appendChild(item);
    }
  },

  async abrirFormulario(id = null) {
    const sessao = id ? await Service.obterSessao(id) : {};
    const concursos = await Service.listarConcursos();
    if (!concursos.length) {
      Toast.warning('Cadastre um concurso primeiro.');
      return;
    }

    const concursoSel = sessao.concurso_id || App.filtroConcurso || concursos[0].id;
    const materias = await Service.listarMaterias(concursoSel);
    const conteudos = materias.length ? await Service.listarConteudos(materias[0].id) : [];

    const body = el(`
      <form id="formSessao">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Data <span class="req">*</span></label>
            <input type="date" class="form-control" name="data" required value="${(sessao.data_inicio || new Date().toISOString()).split('T')[0]}" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Hora início</label>
              <input type="time" class="form-control" name="hora_inicio" value="${sessao.data_inicio ? new Date(sessao.data_inicio).toTimeString().slice(0, 5) : ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Hora fim</label>
              <input type="time" class="form-control" name="hora_fim" value="${sessao.data_fim ? new Date(sessao.data_fim).toTimeString().slice(0, 5) : ''}" />
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Concurso <span class="req">*</span></label>
          <select class="form-control" name="concurso_id" required id="selConcurso">
            ${concursos.map(c => `<option value="${c.id}" ${sessao.concurso_id === c.id ? 'selected' : ''}>${Utils.escapeHTML(c.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Matéria <span class="req">*</span></label>
            <select class="form-control" name="materia_id" required id="selMateria">
              ${materias.map(m => `<option value="${m.id}" ${sessao.materia_id === m.id ? 'selected' : ''}>${Utils.escapeHTML(m.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Conteúdo</label>
            <select class="form-control" name="conteudo_id" id="selConteudo">
              <option value="">—</option>
              ${conteudos.map(c => `<option value="${c.id}" ${sessao.conteudo_id === c.id ? 'selected' : ''}>${Utils.escapeHTML(c.nome)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tipo de estudo</label>
            <select class="form-control" name="tipo_estudo">
              <option value="teoria" ${sessao.tipo_estudo === 'teoria' ? 'selected' : ''}>Teoria</option>
              <option value="exercicios" ${sessao.tipo_estudo === 'exercicios' ? 'selected' : ''}>Exercícios</option>
              <option value="revisao" ${sessao.tipo_estudo === 'revisao' ? 'selected' : ''}>Revisão</option>
              <option value="simulado" ${sessao.tipo_estudo === 'simulado' ? 'selected' : ''}>Simulado</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Técnica utilizada</label>
            <select class="form-control" name="tecnica">
              <option value="pomodoro" ${sessao.tecnica === 'pomodoro' ? 'selected' : ''}>Pomodoro</option>
              <option value="leitura_ativa" ${sessao.tecnica === 'leitura_ativa' ? 'selected' : ''}>Leitura ativa</option>
              <option value="flashcards" ${sessao.tecnica === 'flashcards' ? 'selected' : ''}>Flashcards</option>
              <option value="resolucao_questoes" ${sessao.tecnica === 'resolucao_questoes' ? 'selected' : ''}>Resolução de questões</option>
              <option value="livre" ${sessao.tecnica === 'livre' ? 'selected' : ''}>Livre</option>
            </select>
          </div>
        </div>

        <h3 class="mb-8 mt-16" style="font-size: 14px; color: var(--text-secondary);">Avaliação (1 a 5)</h3>
        ${this.ratingField('Concentração', 'nivel_concentracao', sessao.nivel_concentracao || 3)}
        ${this.ratingField('Energia', 'nivel_energia', sessao.nivel_energia || 3)}
        ${this.ratingField('Compreensão', 'nivel_compreensao', sessao.nivel_compreensao || 3)}
        ${this.ratingField('Humor antes', 'humor_antes', sessao.humor_antes || 3)}
        ${this.ratingField('Humor após', 'humor_depois', sessao.humor_depois || 3)}
      </form>
    `);

    const footer = el(`
      <div>
        <button class="btn btn-ghost" id="btnCancelar">Cancelar</button>
        <button class="btn btn-primary" id="btnSalvar">Salvar</button>
      </div>
    `);

    Modal.open({ title: id ? 'Editar sessão' : 'Nova sessão', body, footer, size: 'lg' });

    // Listener para recarregar matérias ao mudar concurso
    $('#selConcurso').addEventListener('change', async e => {
      const mats = await Service.listarMaterias(e.target.value);
      $('#selMateria').innerHTML = mats.map(m => `<option value="${m.id}">${Utils.escapeHTML(m.nome)}</option>`).join('');
      await this.atualizarConteudosSelect(mats[0]?.id);
    });
    $('#selMateria').addEventListener('change', async e => {
      await this.atualizarConteudosSelect(e.target.value);
    });

    // Listener para ratings
    body.querySelectorAll('.rating').forEach(r => {
      r.querySelectorAll('.rating-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          r.querySelectorAll('.rating-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          r.dataset.value = dot.dataset.value;
        });
      });
    });

    $('#btnCancelar').addEventListener('click', () => Modal.close());
    $('#btnSalvar').addEventListener('click', () => this.salvarFormulario(id));
  },

  ratingField(label, name, valor) {
    const dots = [1, 2, 3, 4, 5].map(n =>
      `<button type="button" class="rating-dot ${n === valor ? 'active' : ''}" data-value="${n}">${n}</button>`
    ).join('');
    return `
      <div class="form-group">
        <label class="form-label">${label}</label>
        <div class="rating" name="${name}" data-value="${valor}">${dots}</div>
      </div>
    `;
  },

  async atualizarConteudosSelect(materiaId) {
    if (!materiaId) return;
    const cs = await Service.listarConteudos(materiaId);
    $('#selConteudo').innerHTML = '<option value="">—</option>' +
      cs.map(c => `<option value="${c.id}">${Utils.escapeHTML(c.nome)}</option>`).join('');
  },

  async salvarFormulario(id) {
    const form = $('#formSessao');
    const fd = new FormData(form);
    const data = fd.get('data');
    const horaInicio = fd.get('hora_inicio');
    const horaFim = fd.get('hora_fim');

    if (!data) {
      Toast.error('Informe a data.');
      return;
    }

    const dataInicio = horaInicio ? new Date(`${data}T${horaInicio}:00`).toISOString() : null;
    const dataFim = horaFim ? new Date(`${data}T${horaFim}:00`).toISOString() : null;

    // Coleta ratings
    const ratings = {};
    form.querySelectorAll('.rating').forEach(r => {
      ratings[r.getAttribute('name')] = Number(r.dataset.value) || 3;
    });

    const obj = {
      concurso_id: fd.get('concurso_id'),
      materia_id: fd.get('materia_id'),
      conteudo_id: fd.get('conteudo_id') || null,
      data_inicio: dataInicio,
      data_fim: dataFim,
      tipo_estudo: fd.get('tipo_estudo'),
      tecnica: fd.get('tecnica'),
      nivel_concentracao: ratings.nivel_concentracao,
      nivel_energia: ratings.nivel_energia,
      nivel_compreensao: ratings.nivel_compreensao,
      humor_antes: ratings.humor_antes,
      humor_depois: ratings.humor_depois
    };

    if (!obj.concurso_id || !obj.materia_id) {
      Toast.error('Preencha concurso e matéria.');
      return;
    }

    if (id) {
      const existente = await Service.obterSessao(id);
      Object.assign(existente, obj);
      await Service.salvarSessao(existente);
      Toast.success('Sessão atualizada.');
    } else {
      await Service.salvarSessao(obj);
      Toast.success('Sessão registrada.');
    }

    Modal.close();
    await this.atualizarLista();
  },

  async excluir(sessao) {
    const ok = await Confirm.ask(
      `Excluir esta sessão de estudo? Anotações vinculadas também serão removidas.`,
      'Excluir sessão'
    );
    if (!ok) return;
    await Service.excluirSessao(sessao.id);
    Toast.success('Sessão excluída.');
    await this.atualizarLista();
  }
};

/* ================================================================
 * Cronômetro integrado
 * ================================================================ */
const CronometroView = {
  _startTime: null,
  _elapsed: 0,
  _timer: null,
  _state: 'idle', // idle | running | paused

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Cronômetro de Estudo</h2>
          <p>Inicie, pause e finalize sessões de estudo com cronômetro automático.</p>
        </div>
      </div>

      <div class="timer-card">
        <div class="timer-display" id="timerDisplay">00:00:00</div>
        <div class="timer-controls">
          <button class="btn btn-primary btn-lg" id="btnStart">▶ Iniciar</button>
          <button class="btn btn-secondary btn-lg" id="btnPause" disabled>⏸ Pausar</button>
          <button class="btn btn-success btn-lg" id="btnStop" disabled>⏹ Finalizar</button>
          <button class="btn btn-ghost btn-lg" id="btnReset" disabled>↺ Resetar</button>
        </div>
        <div class="timer-meta">
          <div class="timer-meta-item">
            <div class="timer-meta-label">Iniciado em</div>
            <div class="timer-meta-value" id="metaInicio">—</div>
          </div>
          <div class="timer-meta-item">
            <div class="timer-meta-label">Tempo decorrido</div>
            <div class="timer-meta-value" id="metaDecorrido">0min</div>
          </div>
          <div class="timer-meta-item">
            <div class="timer-meta-label">Estado</div>
            <div class="timer-meta-value" id="metaEstado">Parado</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Dados da sessão</h3>
        </div>
        <p class="form-hint mb-16">Preencha antes de finalizar para registrar a sessão corretamente.</p>
        <form id="formCronometro">
          <div class="form-group">
            <label class="form-label">Concurso <span class="req">*</span></label>
            <select class="form-control" name="concurso_id" required id="cronConcurso">
              <option value="">Selecione...</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Matéria <span class="req">*</span></label>
              <select class="form-control" name="materia_id" required id="cronMateria">
                <option value="">Selecione...</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Conteúdo</label>
              <select class="form-control" name="conteudo_id" id="cronConteudo">
                <option value="">—</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Tipo de estudo</label>
              <select class="form-control" name="tipo_estudo">
                <option value="teoria">Teoria</option>
                <option value="exercicios">Exercícios</option>
                <option value="revisao">Revisão</option>
                <option value="simulado">Simulado</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Técnica</label>
              <select class="form-control" name="tecnica">
                <option value="pomodoro">Pomodoro</option>
                <option value="leitura_ativa">Leitura ativa</option>
                <option value="flashcards">Flashcards</option>
                <option value="resolucao_questoes">Resolução de questões</option>
                <option value="livre">Livre</option>
              </select>
            </div>
          </div>
          <h3 class="mb-8 mt-16" style="font-size: 14px; color: var(--text-secondary);">Avaliação (preencha ao finalizar)</h3>
          ${SessoesView.ratingField('Concentração', 'cron_concentracao', 3)}
          ${SessoesView.ratingField('Energia', 'cron_energia', 3)}
          ${SessoesView.ratingField('Compreensão', 'cron_compreensao', 3)}
          ${SessoesView.ratingField('Humor antes', 'cron_humor_antes', 3)}
          ${SessoesView.ratingField('Humor após', 'cron_humor_depois', 3)}
        </form>
      </div>
    `;

    const concursos = await Service.listarConcursos();
    concursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nome;
      $('#cronConcurso').appendChild(opt);
    });
    if (App.filtroConcurso) $('#cronConcurso').value = App.filtroConcurso;

    $('#cronConcurso').addEventListener('change', async e => {
      const mats = await Service.listarMaterias(e.target.value);
      $('#cronMateria').innerHTML = '<option value="">Selecione...</option>' +
        mats.map(m => `<option value="${m.id}">${Utils.escapeHTML(m.nome)}</option>`).join('');
      $('#cronConteudo').innerHTML = '<option value="">—</option>';
    });
    $('#cronMateria').addEventListener('change', async e => {
      const cs = await Service.listarConteudos(e.target.value);
      $('#cronConteudo').innerHTML = '<option value="">—</option>' +
        cs.map(c => `<option value="${c.id}">${Utils.escapeHTML(c.nome)}</option>`).join('');
    });

    // Listener ratings
    container.querySelectorAll('.rating').forEach(r => {
      r.querySelectorAll('.rating-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          r.querySelectorAll('.rating-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          r.dataset.value = dot.dataset.value;
        });
      });
    });

    $('#btnStart').addEventListener('click', () => this.start());
    $('#btnPause').addEventListener('click', () => this.pause());
    $('#btnStop').addEventListener('click', () => this.stop());
    $('#btnReset').addEventListener('click', () => this.reset());
  },

  start() {
    if (this._state === 'running') return;
    if (this._state === 'idle') {
      this._startTime = Date.now();
      $('#metaInicio').textContent = Utils.nowTime();
    } else if (this._state === 'paused') {
      this._startTime = Date.now() - this._elapsed;
    }
    this._state = 'running';
    $('#btnStart').disabled = true;
    $('#btnPause').disabled = false;
    $('#btnStop').disabled = false;
    $('#btnReset').disabled = false;
    $('#metaEstado').textContent = 'Em andamento';
    $('#timerDisplay').classList.add('running');
    $('#timerDisplay').classList.remove('paused');
    this._timer = setInterval(() => this.tick(), 1000);
    this.tick();
  },

  pause() {
    if (this._state !== 'running') return;
    clearInterval(this._timer);
    this._elapsed = Date.now() - this._startTime;
    this._state = 'paused';
    $('#btnStart').disabled = false;
    $('#btnStart').textContent = '▶ Retomar';
    $('#btnPause').disabled = true;
    $('#metaEstado').textContent = 'Pausado';
    $('#timerDisplay').classList.remove('running');
    $('#timerDisplay').classList.add('paused');
  },

  async stop() {
    if (this._state === 'idle') return;
    if (this._state === 'running') {
      this._elapsed = Date.now() - this._startTime;
      clearInterval(this._timer);
    }
    // Valida formulário
    const fd = new FormData($('#formCronometro'));
    if (!fd.get('concurso_id') || !fd.get('materia_id')) {
      Toast.error('Preencha concurso e matéria antes de finalizar.');
      // Reabre timer
      if (this._state === 'running') {
        this._timer = setInterval(() => this.tick(), 1000);
      }
      return;
    }

    const inicio = new Date(Date.now() - this._elapsed).toISOString();
    const fim = new Date().toISOString();
    const ratings = {};
    $('#formCronometro').querySelectorAll('.rating').forEach(r => {
      ratings[r.getAttribute('name')] = Number(r.dataset.value) || 3;
    });

    const sessao = {
      concurso_id: fd.get('concurso_id'),
      materia_id: fd.get('materia_id'),
      conteudo_id: fd.get('conteudo_id') || null,
      data_inicio: inicio,
      data_fim: fim,
      tipo_estudo: fd.get('tipo_estudo'),
      tecnica: fd.get('tecnica'),
      nivel_concentracao: ratings.cron_concentracao || 3,
      nivel_energia: ratings.cron_energia || 3,
      nivel_compreensao: ratings.cron_compreensao || 3,
      humor_antes: ratings.cron_humor_antes || 3,
      humor_depois: ratings.cron_humor_depois || 3
    };

    await Service.salvarSessao(sessao);
    Toast.success(`Sessão salva! ${Utils.formatDuration(sessao.tempo_minutos)} estudados.`);
    this.reset();
    // Atualiza badge de revisões
    await App.atualizarBadgeRevisoes();
  },

  reset() {
    clearInterval(this._timer);
    this._startTime = null;
    this._elapsed = 0;
    this._state = 'idle';
    $('#timerDisplay').textContent = '00:00:00';
    $('#timerDisplay').classList.remove('running', 'paused');
    $('#btnStart').disabled = false;
    $('#btnStart').textContent = '▶ Iniciar';
    $('#btnPause').disabled = true;
    $('#btnStop').disabled = true;
    $('#btnReset').disabled = true;
    $('#metaInicio').textContent = '—';
    $('#metaDecorrido').textContent = '0min';
    $('#metaEstado').textContent = 'Parado';
  },

  tick() {
    const elapsed = Date.now() - this._startTime;
    const sec = Math.floor(elapsed / 1000);
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    $('#timerDisplay').textContent = `${h}:${m}:${s}`;
    $('#metaDecorrido').textContent = Utils.formatDuration(Math.floor(sec / 60));
  }
};

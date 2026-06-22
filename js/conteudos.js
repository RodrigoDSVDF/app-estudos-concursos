/* ================================================================
 * conteudos.js — Módulo de Conteúdos (CRUD + status + dificuldade)
 * ================================================================ */

const ConteudosView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Conteúdos</h2>
          <p>Gerencie os conteúdos específicos de cada matéria.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btnNovoConteudo">+ Novo conteúdo</button>
        </div>
      </div>

      <div class="filter-bar">
        <select class="form-control" id="filtroConcurso">
          <option value="">Todos os concursos</option>
        </select>
        <select class="form-control" id="filtroMateria">
          <option value="">Todas as matérias</option>
        </select>
        <select class="form-control" id="filtroStatus">
          <option value="">Todos os status</option>
          <option value="nao_iniciado">Não iniciado</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluido">Concluído</option>
        </select>
      </div>

      <div id="conteudosList" class="list-stack">
        <div class="loading">Carregando...</div>
      </div>
    `;

    // Preenche filtros
    const concursos = await Service.listarConcursos();
    concursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      $('#filtroConcurso').appendChild(opt);
    });

    // Aplica filtro global se houver
    if (App.filtroConcurso) {
      $('#filtroConcurso').value = App.filtroConcurso;
      await this.atualizarMateriasFiltro(App.filtroConcurso);
    } else {
      await this.atualizarMateriasFiltro();
    }

    if (App.filtroMateria) {
      $('#filtroMateria').value = App.filtroMateria;
    }

    $('#filtroConcurso').addEventListener('change', async (e) => {
      await this.atualizarMateriasFiltro(e.target.value);
      await this.atualizarLista();
    });
    $('#filtroMateria').addEventListener('change', () => this.atualizarLista());
    $('#filtroStatus').addEventListener('change', () => this.atualizarLista());
    $('#btnNovoConteudo').addEventListener('click', () => this.abrirFormulario());

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
      opt.value = m.id;
      opt.textContent = m.nome;
      sel.appendChild(opt);
    });
    if (atual) sel.value = atual;
  },

  async atualizarLista() {
    const concursoId = $('#filtroConcurso').value;
    const materiaId = $('#filtroMateria').value;
    const status = $('#filtroStatus').value;

    let conteudos = await Service.listarConteudos();
    const materias = await Service.listarMaterias();
    const materiasById = {};
    materias.forEach(m => materiasById[m.id] = m);

    if (concursoId) {
      const mats = materias.filter(m => m.concurso_id === concursoId).map(m => m.id);
      conteudos = conteudos.filter(c => mats.includes(c.materia_id));
    }
    if (materiaId) conteudos = conteudos.filter(c => c.materia_id === materiaId);
    if (status) conteudos = conteudos.filter(c => c.status === status);

    // Ordena: em_andamento > nao_iniciado > concluido, depois por nome
    const ordemStatus = { em_andamento: 0, nao_iniciado: 1, concluido: 2 };
    conteudos.sort((a, b) => {
      const o = (ordemStatus[a.status] || 0) - (ordemStatus[b.status] || 0);
      if (o !== 0) return o;
      return (a.nome || '').localeCompare(b.nome || '');
    });

    const listEl = $('#conteudosList');
    if (!conteudos.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📑</div>
          <h3>Nenhum conteúdo encontrado</h3>
          <p>Cadastre conteúdos específicos para cada matéria.</p>
          <button class="btn btn-primary" onclick="ConteudosView.abrirFormulario()">+ Cadastrar conteúdo</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    for (const c of conteudos) {
      const materia = materiasById[c.materia_id];
      const statusInfo = this.statusInfo(c.status);
      const dificuldade = c.dificuldade ? '⭐'.repeat(c.dificuldade) : '<span class="text-muted">—</span>';

      const item = el(`
        <div class="list-item" data-id="${c.id}">
          <div class="list-item-content">
            <div class="list-item-title">
              ${Utils.escapeHTML(c.nome)}
              <span class="badge-pill ${statusInfo.cls}">${statusInfo.label}</span>
            </div>
            <div class="list-item-subtitle">
              ${materia ? Utils.escapeHTML(materia.nome) : '—'}
              • Dificuldade: ${dificuldade}
            </div>
          </div>
          <div class="list-item-actions">
            ${c.status !== 'concluido' ? `<button class="btn btn-success btn-sm" data-action="concluir" title="Marcar como concluído">✓</button>` : ''}
            <button class="btn btn-ghost btn-sm" data-action="editar" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="excluir" title="Excluir">🗑️</button>
          </div>
        </div>
      `);
      item.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'editar') this.abrirFormulario(c.id);
        else if (action === 'excluir') this.excluir(c);
        else if (action === 'concluir') this.marcarConcluido(c);
      });
      listEl.appendChild(item);
    }
  },

  statusInfo(status) {
    const map = {
      nao_iniciado: { cls: 'pending', label: 'Não iniciado' },
      em_andamento: { cls: 'progress', label: 'Em andamento' },
      concluido: { cls: 'done', label: 'Concluído' }
    };
    return map[status] || map.nao_iniciado;
  },

  async abrirFormulario(id = null) {
    const conteudo = id ? await Service.obterConteudo(id) : {};
    const materias = await Service.listarMaterias();
    if (!materias.length) {
      Toast.warning('Cadastre uma matéria primeiro.');
      return;
    }
    const concursos = await Service.listarConcursos();
    const materiasComConcurso = materias.map(m => ({
      ...m,
      concurso_nome: concursos.find(c => c.id === m.concurso_id)?.nome || '—'
    }));

    const body = el(`
      <form id="formConteudo">
        <div class="form-group">
          <label class="form-label">Matéria <span class="req">*</span></label>
          <select class="form-control" name="materia_id" required>
            ${materiasComConcurso.map(m => `<option value="${m.id}" ${conteudo.materia_id === m.id ? 'selected' : ''}>${Utils.escapeHTML(m.concurso_nome)} — ${Utils.escapeHTML(m.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nome do conteúdo <span class="req">*</span></label>
          <input type="text" class="form-control" name="nome" required value="${Utils.escapeHTML(conteudo.nome || '')}" placeholder="Ex.: Crase" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" name="status">
              <option value="nao_iniciado" ${conteudo.status === 'nao_iniciado' ? 'selected' : ''}>Não iniciado</option>
              <option value="em_andamento" ${conteudo.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
              <option value="concluido" ${conteudo.status === 'concluido' ? 'selected' : ''}>Concluído</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Dificuldade percebida (1-5)</label>
            <div class="range-group">
              <input type="range" name="dificuldade" min="1" max="5" value="${conteudo.dificuldade || 3}" />
              <span class="range-value" id="dificuldadeValor">${conteudo.dificuldade || 3}</span>
            </div>
          </div>
        </div>
        ${conteudo.status === 'concluido' ? `
          <p class="form-hint">✓ Conteúdo concluído. As revisões espaçadas (1, 7, 15 e 30 dias) já foram geradas automaticamente.</p>
        ` : ''}
      </form>
    `);

    const footer = el(`
      <div>
        <button class="btn btn-ghost" id="btnCancelar">Cancelar</button>
        <button class="btn btn-primary" id="btnSalvar">Salvar</button>
      </div>
    `);

    Modal.open({ title: id ? 'Editar conteúdo' : 'Novo conteúdo', body, footer });

    $('input[name="dificuldade"]').addEventListener('input', e => {
      $('#dificuldadeValor').textContent = e.target.value;
    });
    $('#btnCancelar').addEventListener('click', () => Modal.close());
    $('#btnSalvar').addEventListener('click', () => this.salvarFormulario(id));
  },

  async salvarFormulario(id) {
    const form = $('#formConteudo');
    const fd = new FormData(form);
    const data = {
      materia_id: fd.get('materia_id'),
      nome: fd.get('nome').trim(),
      status: fd.get('status'),
      dificuldade: Number(fd.get('dificuldade')) || 3
    };
    if (!data.nome || !data.materia_id) {
      Toast.error('Preencha os campos obrigatórios.');
      return;
    }
    if (id) {
      const existente = await Service.obterConteudo(id);
      Object.assign(existente, data);
      await Service.salvarConteudo(existente);
      Toast.success('Conteúdo atualizado.');
    } else {
      await Service.salvarConteudo(data);
      Toast.success('Conteúdo cadastrado.');
    }
    Modal.close();
    await this.atualizarLista();
  },

  async marcarConcluido(conteudo) {
    conteudo.status = 'concluido';
    await Service.salvarConteudo(conteudo);
    Toast.success(`Conteúdo "${conteudo.nome}" marcado como concluído! Revisões geradas automaticamente.`);
    await this.atualizarLista();
  },

  async excluir(conteudo) {
    const ok = await Confirm.ask(
      `Excluir o conteúdo "${conteudo.nome}" e todas as sessões e revisões relacionadas?`,
      'Excluir conteúdo'
    );
    if (!ok) return;
    await Service.excluirConteudo(conteudo.id);
    Toast.success('Conteúdo excluído.');
    await this.atualizarLista();
  }
};

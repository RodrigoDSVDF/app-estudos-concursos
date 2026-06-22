/* ================================================================
 * materias.js — Módulo de Matérias (CRUD + progresso por matéria)
 * ================================================================ */

const MateriasView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Matérias</h2>
          <p>Organize as matérias de cada concurso e acompanhe o progresso.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btnNovaMateria">+ Nova matéria</button>
        </div>
      </div>

      <div class="filter-bar">
        <select class="form-control" id="filtroConcurso">
          <option value="">Todos os concursos</option>
        </select>
      </div>

      <div id="materiasList" class="list-stack">
        <div class="loading">Carregando...</div>
      </div>
    `;

    const concursos = await Service.listarConcursos();
    const sel = $('#filtroConcurso');
    concursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      sel.appendChild(opt);
    });

    // Aplica filtro global se houver
    if (App.filtroConcurso) sel.value = App.filtroConcurso;

    sel.addEventListener('change', () => this.atualizarLista(sel.value));
    $('#btnNovaMateria').addEventListener('click', () => this.abrirFormulario());

    await this.atualizarLista(sel.value);
  },

  async atualizarLista(concursoId = '') {
    const materias = concursoId
      ? await Service.listarMaterias(concursoId)
      : await Service.listarMaterias();
    const concursos = await Service.listarConcursos();
    const concursosById = {};
    concursos.forEach(c => concursosById[c.id] = c);

    const listEl = $('#materiasList');
    if (!materias.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📐</div>
          <h3>Nenhuma matéria cadastrada</h3>
          <p>Cadastre as matérias que você precisa estudar.</p>
          <button class="btn btn-primary" onclick="MateriasView.abrirFormulario()">+ Cadastrar matéria</button>
        </div>
      `;
      return;
    }

    // Busca conteúdos para calcular progresso
    const conteudos = await Service.listarConteudos();

    listEl.innerHTML = '';
    for (const m of materias) {
      const conts = conteudos.filter(c => c.materia_id === m.id);
      const concluidos = conts.filter(c => c.status === 'concluido').length;
      const percentual = conts.length ? Math.round((concluidos / conts.length) * 100) : 0;
      const concurso = concursosById[m.concurso_id];

      const item = el(`
        <div class="list-item" data-id="${m.id}">
          <div class="list-item-content">
            <div class="list-item-title">
              ${Utils.escapeHTML(m.nome)}
              <span class="badge-pill draft">Peso ${m.peso || 1}</span>
              ${m.prioridade ? `<span class="badge-pill draft">Prioridade ${m.prioridade}</span>` : ''}
            </div>
            <div class="list-item-subtitle">
              ${concurso ? Utils.escapeHTML(concurso.nome) : '—'}
            </div>
            <div class="progress-bar mt-8" style="max-width: 400px;">
              <div class="progress-bar-fill ${percentual === 100 ? 'success' : ''}" style="width: ${percentual}%"></div>
            </div>
            <div class="list-item-subtitle mt-8">
              ${conts.length} conteúdos • ${percentual}% concluído
              ${m.carga_horaria_planejada ? ` • Carga horária: ${m.carga_horaria_planejada}h` : ''}
            </div>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-ghost btn-sm" data-action="conteudos" title="Ver conteúdos">📑</button>
            <button class="btn btn-ghost btn-sm" data-action="editar" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="excluir" title="Excluir">🗑️</button>
          </div>
        </div>
      `);
      item.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'editar') this.abrirFormulario(m.id);
        else if (action === 'excluir') this.excluir(m);
        else if (action === 'conteudos') {
          App.filtroMateria = m.id;
          App.navigate('conteudos');
        }
      });
      listEl.appendChild(item);
    }
  },

  async abrirFormulario(id = null) {
    const materia = id ? await Service.obterMateria(id) : {};
    const concursos = await Service.listarConcursos();

    if (!concursos.length) {
      Toast.warning('Cadastre um concurso primeiro.');
      return;
    }

    const body = el(`
      <form id="formMateria">
        <div class="form-group">
          <label class="form-label">Concurso <span class="req">*</span></label>
          <select class="form-control" name="concurso_id" required>
            ${concursos.map(c => `<option value="${c.id}" ${materia.concurso_id === c.id ? 'selected' : ''}>${Utils.escapeHTML(c.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nome da matéria <span class="req">*</span></label>
          <input type="text" class="form-control" name="nome" required value="${Utils.escapeHTML(materia.nome || '')}" placeholder="Ex.: Direito Constitucional" />
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Peso na prova</label>
            <input type="number" class="form-control" name="peso" min="1" max="10" value="${materia.peso || 1}" />
          </div>
          <div class="form-group">
            <label class="form-label">Prioridade (1-5)</label>
            <input type="number" class="form-control" name="prioridade" min="1" max="5" value="${materia.prioridade || 3}" />
          </div>
          <div class="form-group">
            <label class="form-label">Carga horária (h)</label>
            <input type="number" class="form-control" name="carga_horaria_planejada" min="0" value="${materia.carga_horaria_planejada || ''}" />
          </div>
        </div>
      </form>
    `);

    const footer = el(`
      <div>
        <button class="btn btn-ghost" id="btnCancelar">Cancelar</button>
        <button class="btn btn-primary" id="btnSalvar">Salvar</button>
      </div>
    `);

    Modal.open({ title: id ? 'Editar matéria' : 'Nova matéria', body, footer });

    $('#btnCancelar').addEventListener('click', () => Modal.close());
    $('#btnSalvar').addEventListener('click', () => this.salvarFormulario(id));
  },

  async salvarFormulario(id) {
    const form = $('#formMateria');
    const fd = new FormData(form);
    const data = {
      concurso_id: fd.get('concurso_id'),
      nome: fd.get('nome').trim(),
      peso: Number(fd.get('peso')) || 1,
      prioridade: Number(fd.get('prioridade')) || 3,
      carga_horaria_planejada: Number(fd.get('carga_horaria_planejada')) || 0
    };
    if (!data.nome || !data.concurso_id) {
      Toast.error('Preencha os campos obrigatórios.');
      return;
    }

    if (id) {
      const existente = await Service.obterMateria(id);
      Object.assign(existente, data);
      await Service.salvarMateria(existente);
      Toast.success('Matéria atualizada.');
    } else {
      await Service.salvarMateria(data);
      Toast.success('Matéria cadastrada.');
    }

    Modal.close();
    await this.atualizarLista($('#filtroConcurso').value);
  },

  async excluir(materia) {
    const ok = await Confirm.ask(
      `Excluir a matéria "${materia.nome}" e todos os conteúdos e sessões relacionados?`,
      'Excluir matéria'
    );
    if (!ok) return;
    await Service.excluirMateria(materia.id);
    Toast.success('Matéria excluída.');
    await this.atualizarLista($('#filtroConcurso').value);
  }
};

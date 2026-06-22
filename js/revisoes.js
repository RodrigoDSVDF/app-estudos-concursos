/* ================================================================
 * revisoes.js — Sistema de Revisão Espaçada
 * Geração automática em D+1, D+7, D+15, D+30 ao concluir conteúdo
 * ================================================================ */

const RevisoesView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Revisões</h2>
          <p>Sistema de revisão espaçada para fixação de conteúdo.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="btnFiltroAtrasadas">⚠ Mostrar atrasadas</button>
        </div>
      </div>

      <div class="filter-bar">
        <select class="form-control" id="filtroStatus">
          <option value="">Todas</option>
          <option value="pendente">Pendentes</option>
          <option value="concluida">Concluídas</option>
        </select>
        <select class="form-control" id="filtroConcurso">
          <option value="">Todos os concursos</option>
        </select>
      </div>

      <div id="revisoesList" class="list-stack">
        <div class="loading">Carregando...</div>
      </div>
    `;

    const concursos = await Service.listarConcursos();
    concursos.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nome;
      $('#filtroConcurso').appendChild(opt);
    });

    $('#filtroStatus').addEventListener('change', () => this.atualizarLista());
    $('#filtroConcurso').addEventListener('change', () => this.atualizarLista());
    $('#btnFiltroAtrasadas').addEventListener('click', () => {
      $('#filtroStatus').value = 'pendente';
      this._apenasAtrasadas = !this._apenasAtrasadas;
      this.atualizarLista();
    });

    await this.atualizarLista();
  },

  async atualizarLista() {
    const filtros = {};
    if ($('#filtroStatus').value) filtros.status = $('#filtroStatus').value;
    if (this._apenasAtrasadas) filtros.apenas_atrasadas = true;

    let revisoes = await Service.listarRevisoes(filtros);
    const concursoFiltro = $('#filtroConcurso').value;
    if (concursoFiltro) {
      // Filtra por concurso via matéria -> conteúdo
      const materias = await Service.listarMaterias(concursoFiltro);
      const matIds = new Set(materias.map(m => m.id));
      revisoes = revisoes.filter(r => matIds.has(r.materia_id));
    }

    // Dados relacionados
    const conteudos = await Service.listarConteudos();
    const coById = {}; conteudos.forEach(c => coById[c.id] = c);
    const materias = await Service.listarMaterias();
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const concursos = await Service.listarConcursos();
    const cById = {}; concursos.forEach(c => cById[c.id] = c);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const listEl = $('#revisoesList');
    if (!revisoes.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔁</div>
          <h3>Nenhuma revisão encontrada</h3>
          <p>As revisões são geradas automaticamente quando você marca um conteúdo como concluído.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    for (const r of revisoes) {
      const conteudo = coById[r.conteudo_id];
      const materia = mById[r.materia_id] || (conteudo ? mById[conteudo.materia_id] : null);
      const concurso = materia ? cById[materia.concurso_id] : null;

      const dataProg = new Date(r.data_programada);
      dataProg.setHours(0, 0, 0, 0);
      const diffDias = Math.round((dataProg - hoje) / 86400000);
      const isAtrasada = r.status === 'pendente' && diffDias < 0;
      const isHoje = r.status === 'pendente' && diffDias === 0;

      let badge;
      if (r.status === 'concluida') {
        badge = '<span class="badge-pill done">✓ Concluída</span>';
      } else if (isAtrasada) {
        badge = `<span class="badge-pill overdue">⚠ ${Math.abs(diffDias)} dia(s) atrasada</span>`;
      } else if (isHoje) {
        badge = '<span class="badge-pill progress">Para hoje</span>';
      } else {
        badge = `<span class="badge-pill planned">Em ${diffDias} dia(s)</span>`;
      }

      const item = el(`
        <div class="list-item" data-id="${r.id}">
          <div class="list-item-content">
            <div class="list-item-title">
              ${conteudo ? Utils.escapeHTML(conteudo.nome) : '—'}
              ${badge}
            </div>
            <div class="list-item-subtitle">
              ${concurso ? Utils.escapeHTML(concurso.nome) : ''} ${concurso && materia ? '•' : ''} ${materia ? Utils.escapeHTML(materia.nome) : ''}
              <br>${Utils.escapeHTML(r.descricao || '')}
              <br>Programada para: ${Utils.formatDate(r.data_programada)}
              ${r.concluida_em ? ` • Concluída em ${Utils.formatDate(r.concluida_em)}` : ''}
            </div>
          </div>
          <div class="list-item-actions">
            ${r.status === 'pendente' ? `
              <button class="btn btn-success btn-sm" data-action="concluir" title="Marcar como concluída">✓</button>
              <button class="btn btn-ghost btn-sm" data-action="reagendar" title="Reagendar">📅</button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" data-action="excluir" title="Excluir">🗑️</button>
          </div>
        </div>
      `);
      item.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'concluir') this.concluir(r);
        else if (action === 'reagendar') this.reagendar(r);
        else if (action === 'excluir') this.excluir(r);
      });
      listEl.appendChild(item);
    }
  },

  async concluir(revisao) {
    revisao.status = 'concluida';
    revisao.concluida_em = new Date().toISOString();
    await Service.salvarRevisao(revisao);
    Toast.success('Revisão concluída!');
    await this.atualizarLista();
    await App.atualizarBadgeRevisoes();
  },

  async reagendar(revisao) {
    const novaData = await this.promptData(`Reagendar revisão para "${revisao.descricao || ''}"`, revisao.data_programada);
    if (!novaData) return;
    revisao.data_programada = new Date(novaData + 'T10:00:00').toISOString();
    await Service.salvarRevisao(revisao);
    Toast.success('Revisão reagendada.');
    await this.atualizarLista();
    await App.atualizarBadgeRevisoes();
  },

  promptData(mensagem, dataAtual) {
    return new Promise(resolve => {
      const valor = dataAtual ? dataAtual.split('T')[0] : Utils.todayISO();
      const body = el(`
        <div>
          <p style="margin-bottom: 12px;">${Utils.escapeHTML(mensagem)}</p>
          <input type="date" class="form-control" id="inputDataReagendar" value="${valor}" />
        </div>
      `);
      const footer = el(`
        <div>
          <button class="btn btn-ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnOk">Confirmar</button>
        </div>
      `);
      Modal.open({ title: 'Reagendar revisão', body, footer, size: 'sm' });
      $('#btnCancelar').addEventListener('click', () => { Modal.close(); resolve(null); });
      $('#btnOk').addEventListener('click', () => {
        const v = $('#inputDataReagendar').value;
        Modal.close();
        resolve(v);
      });
    });
  },

  async excluir(revisao) {
    const ok = await Confirm.ask('Excluir esta revisão?', 'Excluir revisão');
    if (!ok) return;
    await Service.excluirRevisao(revisao.id);
    Toast.success('Revisão excluída.');
    await this.atualizarLista();
    await App.atualizarBadgeRevisoes();
  }
};

/* ================================================================
 * anotacoes.js — Bloco de Anotações (resumo, dúvidas, aprendizados,
 * erros recorrentes, próximos passos + tags + busca)
 * ================================================================ */

const AnotacoesView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Anotações</h2>
          <p>Registre resumos, dúvidas, aprendizados e erros recorrentes de cada sessão.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" id="btnNovaAnotacao">+ Nova anotação</button>
        </div>
      </div>

      <div class="filter-bar">
        <input type="text" class="form-control search-input" id="buscaAnotacao" placeholder="🔍 Buscar por palavra-chave..." />
        <select class="form-control" id="filtroTag">
          <option value="">Todas as tags</option>
        </select>
      </div>

      <div id="anotacoesList" class="list-stack">
        <div class="loading">Carregando...</div>
      </div>
    `;

    $('#btnNovaAnotacao').addEventListener('click', () => this.abrirFormulario());
    $('#buscaAnotacao').addEventListener('input', Utils.debounce(() => this.atualizarLista(), 250));
    $('#filtroTag').addEventListener('change', () => this.atualizarLista());

    await this.atualizarLista();

    // Se veio de uma sessão específica, abre direto
    if (App.sessaoParaAnotacao) {
      const id = App.sessaoParaAnotacao;
      App.sessaoParaAnotacao = null;
      this.abrirFormulario(null, id);
    }
  },

  async atualizarLista() {
    const busca = ($('#buscaAnotacao').value || '').toLowerCase().trim();
    const tagFiltro = $('#filtroTag').value;

    let anotacoes = await Service.listarAnotacoes();
    // Ordena por atualização decrescente
    anotacoes.sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''));

    // Coleta todas as tags para o filtro
    const todasTags = new Set();
    anotacoes.forEach(a => (a.tags || []).forEach(t => todasTags.add(t)));
    const selTag = $('#filtroTag');
    const tagAtual = selTag.value;
    selTag.innerHTML = '<option value="">Todas as tags</option>' +
      [...todasTags].sort().map(t => `<option value="${Utils.escapeHTML(t)}">${Utils.escapeHTML(t)}</option>`).join('');
    selTag.value = tagAtual;

    // Aplica filtros
    if (busca) {
      anotacoes = anotacoes.filter(a =>
        (a.resumo || '').toLowerCase().includes(busca) ||
        (a.duvidas || '').toLowerCase().includes(busca) ||
        (a.aprendizados || '').toLowerCase().includes(busca) ||
        (a.erros_recorrentes || '').toLowerCase().includes(busca) ||
        (a.proximos_passos || '').toLowerCase().includes(busca) ||
        (a.tags || []).some(t => t.toLowerCase().includes(busca))
      );
    }
    if (tagFiltro) {
      anotacoes = anotacoes.filter(a => (a.tags || []).includes(tagFiltro));
    }

    // Busca dados relacionados
    const sessoes = await Service.listarSessoes();
    const sById = {}; sessoes.forEach(s => sById[s.id] = s);
    const materias = await Service.listarMaterias();
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const conteudos = await Service.listarConteudos();
    const coById = {}; conteudos.forEach(c => coById[c.id] = c);
    const concursos = await Service.listarConcursos();
    const cById = {}; concursos.forEach(c => cById[c.id] = c);

    const listEl = $('#anotacoesList');
    if (!anotacoes.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗒️</div>
          <h3>Nenhuma anotação encontrada</h3>
          <p>Crie uma nova anotação ou revise seus filtros de busca.</p>
          <button class="btn btn-primary" onclick="AnotacoesView.abrirFormulario()">+ Nova anotação</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    for (const a of anotacoes) {
      const sessao = sById[a.sessao_id];
      const materia = sessao ? mById[sessao.materia_id] : (a.materia_id ? mById[a.materia_id] : null);
      const conteudo = a.conteudo_id ? coById[a.conteudo_id] : (sessao ? coById[sessao.conteudo_id] : null);
      const concurso = sessao ? cById[sessao.concurso_id] : null;

      const tags = (a.tags || []).map(t => `<span class="tag">${Utils.escapeHTML(t)}</span>`).join('');

      const item = el(`
        <div class="list-item" data-id="${a.id}" style="display:block; cursor:pointer;">
          <div class="flex justify-between gap-12 mb-8">
            <div class="flex-1">
              <div class="list-item-title">
                ${conteudo ? Utils.escapeHTML(conteudo.nome) : 'Anotação avulsa'}
                ${materia ? `<span class="badge-pill draft">${Utils.escapeHTML(materia.nome)}</span>` : ''}
              </div>
              <div class="list-item-subtitle">
                ${concurso ? Utils.escapeHTML(concurso.nome) + ' • ' : ''}
                ${a.atualizado_em ? 'Atualizada em ' + Utils.formatDate(a.atualizado_em) : ''}
                ${sessao ? ' • Sessão de ' + Utils.formatDate(sessao.data_inicio) : ''}
              </div>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-ghost btn-sm" data-action="editar" title="Editar">✏️</button>
              <button class="btn btn-ghost btn-sm" data-action="excluir" title="Excluir">🗑️</button>
            </div>
          </div>
          ${a.resumo ? `<div class="mb-8"><strong style="font-size:12px; color: var(--text-muted);">RESUMO</strong><div style="font-size:13px; margin-top:4px;">${Utils.escapeHTML(a.resumo).replace(/\\n/g, '<br>')}</div></div>` : ''}
          ${a.aprendizados ? `<div class="mb-8"><strong style="font-size:12px; color: var(--text-muted);">APRENDIZADOS</strong><div style="font-size:13px; margin-top:4px;">${Utils.escapeHTML(a.aprendizados).replace(/\\n/g, '<br>')}</div></div>` : ''}
          ${a.duvidas ? `<div class="mb-8"><strong style="font-size:12px; color: var(--text-muted);">DÚVIDAS</strong><div style="font-size:13px; margin-top:4px; color: var(--warning);">${Utils.escapeHTML(a.duvidas).replace(/\\n/g, '<br>')}</div></div>` : ''}
          ${a.erros_recorrentes ? `<div class="mb-8"><strong style="font-size:12px; color: var(--text-muted);">ERROS RECORRENTES</strong><div style="font-size:13px; margin-top:4px; color: var(--danger);">${Utils.escapeHTML(a.erros_recorrentes).replace(/\\n/g, '<br>')}</div></div>` : ''}
          ${a.proximos_passos ? `<div class="mb-8"><strong style="font-size:12px; color: var(--text-muted);">PRÓXIMOS PASSOS</strong><div style="font-size:13px; margin-top:4px;">${Utils.escapeHTML(a.proximos_passos).replace(/\\n/g, '<br>')}</div></div>` : ''}
          ${tags ? `<div class="mt-8">${tags}</div>` : ''}
        </div>
      `);
      item.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'editar') this.abrirFormulario(a.id);
        else if (action === 'excluir') this.excluir(a);
        else this.abrirFormulario(a.id); // clique no card = editar
      });
      listEl.appendChild(item);
    }
  },

  async abrirFormulario(id = null, sessaoId = null) {
    const anotacao = id ? await DB.get('anotacoes', id) : {};
    if (sessaoId) anotacao.sessao_id = sessaoId;

    const sessoes = await Service.listarSessoes();
    const materias = await Service.listarMaterias();
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const conteudos = await Service.listarConteudos();
    const coById = {}; conteudos.forEach(c => coById[c.id] = c);

    // Cria lista de sessões para select
    const sessoesOpts = sessoes.map(s => {
      const m = mById[s.materia_id];
      const c = coById[s.conteudo_id];
      return `<option value="${s.id}" ${anotacao.sessao_id === s.id ? 'selected' : ''}>${Utils.formatDate(s.data_inicio)} — ${m ? Utils.escapeHTML(m.nome) : '—'}${c ? ' / ' + Utils.escapeHTML(c.nome) : ''}</option>`;
    }).join('');

    const body = el(`
      <form id="formAnotacao">
        <div class="form-group">
          <label class="form-label">Sessão relacionada</label>
          <select class="form-control" name="sessao_id">
            <option value="">— Anotação avulsa —</option>
            ${sessoesOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Resumo</label>
          <textarea class="form-control" name="resumo" rows="4" placeholder="Resumo do que foi estudado...">${Utils.escapeHTML(anotacao.resumo || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Dúvidas</label>
          <textarea class="form-control" name="duvidas" rows="3" placeholder="O que não ficou claro?">${Utils.escapeHTML(anotacao.duvidas || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Principais aprendizados</label>
          <textarea class="form-control" name="aprendizados" rows="3" placeholder="O que você aprendeu de mais importante?">${Utils.escapeHTML(anotacao.aprendizados || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Erros recorrentes</label>
          <textarea class="form-control" name="erros_recorrentes" rows="3" placeholder="Quais erros você está cometendo?">${Utils.escapeHTML(anotacao.erros_recorrentes || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Próximos passos</label>
          <textarea class="form-control" name="proximos_passos" rows="3" placeholder="O que fazer na próxima sessão?">${Utils.escapeHTML(anotacao.proximos_passos || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Tags</label>
          <div id="tagsContainer"></div>
        </div>
      </form>
    `);

    const footer = el(`
      <div>
        <button class="btn btn-ghost" id="btnCancelar">Cancelar</button>
        <button class="btn btn-primary" id="btnSalvar">Salvar</button>
      </div>
    `);

    Modal.open({ title: id ? 'Editar anotação' : 'Nova anotação', body, footer, size: 'lg' });

    // Tags input
    const tagsInput = createTagsInput(anotacao.tags || []);
    $('#tagsContainer').appendChild(tagsInput);

    $('#btnCancelar').addEventListener('click', () => Modal.close());
    $('#btnSalvar').addEventListener('click', () => this.salvarFormulario(id, tagsInput));
  },

  async salvarFormulario(id, tagsInput) {
    const form = $('#formAnotacao');
    const fd = new FormData(form);
    const sessaoId = fd.get('sessao_id') || null;

    let materiaId = null;
    let conteudoId = null;
    if (sessaoId) {
      const s = await Service.obterSessao(sessaoId);
      if (s) {
        materiaId = s.materia_id;
        conteudoId = s.conteudo_id;
      }
    }

    const data = {
      sessao_id: sessaoId,
      materia_id: materiaId,
      conteudo_id: conteudoId,
      resumo: fd.get('resumo').trim(),
      duvidas: fd.get('duvidas').trim(),
      aprendizados: fd.get('aprendizados').trim(),
      erros_recorrentes: fd.get('erros_recorrentes').trim(),
      proximos_passos: fd.get('proximos_passos').trim(),
      tags: tagsInput.getTags()
    };

    if (id) {
      const existente = await DB.get('anotacoes', id);
      Object.assign(existente, data);
      await Service.salvarAnotacao(existente);
      Toast.success('Anotação atualizada.');
    } else {
      await Service.salvarAnotacao(data);
      Toast.success('Anotação criada.');
    }

    Modal.close();
    await this.atualizarLista();
  },

  async excluir(anotacao) {
    const ok = await Confirm.ask('Excluir esta anotação?', 'Excluir anotação');
    if (!ok) return;
    await Service.excluirAnotacao(anotacao.id);
    Toast.success('Anotação excluída.');
    await this.atualizarLista();
  }
};

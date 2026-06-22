/* ================================================================
 * concursos.js — Módulo de Concursos (CRUD completo + upload de edital)
 * ================================================================ */

const ConcursosView = {
  /** Renderiza a view principal de Concursos */
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Concursos</h2>
          <p>Cadastre os concursos que você está prestando e acompanhe o progresso de cada um.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="btnExportCsv">⬇ Exportar CSV</button>
          <button class="btn btn-primary" id="btnNovoConcurso">+ Novo concurso</button>
        </div>
      </div>
      <div id="concursosList" class="list-stack">
        <div class="loading">Carregando concursos...</div>
      </div>
    `;

    $('#btnNovoConcurso').addEventListener('click', () => this.abrirFormulario());
    $('#btnExportCsv').addEventListener('click', () => this.exportarCSV());

    await this.atualizarLista();
  },

  async atualizarLista() {
    const concursos = await Service.listarConcursos();
    const listEl = $('#concursosList');
    if (!concursos.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <h3>Nenhum concurso cadastrado</h3>
          <p>Cadastre seu primeiro concurso para começar a organizar seus estudos.</p>
          <button class="btn btn-primary" onclick="ConcursosView.abrirFormulario()">+ Cadastrar concurso</button>
        </div>
      `;
      return;
    }

    // Busca matérias e conteúdos para calcular progresso
    const materias = await Service.listarMaterias();
    const conteudos = await Service.listarConteudos();

    listEl.innerHTML = '';
    for (const c of concursos) {
      const mats = materias.filter(m => m.concurso_id === c.id);
      const matIds = new Set(mats.map(m => m.id));
      const conts = conteudos.filter(co => matIds.has(co.materia_id));
      const concluidos = conts.filter(co => co.status === 'concluido').length;
      const percentual = conts.length ? Math.round((concluidos / conts.length) * 100) : 0;

      const statusBadge = this.statusBadge(c.status);
      const dataProva = c.data_prova ? Utils.formatDate(c.data_prova) : '—';
      const diasRestantes = c.data_prova
        ? Math.ceil((new Date(c.data_prova).getTime() - Date.now()) / 86400000)
        : null;

      const item = el(`
        <div class="list-item" data-id="${c.id}">
          <div class="list-item-content">
            <div class="list-item-title">
              ${Utils.escapeHTML(c.nome)}
              ${statusBadge}
            </div>
            <div class="list-item-subtitle">
              ${Utils.escapeHTML(c.orgao || '—')} • Banca: ${Utils.escapeHTML(c.banca || '—')} • Prova: ${dataProva}
              ${diasRestantes !== null ? ` • <strong>${diasRestantes > 0 ? `${diasRestantes} dias restantes` : 'Data atingida'}</strong>` : ''}
            </div>
            <div class="progress-bar mt-8" style="max-width: 400px;">
              <div class="progress-bar-fill ${percentual === 100 ? 'success' : ''}" style="width: ${percentual}%"></div>
            </div>
            <div class="list-item-subtitle mt-8">
              ${mats.length} matérias • ${conts.length} conteúdos • ${percentual}% concluído
            </div>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-ghost btn-sm" data-action="editar" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-sm" data-action="edital" title="Editar edital">📎</button>
            <button class="btn btn-ghost btn-sm" data-action="excluir" title="Excluir">🗑️</button>
          </div>
        </div>
      `);
      item.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'editar') this.abrirFormulario(c.id);
        else if (action === 'excluir') this.excluir(c);
        else if (action === 'edital') this.gerenciarEdital(c);
      });
      listEl.appendChild(item);
    }
  },

  statusBadge(status) {
    const map = {
      planejado: { cls: 'planned', label: 'Planejado' },
      em_andamento: { cls: 'progress', label: 'Em andamento' },
      finalizado: { cls: 'done', label: 'Finalizado' }
    };
    const info = map[status] || map.planejado;
    return `<span class="badge-pill ${info.cls}">${info.label}</span>`;
  },

  async abrirFormulario(id = null) {
    const concurso = id ? await Service.obterConcurso(id) : {};
    const editais = id ? await Service.listarEditais(id) : [];

    const body = el(`
      <form id="formConcurso">
        <div class="form-group">
          <label class="form-label">Nome do concurso <span class="req">*</span></label>
          <input type="text" class="form-control" name="nome" required value="${Utils.escapeHTML(concurso.nome || '')}" placeholder="Ex.: TJ-SP — Escrevente Técnico Judiciário" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Órgão</label>
            <input type="text" class="form-control" name="orgao" value="${Utils.escapeHTML(concurso.orgao || '')}" placeholder="Ex.: Tribunal de Justiça de SP" />
          </div>
          <div class="form-group">
            <label class="form-label">Banca organizadora</label>
            <input type="text" class="form-control" name="banca" value="${Utils.escapeHTML(concurso.banca || '')}" placeholder="Ex.: Vunesp" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Data prevista da prova</label>
            <input type="date" class="form-control" name="data_prova" value="${concurso.data_prova || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" name="status">
              <option value="planejado" ${concurso.status === 'planejado' ? 'selected' : ''}>Planejado</option>
              <option value="em_andamento" ${concurso.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
              <option value="finalizado" ${concurso.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Link do edital</label>
          <input type="url" class="form-control" name="link_edital" value="${Utils.escapeHTML(concurso.link_edital || '')}" placeholder="https://..." />
        </div>
        ${id ? `
          <div class="form-group">
            <label class="form-label">Edital em PDF</label>
            <div id="editaisList"></div>
            <input type="file" class="form-control" name="edital_file" accept=".pdf,application/pdf" />
            <p class="form-hint">Aceita PDF. O arquivo é enviado ao Supabase Storage e fica acessível pela URL pública.</p>
          </div>
        ` : `
          <p class="form-hint">💡 Após salvar, você poderá anexar o edital em PDF.</p>
        `}
      </form>
    `);

    const footer = el(`
      <div>
        <button class="btn btn-ghost" id="btnCancelar">Cancelar</button>
        <button class="btn btn-primary" id="btnSalvar">Salvar</button>
      </div>
    `);

    Modal.open({
      title: id ? 'Editar concurso' : 'Novo concurso',
      body,
      footer,
      size: 'lg'
    });

    if (id) await this.renderizarEditaisList(id, editais);

    $('#btnCancelar').addEventListener('click', () => Modal.close());
    $('#btnSalvar').addEventListener('click', () => this.salvarFormulario(id));
  },

  async renderizarEditaisList(concursoId, editais) {
    const wrap = $('#editaisList');
    if (!editais.length) {
      wrap.innerHTML = '<p class="form-hint">Nenhum edital anexado.</p>';
      return;
    }
    wrap.innerHTML = editais.map(e => `
      <div class="list-item" style="padding: 8px 12px; margin-bottom: 6px;">
        <span style="flex:1;">📎 ${Utils.escapeHTML(e.nome_arquivo)} <span class="text-muted">(${(e.tamanho / 1024).toFixed(0)} KB)</span></span>
        <button class="btn btn-ghost btn-sm" data-id="${e.id}" data-action="download" title="Baixar">⬇</button>
        <button class="btn btn-ghost btn-sm" data-id="${e.id}" data-action="open" title="Abrir em nova aba">🔗</button>
        <button class="btn btn-ghost btn-sm" data-id="${e.id}" data-action="delete" title="Excluir">🗑️</button>
      </div>
    `).join('');
    wrap.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const edId = btn.dataset.id;
        const action = btn.dataset.action;
        const ed = editais.find(e => e.id === edId);
        if (!ed) return;

        if (action === 'download' || action === 'open') {
          if (!ed.url_publica) {
            Toast.error('URL do edital não disponível.');
            return;
          }
          if (action === 'open') {
            window.open(ed.url_publica, '_blank');
          } else {
            // Para download: tenta forçar download via fetch
            try {
              const resp = await fetch(ed.url_publica);
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = ed.nome_arquivo;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              // Fallback: abre em nova aba
              console.warn('Download via fetch falhou, abrindo em nova aba:', err);
              window.open(ed.url_publica, '_blank');
            }
          }
        } else if (action === 'delete') {
          const ok = await Confirm.ask(`Excluir o edital "${ed.nome_arquivo}"? O arquivo será removido do storage.`, 'Excluir edital');
          if (!ok) return;
          try {
            await Service.excluirEdital(edId);
            Toast.success('Edital removido.');
            const novos = await Service.listarEditais(concursoId);
            await this.renderizarEditaisList(concursoId, novos);
          } catch (err) {
            Toast.error('Erro ao excluir edital: ' + err.message);
          }
        }
      });
    });
  },

  async salvarFormulario(id) {
    const form = $('#formConcurso');
    const fd = new FormData(form);
    const data = {
      nome: fd.get('nome').trim(),
      orgao: fd.get('orgao').trim(),
      banca: fd.get('banca').trim(),
      data_prova: fd.get('data_prova') || null,
      status: fd.get('status'),
      link_edital: fd.get('link_edital').trim()
    };
    if (!data.nome) {
      Toast.error('Informe o nome do concurso.');
      return;
    }

    if (id) {
      const existente = await Service.obterConcurso(id);
      Object.assign(existente, data);
      await Service.salvarConcurso(existente);
      // Salva edital se foi anexado
      const file = fd.get('edital_file');
      if (file && file.size) {
        try {
          await Service.salvarEdital(id, file);
          Toast.success('Edital anexado com sucesso.');
        } catch (err) {
          Toast.error('Erro ao enviar edital: ' + err.message);
        }
      } else {
        Toast.success('Concurso atualizado.');
      }
    } else {
      const novo = await Service.salvarConcurso(data);
      const file = fd.get('edital_file');
      if (file && file.size) {
        try {
          await Service.salvarEdital(novo.id, file);
          Toast.success('Concurso cadastrado com edital.');
        } catch (err) {
          Toast.error('Concurso cadastrado, mas erro ao enviar edital: ' + err.message);
        }
      } else {
        Toast.success('Concurso cadastrado.');
      }
    }

    Modal.close();
    await this.atualizarLista();
    await App.atualizarFiltroGlobal();
  },

  async excluir(concurso) {
    const ok = await Confirm.ask(
      `Excluir o concurso "${concurso.nome}" e TODOS os registros relacionados (matérias, conteúdos, sessões, anotações e revisões)? Esta ação não pode ser desfeita.`,
      'Excluir concurso'
    );
    if (!ok) return;
    await Service.excluirConcurso(concurso.id);
    Toast.success('Concurso excluído.');
    await this.atualizarLista();
    await App.atualizarFiltroGlobal();
  },

  async gerenciarEdital(concurso) {
    this.abrirFormulario(concurso.id);
  },

  async exportarCSV() {
    const concursos = await Service.listarConcursos();
    if (!concursos.length) {
      Toast.warning('Nenhum concurso para exportar.');
      return;
    }
    const headers = ['nome', 'orgao', 'banca', 'data_prova', 'status', 'link_edital'];
    const lines = [headers.join(';')];
    concursos.forEach(c => {
      lines.push(headers.map(h => `"${(c[h] || '').toString().replace(/"/g, '""')}"`).join(';'));
    });
    const csv = '\uFEFF' + lines.join('\n'); // BOM para Excel reconhecer UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `concursos_${Utils.todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('CSV exportado.');
  }
};

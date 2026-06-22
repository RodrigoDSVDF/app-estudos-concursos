/* ================================================================
 * backup.js — Exportação e Importação de dados
 * Formatos: JSON (backup completo), CSV, Excel (XLSX), PDF
 * ================================================================ */

const BackupView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Backup & Exportação</h2>
          <p>Exporte seus dados em diferentes formatos ou faça backup completo.</p>
        </div>
      </div>

      <div class="grid grid-2 mb-24">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📥 Backup completo (JSON)</h3>
          </div>
          <p class="text-secondary mb-16" style="font-size: 13px;">
            Exporta TODOS os dados (concursos, matérias, conteúdos, sessões, anotações, revisões e editais)
            em um arquivo JSON. Use para backup ou migração entre navegadores.
          </p>
          <div class="flex gap-8 flex-wrap">
            <button class="btn btn-primary" id="btnExportJson">⬇ Exportar JSON</button>
            <button class="btn btn-secondary" id="btnImportJson">⬆ Importar JSON</button>
            <input type="file" id="inputImportJson" accept=".json" hidden />
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📊 Exportar para planilhas</h3>
          </div>
          <p class="text-secondary mb-16" style="font-size: 13px;">
            Exporte os dados das sessões de estudo para CSV (compatível com Excel/Google Sheets)
            ou XLSX (formato nativo do Excel).
          </p>
          <div class="flex gap-8 flex-wrap">
            <button class="btn btn-secondary" id="btnExportCsvSessoes">CSV — Sessões</button>
            <button class="btn btn-secondary" id="btnExportXlsxSessoes">XLSX — Sessões</button>
            <button class="btn btn-secondary" id="btnExportXlsxAll">XLSX — Tudo</button>
          </div>
        </div>
      </div>

      <div class="card mb-24">
        <div class="card-header">
          <h3 class="card-title">📄 Relatório em PDF</h3>
        </div>
        <p class="text-secondary mb-16" style="font-size: 13px;">
          Gera um relatório consolidado em PDF com resumo de atividades, horas estudadas,
          progresso por matéria e lista de revisões pendentes.
        </p>
        <button class="btn btn-primary" id="btnExportPdf">⬇ Gerar PDF</button>
      </div>

      <div class="card mb-24" style="border-color: var(--danger);">
        <div class="card-header">
          <h3 class="card-title" style="color: var(--danger);">⚠ Zona de perigo</h3>
        </div>
        <p class="text-secondary mb-16" style="font-size: 13px;">
          Apaga todos os dados do navegador. Faça um backup JSON antes de prosseguir.
          Esta ação NÃO pode ser desfeita.
        </p>
        <div class="flex gap-8 flex-wrap">
          <button class="btn btn-secondary" id="btnReseed">🌱 Restaurar dados de exemplo</button>
          <button class="btn btn-danger" id="btnLimparTudo">🗑️ Apagar todos os dados</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📈 Estatísticas do banco</h3>
        </div>
        <div id="dbStats" class="loading">Carregando...</div>
      </div>
    `;

    $('#btnExportJson').addEventListener('click', () => this.exportJson());
    $('#btnImportJson').addEventListener('click', () => $('#inputImportJson').click());
    $('#inputImportJson').addEventListener('change', e => this.importJson(e.target.files[0]));
    $('#btnExportCsvSessoes').addEventListener('click', () => this.exportCsvSessoes());
    $('#btnExportXlsxSessoes').addEventListener('click', () => this.exportXlsxSessoes());
    $('#btnExportXlsxAll').addEventListener('click', () => this.exportXlsxAll());
    $('#btnExportPdf').addEventListener('click', () => this.exportPdf());
    $('#btnReseed').addEventListener('click', () => this.reseed());
    $('#btnLimparTudo').addEventListener('click', () => this.limparTudo());

    await this.atualizarStats();
  },

  async atualizarStats() {
    const stats = [
      { label: 'Concursos', store: 'concursos' },
      { label: 'Matérias', store: 'materias' },
      { label: 'Conteúdos', store: 'conteudos' },
      { label: 'Sessões de estudo', store: 'sessoes' },
      { label: 'Anotações', store: 'anotacoes' },
      { label: 'Revisões', store: 'revisoes' },
      { label: 'Editais', store: 'editais' }
    ];
    const html = await Promise.all(stats.map(async s => {
      const count = await DB.count(s.store);
      return `
        <div class="stat-card" style="padding: 14px;">
          <div class="stat-content">
            <div class="stat-label">${s.label}</div>
            <div class="stat-value" style="font-size: 20px;">${count}</div>
          </div>
        </div>
      `;
    }));
    $('#dbStats').innerHTML = `<div class="stat-grid" style="margin: 0;">${html.join('')}</div>`;
  },

  /* ---------- JSON ---------- */
  async exportJson() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aprovado_backup_${Utils.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('Backup JSON gerado.');
  },

  async importJson(file) {
    if (!file) return;
    const ok = await Confirm.ask(
      'Importar um backup substituirá TODOS os dados atuais no Supabase. Deseja continuar?',
      'Importar backup'
    );
    if (!ok) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await DB.importAll(data);
      Toast.success('Backup importado com sucesso no Supabase!');
      await App.atualizarFiltroGlobal();
      await this.atualizarStats();
      App.navigate('dashboard');
    } catch (err) {
      console.error(err);
      Toast.error('Erro ao importar backup: ' + err.message);
    }
  },

  /* ---------- CSV ---------- */
  async exportCsvSessoes() {
    const sessoes = await Service.listarSessoes();
    if (!sessoes.length) { Toast.warning('Nenhuma sessão para exportar.'); return; }
    const concursos = await Service.listarConcursos();
    const materias = await Service.listarMaterias();
    const conteudos = await Service.listarConteudos();
    const cById = {}; concursos.forEach(c => cById[c.id] = c);
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const coById = {}; conteudos.forEach(c => coById[c.id] = c);

    const headers = ['data', 'hora_inicio', 'hora_fim', 'tempo_minutos', 'concurso', 'materia', 'conteudo', 'tipo_estudo', 'tecnica', 'concentracao', 'energia', 'compreensao', 'humor_antes', 'humor_depois'];
    const lines = [headers.join(';')];
    sessoes.forEach(s => {
      const row = [
        (s.data_inicio || '').split('T')[0],
        s.data_inicio ? new Date(s.data_inicio).toTimeString().slice(0, 5) : '',
        s.data_fim ? new Date(s.data_fim).toTimeString().slice(0, 5) : '',
        s.tempo_minutos || 0,
        cById[s.concurso_id]?.nome || '',
        mById[s.materia_id]?.nome || '',
        coById[s.conteudo_id]?.nome || '',
        s.tipo_estudo || '',
        s.tecnica || '',
        s.nivel_concentracao || '',
        s.nivel_energia || '',
        s.nivel_compreensao || '',
        s.humor_antes || '',
        s.humor_depois || ''
      ];
      lines.push(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    });
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessoes_${Utils.todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('CSV exportado.');
  },

  /* ---------- XLSX ---------- */
  async exportXlsxSessoes() {
    if (typeof XLSX === 'undefined') { Toast.error('Biblioteca XLSX não carregou.'); return; }
    const sessoes = await Service.listarSessoes();
    if (!sessoes.length) { Toast.warning('Nenhuma sessão para exportar.'); return; }
    const concursos = await Service.listarConcursos();
    const materias = await Service.listarMaterias();
    const conteudos = await Service.listarConteudos();
    const cById = {}; concursos.forEach(c => cById[c.id] = c);
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const coById = {}; conteudos.forEach(c => coById[c.id] = c);

    const rows = sessoes.map(s => ({
      Data: (s.data_inicio || '').split('T')[0],
      'Hora início': s.data_inicio ? new Date(s.data_inicio).toTimeString().slice(0, 5) : '',
      'Hora fim': s.data_fim ? new Date(s.data_fim).toTimeString().slice(0, 5) : '',
      'Tempo (min)': s.tempo_minutos || 0,
      Concurso: cById[s.concurso_id]?.nome || '',
      Matéria: mById[s.materia_id]?.nome || '',
      Conteúdo: coById[s.conteudo_id]?.nome || '',
      'Tipo estudo': s.tipo_estudo || '',
      Técnica: s.tecnica || '',
      Concentração: s.nivel_concentracao || '',
      Energia: s.nivel_energia || '',
      Compreensão: s.nivel_compreensao || '',
      'Humor antes': s.humor_antes || '',
      'Humor depois': s.humor_depois || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sessões');
    XLSX.writeFile(wb, `sessoes_${Utils.todayISO()}.xlsx`);
    Toast.success('XLSX exportado.');
  },

  async exportXlsxAll() {
    if (typeof XLSX === 'undefined') { Toast.error('Biblioteca XLSX não carregou.'); return; }
    const data = await DB.exportAll();
    const wb = XLSX.utils.book_new();

    // Tabela de concursos
    if (data.concursos?.length) {
      const ws = XLSX.utils.json_to_sheet(data.concursos.map(c => ({
        Nome: c.nome, Órgão: c.orgao, Banca: c.banca, 'Data prova': c.data_prova, Status: c.status, 'Link edital': c.link_edital
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Concursos');
    }
    // Tabela de matérias
    if (data.materias?.length) {
      const concursos = data.concursos || [];
      const cById = {}; concursos.forEach(c => cById[c.id] = c);
      const ws = XLSX.utils.json_to_sheet(data.materias.map(m => ({
        Concurso: cById[m.concurso_id]?.nome || '',
        Matéria: m.nome,
        Peso: m.peso,
        Prioridade: m.prioridade,
        'Carga horária (h)': m.carga_horaria_planejada
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Matérias');
    }
    // Tabela de conteúdos
    if (data.conteudos?.length) {
      const materias = data.materias || [];
      const mById = {}; materias.forEach(m => mById[m.id] = m);
      const ws = XLSX.utils.json_to_sheet(data.conteudos.map(c => ({
        Matéria: mById[c.materia_id]?.nome || '',
        Conteúdo: c.nome,
        Status: c.status,
        Dificuldade: c.dificuldade
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Conteúdos');
    }
    // Tabela de sessões
    if (data.sessoes?.length) {
      const concursos = data.concursos || [];
      const materias = data.materias || [];
      const conteudos = data.conteudos || [];
      const cById = {}; concursos.forEach(c => cById[c.id] = c);
      const mById = {}; materias.forEach(m => mById[m.id] = m);
      const coById = {}; conteudos.forEach(c => coById[c.id] = c);
      const ws = XLSX.utils.json_to_sheet(data.sessoes.map(s => ({
        Data: (s.data_inicio || '').split('T')[0],
        'Hora início': s.data_inicio ? new Date(s.data_inicio).toTimeString().slice(0, 5) : '',
        'Hora fim': s.data_fim ? new Date(s.data_fim).toTimeString().slice(0, 5) : '',
        'Tempo (min)': s.tempo_minutos || 0,
        Concurso: cById[s.concurso_id]?.nome || '',
        Matéria: mById[s.materia_id]?.nome || '',
        Conteúdo: coById[s.conteudo_id]?.nome || '',
        'Tipo estudo': s.tipo_estudo || '',
        Técnica: s.tecnica || '',
        Concentração: s.nivel_concentracao || '',
        Energia: s.nivel_energia || '',
        Compreensão: s.nivel_compreensao || '',
        'Humor antes': s.humor_antes || '',
        'Humor depois': s.humor_depois || ''
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Sessões');
    }
    // Tabela de revisões
    if (data.revisoes?.length) {
      const conteudos = data.conteudos || [];
      const coById = {}; conteudos.forEach(c => coById[c.id] = c);
      const ws = XLSX.utils.json_to_sheet(data.revisoes.map(r => ({
        Conteúdo: coById[r.conteudo_id]?.nome || '',
        Descrição: r.descricao || '',
        'Data programada': (r.data_programada || '').split('T')[0],
        Status: r.status || '',
        'Concluída em': r.concluida_em ? (r.concluida_em.split('T')[0]) : ''
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Revisões');
    }

    XLSX.writeFile(wb, `aprovado_completo_${Utils.todayISO()}.xlsx`);
    Toast.success('XLSX completo exportado.');
  },

  /* ---------- PDF ---------- */
  async exportPdf() {
    if (!window.jspdf) { Toast.error('Biblioteca jsPDF não carregou.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Aprovado — Relatório de Estudos', 40, 45);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em ${Utils.formatDateTime(new Date().toISOString())}`, 40, 65);

    let y = 110;

    // Estatísticas gerais
    const sessoes = await Service.listarSessoes();
    const concursos = await Service.listarConcursos();
    const materias = await Service.listarMaterias();
    const conteudos = await Service.listarConteudos();
    const revisoes = await Service.listarRevisoes();
    const totalMinutos = Utils.sum(sessoes.map(s => s.tempo_minutos || 0));
    const concluidos = conteudos.filter(c => c.status === 'concluido').length;

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Geral', 40, y);
    y += 10;

    doc.autoTable({
      startY: y,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total de horas estudadas', Utils.formatHours(totalMinutos)],
        ['Número de sessões', String(sessoes.length)],
        ['Concursos cadastrados', String(concursos.length)],
        ['Matérias cadastradas', String(materias.length)],
        ['Conteúdos concluídos', `${concluidos} / ${conteudos.length}`],
        ['Revisões pendentes', String(revisoes.filter(r => r.status === 'pendente').length)],
        ['Sequência atual (dias)', String(Utils.calculateStreak(sessoes.map(s => s.data_inicio).filter(Boolean)))]
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 10 }
    });
    y = doc.lastAutoTable.finalY + 30;

    // Progresso por concurso
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Progresso por Concurso', 40, y);
    y += 10;
    const concursosProgresso = concursos.map(c => {
      const mats = materias.filter(m => m.concurso_id === c.id);
      const matIds = new Set(mats.map(m => m.id));
      const conts = conteudos.filter(co => matIds.has(co.materia_id));
      const conc = conts.filter(co => co.status === 'concluido').length;
      const pct = conts.length ? Math.round((conc / conts.length) * 100) : 0;
      return [c.nome, c.orgao || '—', c.banca || '—', c.data_prova ? Utils.formatDate(c.data_prova) : '—', `${pct}%`];
    });
    doc.autoTable({
      startY: y,
      head: [['Concurso', 'Órgão', 'Banca', 'Data prova', '% Concluído']],
      body: concursosProgresso,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 9 }
    });
    y = doc.lastAutoTable.finalY + 30;

    // Horas por matéria
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Horas por Matéria', 40, y);
    y += 10;
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const porMateria = {};
    sessoes.forEach(s => {
      const nome = mById[s.materia_id]?.nome || '—';
      porMateria[nome] = (porMateria[nome] || 0) + (s.tempo_minutos || 0);
    });
    const materiasRows = Object.entries(porMateria)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, min]) => [nome, Utils.formatHours(min)]);
    doc.autoTable({
      startY: y,
      head: [['Matéria', 'Horas']],
      body: materiasRows.length ? materiasRows : [['—', '—']],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 10 }
    });
    y = doc.lastAutoTable.finalY + 30;

    // Revisões pendentes
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Revisões Pendentes', 40, y);
    y += 10;
    const coById = {}; conteudos.forEach(c => coById[c.id] = c);
    const revisoesRows = revisoes
      .filter(r => r.status === 'pendente')
      .sort((a, b) => (a.data_programada || '').localeCompare(b.data_programada || ''))
      .slice(0, 20)
      .map(r => [
        coById[r.conteudo_id]?.nome || '—',
        r.descricao || '—',
        Utils.formatDate(r.data_programada)
      ]);
    doc.autoTable({
      startY: y,
      head: [['Conteúdo', 'Descrição', 'Data programada']],
      body: revisoesRows.length ? revisoesRows : [['—', 'Nenhuma revisão pendente', '—']],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 9 }
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Aprovado — página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'center' }
      );
    }

    doc.save(`relatorio_aprovado_${Utils.todayISO()}.pdf`);
    Toast.success('PDF gerado.');
  },

  /* ---------- Restore / Clear ---------- */
  async reseed() {
    const ok = await Confirm.ask(
      'Restaurar dados de exemplo? Os dados atuais serão substituídos.',
      'Restaurar exemplo'
    );
    if (!ok) return;
    await DB.clearAll();
    await Seed.aplicar();
    Toast.success('Dados de exemplo restaurados.');
    await this.atualizarStats();
    await App.atualizarFiltroGlobal();
    App.navigate('dashboard');
  },

  async limparTudo() {
    const ok = await Confirm.ask(
      'ATENÇÃO: apagar TODOS os dados? Esta ação NÃO pode ser desfeita. Recomendamos exportar um backup JSON antes.',
      'Apagar todos os dados'
    );
    if (!ok) return;
    await DB.clearAll();
    await DB.put('meta', { key: 'initialized', value: true, at: new Date().toISOString() });
    Toast.success('Todos os dados foram apagados.');
    await this.atualizarStats();
    await App.atualizarFiltroGlobal();
    App.navigate('dashboard');
  }
};

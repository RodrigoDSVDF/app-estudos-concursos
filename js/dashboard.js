/* ================================================================
 * dashboard.js — Dashboard analítico com gráficos Chart.js
 * ================================================================ */

const DashboardView = {
  _charts: {},

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Visão geral do seu desempenho e evolução nos estudos.</p>
        </div>
      </div>

      <div class="stat-grid" id="statGrid">
        <div class="loading">Carregando...</div>
      </div>

      <div class="grid grid-2 mb-24">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Horas estudadas (últimos 14 dias)</h3></div>
          <canvas id="chartHorasDia"></canvas>
        </div>
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Horas por matéria</h3></div>
          <canvas id="chartHorasMateria"></canvas>
        </div>
      </div>

      <div class="grid grid-2 mb-24">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Horas por tipo de estudo</h3></div>
          <canvas id="chartTipoEstudo"></canvas>
        </div>
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Produtividade por horário</h3></div>
          <canvas id="chartHorario"></canvas>
        </div>
      </div>

      <div class="grid grid-2 mb-24">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Evolução semanal</h3></div>
          <canvas id="chartSemanal"></canvas>
        </div>
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Concentração × Compreensão</h3></div>
          <canvas id="chartCorrelacao"></canvas>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Progresso por concurso</h3></div>
          <canvas id="chartProgressoConcursos"></canvas>
        </div>
        <div class="chart-container">
          <div class="card-header"><h3 class="card-title">Média de concentração por matéria</h3></div>
          <canvas id="chartConcentracaoMateria"></canvas>
        </div>
      </div>
    `;

    await this.atualizar();
  },

  /** Atualiza todas as estatísticas e gráficos */
  async atualizar() {
    const sessoes = await Service.listarSessoes();
    const concursos = await Service.listarConcursos();
    const materias = await Service.listarMaterias();
    const conteudos = await Service.listarConteudos();

    // Aplica filtro global de concurso
    const filtroId = App.filtroConcurso;
    const sessoesFiltradas = filtroId ? sessoes.filter(s => s.concurso_id === filtroId) : sessoes;

    await this.renderStats(sessoesFiltradas, concursos, materias, conteudos);
    await this.renderChartHorasDia(sessoesFiltradas);
    await this.renderChartHorasMateria(sessoesFiltradas, materias);
    await this.renderChartTipoEstudo(sessoesFiltradas);
    await this.renderChartHorario(sessoesFiltradas);
    await this.renderChartSemanal(sessoesFiltradas);
    await this.renderChartCorrelacao(sessoesFiltradas);
    await this.renderChartProgressoConcursos(concursos, materias, conteudos);
    await this.renderChartConcentracaoMateria(sessoesFiltradas, materias);
  },

  async renderStats(sessoes, concursos, materias, conteudos) {
    const totalMinutos = Utils.sum(sessoes.map(s => s.tempo_minutos || 0));
    const totalHoras = totalMinutos / 60;
    const datas = sessoes.map(s => s.data_inicio).filter(Boolean);
    const streak = Utils.calculateStreak(datas);
    const concluidos = conteudos.filter(c => c.status === 'concluido').length;
    const pendentes = conteudos.filter(c => c.status !== 'concluido').length;
    const taxa = conteudos.length ? (concluidos / conteudos.length * 100) : 0;
    const mediaConcentracao = Utils.avg(sessoes.map(s => s.nivel_concentracao || 0).filter(Boolean));
    const mediaCompreensao = Utils.avg(sessoes.map(s => s.nivel_compreensao || 0).filter(Boolean));

    $('#statGrid').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon indigo">⏱️</div>
        <div class="stat-content">
          <div class="stat-label">Total estudado</div>
          <div class="stat-value">${totalHoras.toFixed(1).replace('.', ',')}h</div>
          <div class="stat-hint">${Utils.formatDuration(totalMinutos)} em ${sessoes.length} sessões</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">🔥</div>
        <div class="stat-content">
          <div class="stat-label">Sequência de dias</div>
          <div class="stat-value">${streak} ${streak === 1 ? 'dia' : 'dias'}</div>
          <div class="stat-hint">Continue estudando para manter o ritmo</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon sky">📑</div>
        <div class="stat-content">
          <div class="stat-label">Conteúdos concluídos</div>
          <div class="stat-value">${concluidos}/${conteudos.length}</div>
          <div class="stat-hint">${pendentes} pendentes • ${fmtPercent(taxa)} de conclusão</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber">🎯</div>
        <div class="stat-content">
          <div class="stat-label">Concentração média</div>
          <div class="stat-value">${mediaConcentracao.toFixed(1).replace('.', ',')}/5</div>
          <div class="stat-hint">Compreensão: ${mediaCompreensao.toFixed(1).replace('.', ',')}/5</div>
        </div>
      </div>
    `;
  },

  /** Destrói chart anterior se existir */
  _destroy(key) {
    if (this._charts[key]) {
      this._charts[key].destroy();
      delete this._charts[key];
    }
  },

  _themeColors() {
    const css = getComputedStyle(document.documentElement);
    return {
      text: css.getPropertyValue('--text-secondary').trim(),
      grid: css.getPropertyValue('--border-color').trim(),
      accent: css.getPropertyValue('--accent').trim(),
      success: css.getPropertyValue('--success').trim(),
      warning: css.getPropertyValue('--warning').trim(),
      danger: css.getPropertyValue('--danger').trim(),
      info: css.getPropertyValue('--info').trim()
    };
  },

  async renderChartHorasDia(sessoes) {
    this._destroy('horasDia');
    const dias = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i);
      dias.push({
        key: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        minutos: 0
      });
    }
    const diasMap = new Map(dias.map(d => [d.key, d]));
    sessoes.forEach(s => {
      const key = (s.data_inicio || '').split('T')[0];
      if (diasMap.has(key)) {
        diasMap.get(key).minutos += s.tempo_minutos || 0;
      }
    });

    const colors = this._themeColors();
    const ctx = $('#chartHorasDia');
    this._charts.horasDia = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dias.map(d => d.label),
        datasets: [{
          label: 'Horas estudadas',
          data: dias.map(d => +(d.minutos / 60).toFixed(2)),
          backgroundColor: colors.accent,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: colors.text, callback: v => v + 'h' },
            grid: { color: colors.grid }
          },
          x: { ticks: { color: colors.text }, grid: { display: false } }
        }
      }
    });
  },

  async renderChartHorasMateria(sessoes, materias) {
    this._destroy('horasMateria');
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const porMateria = {};
    sessoes.forEach(s => {
      const nome = mById[s.materia_id]?.nome || '—';
      porMateria[nome] = (porMateria[nome] || 0) + (s.tempo_minutos || 0);
    });
    const labels = Object.keys(porMateria);
    const values = Object.values(porMateria).map(m => +(m / 60).toFixed(2));
    const colors = this._themeColors();
    const palette = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16'];

    const ctx = $('#chartHorasMateria');
    this._charts.horasMateria = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: colors.grid
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: colors.text, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label}: ${Utils.formatHours(ctx.parsed * 60)}`
            }
          }
        }
      }
    });
  },

  async renderChartTipoEstudo(sessoes) {
    this._destroy('tipoEstudo');
    const labels = { teoria: 'Teoria', exercicios: 'Exercícios', revisao: 'Revisão', simulado: 'Simulado' };
    const porTipo = { teoria: 0, exercicios: 0, revisao: 0, simulado: 0 };
    sessoes.forEach(s => {
      if (porTipo[s.tipo_estudo] !== undefined) {
        porTipo[s.tipo_estudo] += s.tempo_minutos || 0;
      }
    });
    const colors = this._themeColors();
    const ctx = $('#chartTipoEstudo');
    this._charts.tipoEstudo = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(labels).map(k => labels[k]),
        datasets: [{
          data: Object.values(porTipo).map(m => +(m / 60).toFixed(2)),
          backgroundColor: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899'],
          borderWidth: 2,
          borderColor: colors.grid
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: colors.text, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${Utils.formatHours(ctx.parsed * 60)}` } }
        }
      }
    });
  },

  async renderChartHorario(sessoes) {
    this._destroy('horario');
    // Calcula média de concentração por faixa horária
    const faixas = {};
    sessoes.forEach(s => {
      if (!s.data_inicio || !s.nivel_concentracao) return;
      const h = Utils.hourOf(s.data_inicio);
      const faixa = `${String(h).padStart(2, '0')}h-${String((h + 1) % 24).padStart(2, '0')}h`;
      if (!faixas[faixa]) faixas[faixa] = { soma: 0, count: 0, minutos: 0 };
      faixas[faixa].soma += s.nivel_concentracao;
      faixas[faixa].count++;
      faixas[faixa].minutos += s.tempo_minutos || 0;
    });
    // Cria faixas de 0 a 23
    const labels = [];
    const mediaConc = [];
    const horasEstudadas = [];
    for (let h = 0; h < 24; h++) {
      const faixa = `${String(h).padStart(2, '0')}h-${String((h + 1) % 24).padStart(2, '0')}h`;
      const dados = faixas[faixa];
      if (dados && dados.count > 0) {
        labels.push(faixa);
        mediaConc.push(+(dados.soma / dados.count).toFixed(2));
        horasEstudadas.push(+(dados.minutos / 60).toFixed(2));
      }
    }
    const colors = this._themeColors();
    const ctx = $('#chartHorario');
    this._charts.horario = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Horas estudadas',
            data: horasEstudadas,
            backgroundColor: colors.accent + '60',
            yAxisID: 'y',
            borderRadius: 4
          },
          {
            type: 'line',
            label: 'Concentração média',
            data: mediaConc,
            borderColor: colors.warning,
            backgroundColor: colors.warning,
            yAxisID: 'y1',
            tension: 0.3,
            pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: colors.text } } },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            title: { display: true, text: 'Horas', color: colors.text },
            ticks: { color: colors.text, callback: v => v + 'h' },
            grid: { color: colors.grid }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            max: 5,
            title: { display: true, text: 'Concentração (1-5)', color: colors.text },
            ticks: { color: colors.text },
            grid: { display: false }
          },
          x: { ticks: { color: colors.text, maxRotation: 45, font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  },

  async renderChartSemanal(sessoes) {
    this._destroy('semanal');
    // Últimas 8 semanas
    const semanas = [];
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // domingo
    inicioSemana.setHours(0, 0, 0, 0);

    for (let i = 7; i >= 0; i--) {
      const fim = new Date(inicioSemana);
      fim.setDate(fim.getDate() - (i - 1) * 7);
      const inicio = new Date(fim);
      inicio.setDate(inicio.getDate() - 7);
      semanas.push({
        inicio,
        fim,
        label: `${inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`,
        minutos: 0
      });
    }
    sessoes.forEach(s => {
      if (!s.data_inicio) return;
      const d = new Date(s.data_inicio);
      for (const sem of semanas) {
        if (d >= sem.inicio && d < sem.fim) {
          sem.minutos += s.tempo_minutos || 0;
          break;
        }
      }
    });
    const colors = this._themeColors();
    const ctx = $('#chartSemanal');
    this._charts.semanal = new Chart(ctx, {
      type: 'line',
      data: {
        labels: semanas.map(s => s.label),
        datasets: [{
          label: 'Horas por semana',
          data: semanas.map(s => +(s.minutos / 60).toFixed(2)),
          borderColor: colors.accent,
          backgroundColor: colors.accent + '20',
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: colors.accent
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: colors.text } } },
        scales: {
          y: { beginAtZero: true, ticks: { color: colors.text, callback: v => v + 'h' }, grid: { color: colors.grid } },
          x: { ticks: { color: colors.text }, grid: { display: false } }
        }
      }
    });
  },

  async renderChartCorrelacao(sessoes) {
    this._destroy('correlacao');
    const colors = this._themeColors();
    const dados = sessoes.filter(s => s.nivel_concentracao && s.nivel_compreensao);
    const ctx = $('#chartCorrelacao');
    this._charts.correlacao = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Sessões',
          data: dados.map(s => ({ x: s.nivel_concentracao, y: s.nivel_compreensao })),
          backgroundColor: colors.accent + '80',
          borderColor: colors.accent,
          pointRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: colors.text } },
          tooltip: { callbacks: { label: ctx => `Concentração: ${ctx.parsed.x} • Compreensão: ${ctx.parsed.y}` } }
        },
        scales: {
          x: {
            title: { display: true, text: 'Concentração (1-5)', color: colors.text },
            min: 0, max: 6,
            ticks: { color: colors.text },
            grid: { color: colors.grid }
          },
          y: {
            title: { display: true, text: 'Compreensão (1-5)', color: colors.text },
            min: 0, max: 6,
            ticks: { color: colors.text },
            grid: { color: colors.grid }
          }
        }
      }
    });
  },

  async renderChartProgressoConcursos(concursos, materias, conteudos) {
    this._destroy('progressoConcursos');
    const dados = concursos.map(c => {
      const mats = materias.filter(m => m.concurso_id === c.id);
      const matIds = new Set(mats.map(m => m.id));
      const conts = conteudos.filter(co => matIds.has(co.materia_id));
      const concluidos = conts.filter(co => co.status === 'concluido').length;
      const pct = conts.length ? Math.round((concluidos / conts.length) * 100) : 0;
      return { nome: c.nome.length > 25 ? c.nome.slice(0, 25) + '...' : c.nome, pct };
    });
    const colors = this._themeColors();
    const ctx = $('#chartProgressoConcursos');
    this._charts.progressoConcursos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dados.map(d => d.nome),
        datasets: [{
          label: '% Concluído',
          data: dados.map(d => d.pct),
          backgroundColor: dados.map(d => d.pct === 100 ? colors.success : colors.accent),
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ctx.parsed.x + '%' } }
        },
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { color: colors.text, callback: v => v + '%' }, grid: { color: colors.grid } },
          y: { ticks: { color: colors.text }, grid: { display: false } }
        }
      }
    });
  },

  async renderChartConcentracaoMateria(sessoes, materias) {
    this._destroy('concentracaoMateria');
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const porMateria = {};
    sessoes.forEach(s => {
      if (!s.nivel_concentracao) return;
      const nome = mById[s.materia_id]?.nome || '—';
      if (!porMateria[nome]) porMateria[nome] = { soma: 0, count: 0 };
      porMateria[nome].soma += s.nivel_concentracao;
      porMateria[nome].count++;
    });
    const labels = Object.keys(porMateria);
    const values = Object.values(porMateria).map(d => +(d.soma / d.count).toFixed(2));
    const colors = this._themeColors();
    const ctx = $('#chartConcentracaoMateria');
    this._charts.concentracaoMateria = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Concentração média',
          data: values,
          backgroundColor: colors.info,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, max: 5, ticks: { color: colors.text }, grid: { color: colors.grid } },
          x: { ticks: { color: colors.text }, grid: { display: false } }
        }
      }
    });
  },

  /** Recria todos os gráficos (usado ao trocar tema) */
  async refresh() {
    if (!$('#chartHorasDia')) return;
    await this.atualizar();
  }
};

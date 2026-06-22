/* ================================================================
 * insights.js — Insights inteligentes (análise automática de padrões)
 * Gera recomendações baseadas nos dados registrados
 * ================================================================ */

const InsightsView = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Insights Inteligentes</h2>
          <p>Análise automática dos seus dados com recomendações personalizadas.</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-secondary" id="btnAtualizar">🔄 Atualizar</button>
        </div>
      </div>
      <div id="insightsList" class="list-stack">
        <div class="loading">Analisando seus dados...</div>
      </div>
    `;
    $('#btnAtualizar').addEventListener('click', () => this.atualizar());
    await this.atualizar();
  },

  async atualizar() {
    const insights = await this.gerarInsights();
    const listEl = $('#insightsList');
    if (!insights.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <h3>Sem insights ainda</h3>
          <p>Registre algumas sessões de estudo para receber insights personalizados.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    insights.forEach(ins => {
      const item = el(`
        <div class="insight-item ${ins.tipo}">
          <span class="insight-icon">${ins.icone}</span>
          <div class="insight-content">
            <div class="insight-title">${Utils.escapeHTML(ins.titulo)}</div>
            <div class="insight-text">${Utils.escapeHTML(ins.texto)}</div>
          </div>
        </div>
      `);
      listEl.appendChild(item);
    });
  },

  async gerarInsights() {
    const insights = [];
    const sessoes = await Service.listarSessoes();
    const concursos = await Service.listarConcursos();
    const materias = await Service.listarMaterias();
    const conteudos = await Service.listarConteudos();
    const revisoes = await Service.listarRevisoes();

    if (!sessoes.length) return insights;

    // ---------- 1. Horário de maior produtividade ----------
    const faixaHoraria = {};
    sessoes.forEach(s => {
      if (!s.data_inicio) return;
      const h = Utils.hourOf(s.data_inicio);
      const faixa = `${String(h).padStart(2, '0')}h-${String((h + 1) % 24).padStart(2, '0')}h`;
      if (!faixaHoraria[faixa]) faixaHoraria[faixa] = { soma: 0, count: 0, minutos: 0 };
      faixaHoraria[faixa].soma += s.nivel_concentracao || 0;
      faixaHoraria[faixa].count++;
      faixaHoraria[faixa].minutos += s.tempo_minutos || 0;
    });
    let melhorFaixa = null;
    let melhorMedia = 0;
    for (const [faixa, dados] of Object.entries(faixaHoraria)) {
      if (dados.count >= 2) { // Mínimo de 2 sessões para validar
        const media = dados.soma / dados.count;
        if (media > melhorMedia) {
          melhorMedia = media;
          melhorFaixa = faixa;
        }
      }
    }
    if (melhorFaixa) {
      insights.push({
        tipo: 'success',
        icone: '⏰',
        titulo: 'Melhor horário de produtividade',
        texto: `Seu melhor desempenho ocorre no horário ${melhorFaixa}, com concentração média de ${melhorMedia.toFixed(1).replace('.', ',')}/5. Considere agendar conteúdos mais desafiadores neste período.`
      });
    }

    // ---------- 2. Matéria com maior concentração ----------
    const mById = {}; materias.forEach(m => mById[m.id] = m);
    const concMateria = {};
    sessoes.forEach(s => {
      if (!s.nivel_concentracao) return;
      const nome = mById[s.materia_id]?.nome;
      if (!nome) return;
      if (!concMateria[nome]) concMateria[nome] = { soma: 0, count: 0 };
      concMateria[nome].soma += s.nivel_concentracao;
      concMateria[nome].count++;
    });
    let melhorMateria = null;
    let melhorConc = 0;
    for (const [nome, dados] of Object.entries(concMateria)) {
      if (dados.count >= 2) {
        const media = dados.soma / dados.count;
        if (media > melhorConc) {
          melhorConc = media;
          melhorMateria = nome;
        }
      }
    }
    if (melhorMateria) {
      insights.push({
        tipo: 'info',
        icone: '🎯',
        titulo: 'Matéria com maior foco',
        texto: `Você apresenta maior concentração ao estudar ${melhorMateria} (${melhorConc.toFixed(1).replace('.', ',')}/5). Use essa matéria como âncora para dias de baixa motivação.`
      });
    }

    // ---------- 3. Queda de rendimento após X minutos ----------
    const sessoesLongas = sessoes.filter(s => s.tempo_minutos && s.tempo_minutos >= 90 && s.nivel_concentracao);
    if (sessoesLongas.length >= 3) {
      const longasBaixaConc = sessoesLongas.filter(s => s.nivel_concentracao <= 3);
      if (longasBaixaConc.length / sessoesLongas.length > 0.5) {
        insights.push({
          tipo: 'warning',
          icone: '📉',
          titulo: 'Possível fadiga em sessões longas',
          texto: `Seu rendimento parece cair após 90 minutos contínuos de estudo (${longasBaixaConc.length} de ${sessoesLongas.length} sessões longas tiveram concentração ≤ 3). Considere usar a técnica Pomodoro com pausas regulares.`
        });
      }
    }

    // ---------- 4. Revisões atrasadas ----------
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const atrasadas = revisoes.filter(r => r.status === 'pendente' && new Date(r.data_programada) < hoje);
    if (atrasadas.length) {
      const materiasAtrasadas = new Set();
      atrasadas.forEach(r => {
        const c = conteudos.find(co => co.id === r.conteudo_id);
        const m = c ? materias.find(mat => mat.id === c.materia_id) : null;
        if (m) materiasAtrasadas.add(m.nome);
      });
      insights.push({
        tipo: 'danger',
        icone: '⚠️',
        titulo: 'Revisões atrasadas',
        texto: `Você possui ${atrasadas.length} revisão(ões) atrasada(s)${materiasAtrasadas.size ? ', principalmente em: ' + [...materiasAtrasadas].join(', ') : ''}. Atrasar revisões compromete a fixação de longo prazo. Reprograme-as para os próximos dias.`
      });
    }

    // ---------- 5. Conteúdos com baixa compreensão ----------
    const baixaCompreensao = sessoes.filter(s => s.nivel_compreensao && s.nivel_compreensao <= 2);
    if (baixaCompreensao.length) {
      const conteudosBaixa = new Set();
      baixaCompreensao.forEach(s => {
        const c = conteudos.find(co => co.id === s.conteudo_id);
        if (c) conteudosBaixa.add(c.nome);
      });
      insights.push({
        tipo: 'warning',
        icone: '📖',
        titulo: 'Conteúdos com baixa compreensão',
        texto: `Foram registradas ${baixaCompreensao.length} sessão(ões) com compreensão ≤ 2${conteudosBaixa.size ? ' em: ' + [...conteudosBaixa].slice(0, 3).join(', ') : ''}. Estes conteúdos exigem mais exercícios e/ou nova abordagem de estudo.`
      });
    }

    // ---------- 6. Sequência de dias (streak) ----------
    const streak = Utils.calculateStreak(sessoes.map(s => s.data_inicio).filter(Boolean));
    if (streak >= 3) {
      insights.push({
        tipo: 'success',
        icone: '🔥',
        titulo: 'Sequência ativa!',
        texto: `Você está estudando há ${streak} dias consecutivos. Manter consistência é o maior fator de sucesso em concursos. Continue!`
      });
    } else if (streak === 0 && sessoes.length > 0) {
      insights.push({
        tipo: 'warning',
        icone: '💤',
        titulo: 'Pausa detectada',
        texto: `Você não estudou hoje nem ontem. Que tal retomar com uma sessão curta de 25 minutos para destravar?`
      });
    }

    // ---------- 7. Distribuição por tipo de estudo ----------
    const porTipo = { teoria: 0, exercicios: 0, revisao: 0, simulado: 0 };
    sessoes.forEach(s => {
      if (porTipo[s.tipo_estudo] !== undefined) {
        porTipo[s.tipo_estudo] += s.tempo_minutos || 0;
      }
    });
    const total = Utils.sum(Object.values(porTipo));
    if (total > 0) {
      const pctExercicios = (porTipo.exercicios / total) * 100;
      const pctSimulado = (porTipo.simulado / total) * 100;
      if (pctExercicios + pctSimulado < 25) {
        insights.push({
          tipo: 'info',
          icone: '✏️',
          titulo: 'Pouca prática ativa',
          texto: `Apenas ${fmtPercent(pctExercicios + pctSimulado)} do seu tempo é dedicado a exercícios e simulados. Em concursos, a prática ativa é fundamental para fixação. Tente elevar para pelo menos 40%.`
        });
      }
      const pctRevisao = (porTipo.revisao / total) * 100;
      if (pctRevisao < 10) {
        insights.push({
          tipo: 'warning',
          icone: '🔁',
          titulo: 'Revisões subutilizadas',
          texto: `Apenas ${fmtPercent(pctRevisao)} do tempo é de revisão. Reforce revisões semanais para combater o esquecimento (curva de Ebbinghaus).`
        });
      }
    }

    // ---------- 8. Correlação concentração × compreensão ----------
    const x = sessoes.filter(s => s.nivel_concentracao && s.nivel_compreensao).map(s => s.nivel_concentracao);
    const y = sessoes.filter(s => s.nivel_concentracao && s.nivel_compreensao).map(s => s.nivel_compreensao);
    if (x.length >= 5) {
      const corr = Utils.pearsonCorrelation(x, y);
      if (corr >= 0.6) {
        insights.push({
          tipo: 'success',
          icone: '🧠',
          titulo: 'Correlação positiva forte',
          texto: `Há forte correlação (r=${corr.toFixed(2)}) entre concentração e compreensão. Isso confirma que melhorar o ambiente de estudo terá impacto direto no aprendizado.`
        });
      } else if (corr >= 0.3 && corr < 0.6) {
        insights.push({
          tipo: 'info',
          icone: '🧠',
          titulo: 'Correlação moderada',
          texto: `A correlação entre concentração e compreensão é moderada (r=${corr.toFixed(2)}). Outros fatores (qualidade do material, pré-conhecimento) também influenciam.`
        });
      }
    }

    // ---------- 9. Humor antes vs depois ----------
    const sessoesHumor = sessoes.filter(s => s.humor_antes && s.humor_depois);
    if (sessoesHumor.length >= 3) {
      const mediaAntes = Utils.avg(sessoesHumor.map(s => s.humor_antes));
      const mediaDepois = Utils.avg(sessoesHumor.map(s => s.humor_depois));
      const diff = mediaDepois - mediaAntes;
      if (diff > 0.5) {
        insights.push({
          tipo: 'success',
          icone: '😊',
          titulo: 'Estudo melhora seu humor',
          texto: `Em média, seu humor melhora de ${mediaAntes.toFixed(1).replace('.', ',')}/5 para ${mediaDepois.toFixed(1).replace('.', ',')}/5 após estudar. Use esse dado como motivação nos dias em que estiver relutante.`
        });
      } else if (diff < -0.5) {
        insights.push({
          tipo: 'warning',
          icone: '😟',
          titulo: 'Estudo está cansativo',
          texto: `Seu humor cai de ${mediaAntes.toFixed(1).replace('.', ',')}/5 para ${mediaDepois.toFixed(1).replace('.', ',')}/5 após sessões. Pode ser sinal de sobrecarga — revise sua carga diária e qualidade do sono.`
        });
      }
    }

    // ---------- 10. Concursos próximos da prova ----------
    for (const c of concursos) {
      if (!c.data_prova || c.status !== 'em_andamento') continue;
      const diasRestantes = Math.ceil((new Date(c.data_prova).getTime() - Date.now()) / 86400000);
      if (diasRestantes > 0 && diasRestantes <= 30) {
        const mats = materias.filter(m => m.concurso_id === c.id);
        const matIds = new Set(mats.map(m => m.id));
        const conts = conteudos.filter(co => matIds.has(co.materia_id));
        const concluidos = conts.filter(co => co.status === 'concluido').length;
        const pct = conts.length ? Math.round((concluidos / conts.length) * 100) : 0;
        if (pct < 60) {
          insights.push({
            tipo: 'danger',
            icone: '⏳',
            titulo: `Prova de "${c.nome}" se aproxima`,
            texto: `Faltam ${diasRestantes} dias para a prova e você concluiu ${pct}% do conteúdo planejado. Considere priorizar os conteúdos de maior peso e revisar o que já estudou.`
          });
        }
      }
    }

    // ---------- 11. Tendência de horas (última vs penúltima semana) ----------
    const umaSemanaAtras = Date.now() - 7 * 86400000;
    const duasSemanasAtras = Date.now() - 14 * 86400000;
    const semanaAtual = Utils.sum(sessoes.filter(s => s.data_inicio && new Date(s.data_inicio).getTime() >= umaSemanaAtras).map(s => s.tempo_minutos || 0));
    const semanaAnterior = Utils.sum(sessoes.filter(s => {
      if (!s.data_inicio) return false;
      const t = new Date(s.data_inicio).getTime();
      return t >= duasSemanasAtras && t < umaSemanaAtras;
    }).map(s => s.tempo_minutos || 0));
    if (semanaAnterior > 0) {
      const variacao = ((semanaAtual - semanaAnterior) / semanaAnterior) * 100;
      if (variacao > 20) {
        insights.push({
          tipo: 'success',
          icone: '📈',
          titulo: 'Aumento de produtividade',
          texto: `Você estudou ${fmtPercent(Math.abs(variacao))} a mais nesta semana comparado à anterior (${Utils.formatDuration(semanaAtual)} vs ${Utils.formatDuration(semanaAnterior)}). Excelente progresso!`
        });
      } else if (variacao < -20) {
        insights.push({
          tipo: 'warning',
          icone: '📉',
          titulo: 'Queda de produtividade',
          texto: `Você estudou ${fmtPercent(Math.abs(variacao))} a menos nesta semana comparado à anterior (${Utils.formatDuration(semanaAtual)} vs ${Utils.formatDuration(semanaAnterior)}). Identifique o motivo e replaneje.`
        });
      }
    }

    // ---------- 12. Sessões sem conteúdo vinculado ----------
    const semConteudo = sessoes.filter(s => !s.conteudo_id).length;
    if (semConteudo / sessoes.length > 0.3) {
      insights.push({
        tipo: 'info',
        icone: '🔗',
        titulo: 'Sessões sem conteúdo vinculado',
        texto: `${semConteudo} de ${sessoes.length} sessões (${fmtPercent(semConteudo / sessoes.length * 100)}) não estão vinculadas a um conteúdo específico. Vincular conteúdo facilita a análise de progresso e a geração de revisões.`
      });
    }

    return insights;
  }
};

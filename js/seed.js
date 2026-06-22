/* ================================================================
 * seed.js — Dados de exemplo para popular o banco na primeira execução
 * Permite que o usuário teste o app imediatamente.
 * ================================================================ */

const Seed = {
  async aplicarSeNecessario() {
    const firstRun = await DB.isFirstRun();
    if (!firstRun) return false;
    await this.aplicar();
    return true;
  },

  async aplicar() {
    const now = new Date();
    const iso = (offsetDays = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      d.setHours(14, 0, 0, 0);
      return d.toISOString();
    };
    const offsetDias = (offset) => Utils.addDays(now.toISOString(), offset);

    // ---------- Concurso 1 ----------
    const c1 = {
      id: Utils.uuid(),
      nome: 'TJ-SP — Escrevente Técnico Judiciário',
      orgao: 'Tribunal de Justiça de São Paulo',
      banca: 'Vunesp',
      data_prova: Utils.addDays(now.toISOString(), 90).split('T')[0],
      link_edital: 'https://www.vunesp.com.br/',
      status: 'em_andamento',
      criado_em: now.toISOString(),
      atualizado_em: now.toISOString()
    };

    // ---------- Concurso 2 ----------
    const c2 = {
      id: Utils.uuid(),
      nome: 'Polícia Federal — Agente',
      orgao: 'Polícia Federal',
      banca: 'Cesgranrio',
      data_prova: Utils.addDays(now.toISOString(), 180).split('T')[0],
      link_edital: 'https://www.cesgranrio.org.br/',
      status: 'planejado',
      criado_em: now.toISOString(),
      atualizado_em: now.toISOString()
    };

    await DB.bulkPut('concursos', [c1, c2]);

    // ---------- Matérias (Concurso 1) ----------
    const m1 = { id: Utils.uuid(), concurso_id: c1.id, nome: 'Português', peso: 3, prioridade: 5, carga_horaria_planejada: 120, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m2 = { id: Utils.uuid(), concurso_id: c1.id, nome: 'Direito Constitucional', peso: 2, prioridade: 4, carga_horaria_planejada: 80, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m3 = { id: Utils.uuid(), concurso_id: c1.id, nome: 'Direito Administrativo', peso: 2, prioridade: 4, carga_horaria_planejada: 80, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m4 = { id: Utils.uuid(), concurso_id: c1.id, nome: 'Matemática', peso: 1, prioridade: 3, carga_horaria_planejada: 60, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m5 = { id: Utils.uuid(), concurso_id: c1.id, nome: 'Raciocínio Lógico', peso: 1, prioridade: 3, carga_horaria_planejada: 40, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    await DB.bulkPut('materias', [m1, m2, m3, m4, m5]);

    // ---------- Matérias (Concurso 2) ----------
    const m6 = { id: Utils.uuid(), concurso_id: c2.id, nome: 'Português', peso: 2, prioridade: 4, carga_horaria_planejada: 100, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m7 = { id: Utils.uuid(), concurso_id: c2.id, nome: 'Direito Constitucional', peso: 3, prioridade: 5, carga_horaria_planejada: 120, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m8 = { id: Utils.uuid(), concurso_id: c2.id, nome: 'Direito Administrativo', peso: 3, prioridade: 5, carga_horaria_planejada: 120, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m9 = { id: Utils.uuid(), concurso_id: c2.id, nome: 'Direito Penal', peso: 3, prioridade: 5, carga_horaria_planejada: 140, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    const m10 = { id: Utils.uuid(), concurso_id: c2.id, nome: 'Informática', peso: 1, prioridade: 3, carga_horaria_planejada: 50, criado_em: now.toISOString(), atualizado_em: now.toISOString() };
    await DB.bulkPut('materias', [m6, m7, m8, m9, m10]);

    // ---------- Conteúdos ----------
    const conteudos = [
      // Português (c1)
      { materia_id: m1.id, nome: 'Crase', status: 'concluido', dificuldade: 4 },
      { materia_id: m1.id, nome: 'Concordância Verbal', status: 'em_andamento', dificuldade: 3 },
      { materia_id: m1.id, nome: 'Regência Verbal e Nominal', status: 'em_andamento', dificuldade: 4 },
      { materia_id: m1.id, nome: 'Pontuação', status: 'nao_iniciado', dificuldade: 3 },
      // Direito Constitucional (c1)
      { materia_id: m2.id, nome: 'Controle de Constitucionalidade', status: 'concluido', dificuldade: 5 },
      { materia_id: m2.id, nome: 'Direitos Fundamentais', status: 'em_andamento', dificuldade: 3 },
      { materia_id: m2.id, nome: 'Organização do Estado', status: 'nao_iniciado', dificuldade: 3 },
      // Direito Administrativo (c1)
      { materia_id: m3.id, nome: 'Atos Administrativos', status: 'concluido', dificuldade: 4 },
      { materia_id: m3.id, nome: 'Licitações (Lei 14.133)', status: 'em_andamento', dificuldade: 5 },
      { materia_id: m3.id, nome: 'Servidores Públicos', status: 'nao_iniciado', dificuldade: 3 },
      // Matemática (c1)
      { materia_id: m4.id, nome: 'Equações do 2º Grau', status: 'concluido', dificuldade: 3 },
      { materia_id: m4.id, nome: 'Regra de Três', status: 'em_andamento', dificuldade: 2 },
      { materia_id: m4.id, nome: 'Porcentagem', status: 'em_andamento', dificuldade: 3 },
      // Raciocínio Lógico (c1)
      { materia_id: m5.id, nome: 'Lógica Proposicional', status: 'em_andamento', dificuldade: 4 },
      { materia_id: m5.id, nome: 'Sequências Lógicas', status: 'nao_iniciado', dificuldade: 3 },

      // PF (c2)
      { materia_id: m6.id, nome: 'Interpretação de Texto', status: 'em_andamento', dificuldade: 3 },
      { materia_id: m7.id, nome: 'Poder Constituinte', status: 'em_andamento', dificuldade: 4 },
      { materia_id: m8.id, nome: 'Princípios da Administração', status: 'concluido', dificuldade: 3 },
      { materia_id: m9.id, nome: 'Crimes contra a Administração', status: 'nao_iniciado', dificuldade: 5 },
      { materia_id: m10.id, nome: 'Segurança da Informação', status: 'em_andamento', dificuldade: 3 }
    ].map(c => ({
      id: Utils.uuid(),
      materia_id: c.materia_id,
      nome: c.nome,
      status: c.status,
      dificuldade: c.dificuldade,
      criado_em: now.toISOString(),
      atualizado_em: now.toISOString()
    }));
    await DB.bulkPut('conteudos', conteudos);

    // ---------- Sessões de estudo (últimos 14 dias) ----------
    const materiasById = {};
    [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10].forEach(m => materiasById[m.id] = m);
    const conteudosByMateria = {};
    conteudos.forEach(c => {
      (conteudosByMateria[c.materia_id] = conteudosByMateria[c.materia_id] || []).push(c);
    });

    const tipos = ['teoria', 'exercicios', 'revisao', 'simulado'];
    const tecnicas = ['pomodoro', 'leitura_ativa', 'flashcards', 'resolucao_questoes', 'livre'];

    const sessoes = [];
    for (let dia = -14; dia <= 0; dia++) {
      // Pula alguns dias para realismo
      if (dia === -10 || dia === -6 || dia === -3 || dia === -1) continue;
      const sessoesNoDia = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < sessoesNoDia; i++) {
        const materia = [m1, m2, m3, m4, m5][Math.floor(Math.random() * 5)];
        const cs = conteudosByMateria[materia.id] || [];
        const conteudo = cs[Math.floor(Math.random() * cs.length)];
        if (!conteudo) continue;
        const horaInicio = 8 + Math.floor(Math.random() * 12);
        const dataInicio = new Date(now);
        dataInicio.setDate(dataInicio.getDate() + dia);
        dataInicio.setHours(horaInicio, Math.floor(Math.random() * 60), 0, 0);
        const duracaoMin = 30 + Math.floor(Math.random() * 90);
        const dataFim = new Date(dataInicio.getTime() + duracaoMin * 60000);

        const conc = materia.concurso_id === c1.id ? c1 : c2;
        sessoes.push({
          id: Utils.uuid(),
          concurso_id: conc.id,
          materia_id: materia.id,
          conteudo_id: conteudo.id,
          data_inicio: dataInicio.toISOString(),
          data_fim: dataFim.toISOString(),
          tempo_minutos: duracaoMin,
          tipo_estudo: tipos[Math.floor(Math.random() * tipos.length)],
          tecnica: tecnicas[Math.floor(Math.random() * tecnicas.length)],
          nivel_concentracao: 1 + Math.floor(Math.random() * 5),
          nivel_energia: 1 + Math.floor(Math.random() * 5),
          nivel_compreensao: 1 + Math.floor(Math.random() * 5),
          humor_antes: 1 + Math.floor(Math.random() * 5),
          humor_depois: 1 + Math.floor(Math.random() * 5),
          criado_em: dataInicio.toISOString(),
          atualizado_em: dataFim.toISOString()
        });
      }
    }
    await DB.bulkPut('sessoes', sessoes);

    // ---------- Anotações (algumas) ----------
    const anotacoes = [];
    if (sessoes.length >= 3) {
      anotacoes.push({
        id: Utils.uuid(),
        sessao_id: sessoes[0].id,
        conteudo_id: sessoes[0].conteudo_id,
        resumo: 'Estudei os princípios fundamentais do tema. Foco em diferenças conceituais.',
        duvidas: 'Ainda tenho dúvida sobre a aplicação prática do conceito X em casos específicos.',
        aprendizados: 'Consegui entender a diferença entre A e B. O exemplo do professor ajudou muito.',
        erros_recorrentes: 'Confundi X com Y na hora de aplicar a regra.',
        proximos_passos: 'Resolver 20 questões sobre o tema e fazer resumo próprio.',
        tags: ['direito', 'conceitos', 'revisar'],
        criado_em: now.toISOString(),
        atualizado_em: now.toISOString()
      });
      anotacoes.push({
        id: Utils.uuid(),
        sessao_id: sessoes[1].id,
        conteudo_id: sessoes[1].conteudo_id,
        resumo: 'Resolução de questões de prova anterior.',
        duvidas: '',
        aprendizados: 'Identifiquei padrão de cobrança em questões discursivas.',
        erros_recorrentes: 'Errei por leitura apressada do enunciado.',
        proximos_passos: 'Treinar leitura atenta do enunciado.',
        tags: ['questoes', 'treino'],
        criado_em: now.toISOString(),
        atualizado_em: now.toISOString()
      });
    }
    await DB.bulkPut('anotacoes', anotacoes);

    // ---------- Revisões (gera para conteúdos concluídos) ----------
    const concluidos = conteudos.filter(c => c.status === 'concluido');
    for (const c of concluidos) {
      await Service.gerarRevisoesParaConteudo(c.id);
    }

    await DB.markInitialized();
  }
};

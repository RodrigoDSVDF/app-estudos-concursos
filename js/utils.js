/* ================================================================
 * utils.js — Funções utilitárias globais
 * Inclui: formatação de data/hora, helpers DOM, toasts, confirmação
 * ================================================================ */

/* ---------- FORMATADORES ---------- */
const Utils = {
  /**
   * Formata duração em minutos para string legível.
   * Ex: 90 -> "1h 30min", 45 -> "45min", 150 -> "2h 30min"
   */
  formatDuration(minutes) {
    if (!minutes || minutes < 0) return '0min';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  },

  /** Formata minutos como horas decimais: 90 -> "1.5h" */
  formatHours(minutes) {
    if (!minutes) return '0h';
    return (minutes / 60).toFixed(1).replace('.', ',') + 'h';
  },

  /** Formata data ISO para pt-BR: 2024-03-15 -> "15/03/2024" */
  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  },

  /** Formata data + hora: "15/03/2024 14:30" */
  formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  /** Data por extenso: "15 de março de 2024" */
  formatDateLong(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric', month: 'long', year: 'numeric'
    });
  },

  /** Retorna data atual no formato ISO (YYYY-MM-DD) considerando fuso BR */
  todayISO() {
    const now = new Date();
    const tz = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const y = tz.getFullYear();
    const m = String(tz.getMonth() + 1).padStart(2, '0');
    const d = String(tz.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /** Hora atual HH:MM */
  nowTime() {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit', minute: '2-digit'
    });
  },

  /** Calcula diferença em minutos entre duas datas ISO */
  diffMinutes(startISO, endISO) {
    const s = new Date(startISO).getTime();
    const e = new Date(endISO).getTime();
    if (isNaN(s) || isNaN(e)) return 0;
    return Math.max(0, Math.round((e - s) / 60000));
  },

  /** Adiciona dias a uma data ISO e retorna ISO */
  addDays(iso, days) {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  },

  /** Extrai hora cheia de uma data ISO: 14:30 -> 14 */
  hourOf(iso) {
    const d = new Date(iso);
    return d.getHours();
  },

  /** Retorna nome curto do dia da semana: "Seg", "Ter", etc. */
  weekdayShort(iso) {
    const d = new Date(iso);
    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return names[d.getDay()];
  },

  /** Iniciais do dia da semana completa */
  weekdayFull(iso) {
    const d = new Date(iso);
    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return names[d.getDay()];
  },

  /** Gera UUID v4 simples (suficiente para uso local) */
  uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /** Escapa HTML para evitar XSS ao inserir texto no DOM */
  escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /** Debounce simples */
  debounce(fn, wait = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  /** Calcula média arredondada de um array de números */
  avg(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce((s, n) => s + n, 0) / arr.length;
  },

  /** Soma array */
  sum(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce((s, n) => s + Number(n || 0), 0);
  },

  /** Agrupa array por chave */
  groupBy(arr, keyFn) {
    return arr.reduce((acc, item) => {
      const k = keyFn(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  },

  /** Calcula streak (sequência de dias consecutivos com estudo) */
  calculateStreak(datesISO) {
    if (!datesISO || !datesISO.length) return 0;
    const days = [...new Set(datesISO.map(d => d.split('T')[0]))].sort().reverse();
    if (!days.length) return 0;
    let streak = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // Se hoje não tem estudo, começa a contar de ontem
    if (!days.includes(cursor.toISOString().split('T')[0])) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (const day of days) {
      const cur = cursor.toISOString().split('T')[0];
      if (day === cur) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else if (day < cur) {
        break;
      }
    }
    return streak;
  },

  /** Calcula correlação de Pearson entre dois arrays */
  pearsonCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    const mx = this.avg(x);
    const my = this.avg(y);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const a = x[i] - mx;
      const b = y[i] - my;
      num += a * b;
      dx += a * a;
      dy += b * b;
    }
    if (dx === 0 || dy === 0) return 0;
    return num / Math.sqrt(dx * dy);
  }
};

/* ---------- HELPERS DOM ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Cria elemento HTML a partir de string.
 * Retorna o primeiro elemento filho.
 */
function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

/* ---------- TOASTS ---------- */
const Toast = {
  show(message, type = 'info', title = '', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const titles = { success: 'Sucesso', error: 'Erro', warning: 'Atenção', info: 'Info' };
    const toast = el(`
      <div class="toast ${type}">
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
          <div class="toast-title">${title || titles[type] || 'Info'}</div>
          <div class="toast-message">${Utils.escapeHTML(message)}</div>
        </div>
      </div>
    `);
    $('#toastContainer').appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideIn 200ms reverse';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },
  success(msg, title) { this.show(msg, 'success', title); },
  error(msg, title) { this.show(msg, 'error', title); },
  warning(msg, title) { this.show(msg, 'warning', title); },
  info(msg, title) { this.show(msg, 'info', title); }
};

/* ---------- CONFIRMAÇÃO ---------- */
const Confirm = {
  _resolve: null,
  ask(message, title = 'Confirmar ação') {
    return new Promise(resolve => {
      this._resolve = resolve;
      $('#confirmTitle').textContent = title;
      $('#confirmMessage').textContent = message;
      $('#confirmOverlay').hidden = false;
    });
  },
  _respond(ok) {
    $('#confirmOverlay').hidden = true;
    if (this._resolve) {
      this._resolve(ok);
      this._resolve = null;
    }
  }
};

/* ---------- MODAL ---------- */
const Modal = {
  open({ title, body, footer, size = '' }) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = '';
    $('#modalFooter').innerHTML = '';
    if (typeof body === 'string') {
      $('#modalBody').innerHTML = body;
    } else if (body instanceof Node) {
      $('#modalBody').appendChild(body);
    }
    if (footer) {
      if (typeof footer === 'string') {
        $('#modalFooter').innerHTML = footer;
      } else if (footer instanceof Node) {
        $('#modalFooter').appendChild(footer);
      }
    }
    const modal = $('#modal');
    modal.className = 'modal' + (size ? ' modal-' + size : '');
    $('#modalOverlay').hidden = false;
    requestAnimationFrame(() => $('#modalOverlay').classList.add('show'));
  },
  close() {
    $('#modalOverlay').classList.remove('show');
    setTimeout(() => { $('#modalOverlay').hidden = true; }, 180);
  },
  alert(message, title = 'Aviso') {
    const footer = el('<div></div>');
    const btn = el('<button class="btn btn-primary">OK</button>');
    btn.addEventListener('click', () => this.close());
    footer.appendChild(btn);
    this.open({ title, body: `<p>${Utils.escapeHTML(message)}</p>`, footer, size: 'sm' });
  }
};

/* ---------- FORMATAÇÃO DE NÚMEROS PT-BR ---------- */
const fmtNumber = (n) => (Number(n) || 0).toLocaleString('pt-BR');
const fmtPercent = (n, decimals = 0) => {
  return (Number(n) || 0).toFixed(decimals).replace('.', ',') + '%';
};

/* ---------- TAGS INPUT (chips) ---------- */
function createTagsInput(initialTags = [], onChange = null) {
  const container = el(`
    <div class="tags-input">
      <div class="tags-list"></div>
      <input type="text" class="form-control" placeholder="Digite e pressione Enter para adicionar tag..." />
    </div>
  `);
  const list = $('.tags-list', container);
  const input = $('input', container);
  const tags = new Set(initialTags.map(t => t.trim()).filter(Boolean));

  function render() {
    list.innerHTML = '';
    [...tags].forEach(tag => {
      const chip = el(`<span class="tag">${Utils.escapeHTML(tag)}<span class="tag-remove" data-tag="${Utils.escapeHTML(tag)}">✕</span></span>`);
      $('.tag-remove', chip).addEventListener('click', e => {
        e.stopPropagation();
        tags.delete(tag);
        render();
        if (onChange) onChange([...tags]);
      });
      list.appendChild(chip);
    });
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = input.value.trim().replace(/,$/, '');
      if (v && !tags.has(v)) {
        tags.add(v);
        input.value = '';
        render();
        if (onChange) onChange([...tags]);
      }
    } else if (e.key === 'Backspace' && !input.value && tags.size) {
      const last = [...tags].pop();
      tags.delete(last);
      render();
      if (onChange) onChange([...tags]);
    }
  });
  render();
  container.getTags = () => [...tags];
  return container;
}

// Estilo inline para tags-input (mantém no JS para reaproveitamento)
const tagsStyle = document.createElement('style');
tagsStyle.textContent = `
  .tags-input { display: flex; flex-direction: column; gap: 8px; }
  .tags-list { display: flex; flex-wrap: wrap; gap: 4px; min-height: 4px; }
`;
document.head.appendChild(tagsStyle);

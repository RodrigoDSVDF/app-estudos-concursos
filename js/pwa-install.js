/* ================================================================
 * pwa-install.js — Captura o evento beforeinstallprompt e mostra
 * botão customizado de instalação do PWA.
 *
 * Em navegadores que não disparam beforeinstallprompt (iOS Safari),
 * mostra instruções específicas para o usuário.
 * ================================================================ */

const PWAInstall = {
  _deferredPrompt: null,
  _installed: false,

  init() {
    // Captura o evento beforeinstallprompt (Chrome, Edge, Android)
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] beforeinstallprompt disparado');
      // Previne o prompt automático do navegador
      e.preventDefault();
      this._deferredPrompt = e;

      // Só mostra se o usuário não dispensou antes (localStorage)
      if (!localStorage.getItem('pwa_banner_dismissed')) {
        this._mostrarBanner();
      } else {
        // Mesmo dispensado, mostra o botão do sidebar (mais discreto)
        this._mostrarBotaoSidebar();
      }
    });

    // Detecta se já está instalado (standalone)
    window.addEventListener('DOMContentLoaded', () => {
      if (this._isStandalone()) {
        console.log('[PWA] App já está rodando como standalone (instalado)');
        this._installed = true;
        this._esconderTudo();
      }
    });

    // Detecta instalação bem-sucedida
    window.addEventListener('appinstalled', (e) => {
      console.log('[PWA] App instalado com sucesso!');
      this._installed = true;
      this._esconderTudo();
      if (typeof Toast !== 'undefined') {
        Toast.success('App instalado! Você já pode acessar pela tela inicial.');
      }
    });

    // Bind dos botões de instalação
    document.addEventListener('DOMContentLoaded', () => {
      const bannerBtn = document.getElementById('pwaInstallBtn');
      const bannerClose = document.getElementById('pwaBannerClose');
      const btnSidebar = document.getElementById('installAppBtn');

      if (bannerBtn) {
        bannerBtn.addEventListener('click', () => this.promptInstall());
      }
      if (bannerClose) {
        bannerClose.addEventListener('click', () => this._dispensarBanner());
      }
      if (btnSidebar) {
        btnSidebar.addEventListener('click', () => this.promptInstall());
      }
    });

    // Para iOS (que NÃO suporta beforeinstallprompt), mostra dica
    // depois de 8 segundos se ainda não foi instalado e é iOS Safari
    setTimeout(() => {
      if (!this._installed && !this._deferredPrompt && this._isIOS()) {
        this._mostrarDicaIOS();
      }
    }, 8000);
  },

  /** Verifica se o app está rodando como standalone (instalado) */
  _isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  },

  /** Detecta iOS (que não suporta beforeinstallprompt) */
  _isIOS() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    return isIOS && isSafari;
  },

  /** Mostra o banner elegante de instalação */
  _mostrarBanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.hidden = false;
    // Também mostra o botão do sidebar
    this._mostrarBotaoSidebar();
  },

  /** Mostra apenas o botão discreto no sidebar (para usuários que dispensaram o banner) */
  _mostrarBotaoSidebar() {
    const btnSidebar = document.getElementById('installAppBtn');
    if (btnSidebar) btnSidebar.hidden = false;
  },

  /** Dispensa o banner (usuário clicou no X) — não mostra mais por esta sessão */
  _dispensarBanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
      // Anima saída
      banner.style.transition = 'transform 300ms ease, opacity 300ms ease';
      banner.style.transform = 'translateY(120%)';
      banner.style.opacity = '0';
      setTimeout(() => { banner.hidden = true; }, 300);
    }
    localStorage.setItem('pwa_banner_dismissed', '1');
    // Mantém o botão do sidebar visível para acesso posterior
  },

  /** Esconde tudo (banner + botão sidebar) */
  _esconderTudo() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.hidden = true;
    const btnSidebar = document.getElementById('installAppBtn');
    if (btnSidebar) btnSidebar.hidden = true;
  },

  /** Dispara o prompt de instalação nativo */
  async promptInstall() {
    if (!this._deferredPrompt) {
      // Sem deferredPrompt — pode ser iOS ou já instalado
      if (this._isIOS()) {
        this._mostrarDicaIOS(true);
      } else if (this._isStandalone()) {
        Toast.info('O app já está instalado.');
      } else {
        Toast.info('Seu navegador não suporta instalação automática. Use o menu do navegador (⋮) e escolha "Adicionar à tela inicial".');
      }
      return;
    }

    // Mostra o prompt nativo
    this._deferredPrompt.prompt();
    const { outcome } = await this._deferredPrompt.userChoice;
    console.log('[PWA] Resposta do usuário:', outcome);

    if (outcome === 'accepted') {
      if (typeof Toast !== 'undefined') {
        Toast.success('Instalando... aguarde alguns segundos.');
      }
    } else {
      if (typeof Toast !== 'undefined') {
        Toast.info('Você pode instalar mais tarde pelo botão "Instalar aplicativo" no menu.');
      }
    }

    // O prompt só pode ser usado uma vez
    this._deferredPrompt = null;
    this._esconderTudo();
  },

  /** Mostra dica de instalação para iOS (que não tem prompt nativo) */
  _mostrarDicaIOS(forcar = false) {
    // Só mostra se ainda não está instalado
    if (this._isStandalone()) return;
    // Não mostra se já dispensou antes (localStorage)
    if (!forcar && localStorage.getItem('pwa_ios_dica_dismissed')) return;

    const msg = `📱 Para instalar no iPhone/iPad:\n\n` +
                `1. Toque no botão Compartilhar (quadrado com seta ↗) na barra do Safari\n` +
                `2. Role e selecione "Adicionar à Tela de Início"\n` +
                `3. Toque em "Adicionar"\n\n` +
                `O app aparecerá na tela inicial com ícone próprio!`;
    if (forcar) {
      // Mostra como alerta modal
      const Modal = window.Modal;
      if (Modal) {
        Modal.alert(msg, 'Instalar no iPhone');
      } else {
        alert(msg);
      }
    } else {
      // Mostra como toast info
      setTimeout(() => {
        if (window.Toast) {
          window.Toast.info('📱 Toque em Compartilhar ↗ no Safari e depois "Adicionar à Tela de Início" para instalar o app.', 'Instale o app', 8000);
        }
      }, 1000);
    }
  }
};

// Inicializa quando o script carrega
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PWAInstall.init());
} else {
  PWAInstall.init();
}

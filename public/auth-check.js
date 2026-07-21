/**
 * auth-check.js — Script de verificação de autenticação
 * Inclua este arquivo em TODOS os painéis protegidos.
 * 
 * Responsabilidades:
 * 1. Verificar se o usuário está logado (/api/auth/me)
 * 2. Redirecionar para login se não autenticado
 * 3. Verificar permissão para o painel atual
 * 4. Preencher o menu lateral com os painéis e submenus protegidos
 * 5. Exibir nome do usuário no sidebar e botão de logout
 */

const PAINEL_CODE_BY_PAGE = {
  'trato.html':                'analise_trato',
  'notas.html':                'central_xml',
  'fluxo_caixa.html':          'fluxo_caixa',
  'fechamento.html':           'fechamento_dre',
  'fechamento_financeiro.html':'fechamento_financeiro',
  'fechamento_receita.html':   'fechamento_receita',
  'fechamento_insumos.html':   'fechamento_insumos',
  'fechamento_pecuaria.html':  'fechamento_pecuaria',
  'admin_permissoes.html':     'admin_permissoes'
};

// Estrutura hierárquica do Menu. Os subitens do Fechamento DRE pertencem à propriedade subItems.
const NAV_ITEMS = [
  { painel: 'analise_trato',        href: 'trato.html',                icon: 'fa-house',          label: 'Análise Trato' },
  { painel: 'central_xml',          href: 'notas.html',                icon: 'fa-file-invoice-dollar', label: 'Central XML' },
  { painel: 'fluxo_caixa',          href: 'fluxo_caixa.html',          icon: 'fa-money-bill-wave', label: 'Fluxo de Caixa' },
  { 
    painel: 'fechamento_dre',       
    href: 'fechamento.html',           
    icon: 'fa-file-chart-column', 
    label: 'Fechamento DRE',
    subItems: [
      { painel: 'fechamento_financeiro', href: 'fechamento_financeiro.html', icon: 'fa-coins',            label: 'Financeiro' },
      { painel: 'fechamento_receita',    href: 'fechamento_receita.html',    icon: 'fa-chart-bar',        label: 'Receita' },
      { painel: 'fechamento_insumos',    href: 'fechamento_insumos.html',    icon: 'fa-seedling',         label: 'Insumos' },
      { painel: 'fechamento_pecuaria',   href: 'fechamento_pecuaria.html',   icon: 'fa-cow',              label: 'Pecuária' }
    ]
  },
  { painel: 'admin_permissoes',     href: 'admin_permissoes.html',     icon: 'fa-shield-halved',    label: 'Permissões', adminOnly: true }
];

(async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }

    const data = await res.json();
    if (!data.success) {
      window.location.href = '/login.html';
      return;
    }

    const { nome, paineis, isAdmin } = data;
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const currentPainel = PAINEL_CODE_BY_PAGE[currentPage];

    // Verificar permissão para este painel específico
    if (currentPainel && !isAdmin && !paineis.includes(currentPainel)) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0d14;font-family:Inter,sans-serif;text-align:center;">
          <div>
            <div style="font-size:72px;margin-bottom:16px;">🔒</div>
            <h1 style="color:#e8eaf0;font-size:28px;margin-bottom:8px;">Acesso Negado</h1>
            <p style="color:#7a85a0;margin-bottom:24px;">Você não tem permissão para acessar este painel.<br>Contate o administrador do sistema.</p>
            <a href="javascript:history.back()" style="display:inline-block;padding:10px 22px;background:#4f9cf9;color:white;border-radius:10px;text-decoration:none;font-weight:600;">← Voltar</a>
          </div>
        </div>
      `;
      return;
    }

    // Preencher menu lateral dinamicamente
    const navMenu = document.getElementById('nav-menu');
    if (navMenu) {
      let menuHtml = '';

      NAV_ITEMS.forEach(item => {
        // Ignorar se for item restrito de Admin e o usuário logado não for Admin
        if (item.adminOnly && !isAdmin) return;

        // Se o item pai for liberado para o usuário
        const parentAllowed = isAdmin || paineis.includes(item.painel);
        if (!parentAllowed) return;

        const isParentActive = currentPage === item.href;

        // Se possuir subitens
        if (item.subItems && item.subItems.length > 0) {
          // Filtrar os subitens que o usuário possui acesso
          const allowedSubItems = item.subItems.filter(sub => isAdmin || paineis.includes(sub.painel));
          
          if (allowedSubItems.length > 0) {
            // Verificar se o usuário está navegando em algum dos subitens atualmente
            const isSubActive = allowedSubItems.some(sub => currentPage === sub.href);
            const dropdownOpenClass = isSubActive ? 'open' : '';
            const arrowRotateStyle = isSubActive ? 'transform: rotate(90deg);' : '';
            const activeParentClass = (isParentActive || isSubActive) ? 'active' : '';

            menuHtml += `
              <div style="display:flex; flex-direction:column; width:100%;">
                <div class="nav-dropdown-toggle ${activeParentClass}" onclick="toggleDropdownMenu(this)" style="display:flex; justify-content:space-between; align-items:center;">
                  <span onclick="window.location.href='${item.href}'; event.stopPropagation();" style="display:flex; align-items:center; gap:12px; flex:1;">
                    <i class="fa-solid ${item.icon}"></i> ${item.label}
                  </span>
                  <i class="fa-solid fa-chevron-right arrow" style="cursor:pointer; padding: 4px; ${arrowRotateStyle}"></i>
                </div>
                <div class="nav-dropdown ${dropdownOpenClass}">
                  ${allowedSubItems.map(sub => {
                    const isSubCurrent = currentPage === sub.href ? 'active' : '';
                    return `<a href="${sub.href}" class="${isSubCurrent}"><i class="fa-solid ${sub.icon}"></i> ${sub.label}</a>`;
                  }).join('')}
                </div>
              </div>
            `;
            return;
          }
        }

        // Renderiza item normal sem subitens
        const isActive = isParentActive ? 'active' : '';
        menuHtml += `<a href="${item.href}" class="${isActive}"><i class="fa-solid ${item.icon}"></i> ${item.label}</a>`;
      });

      navMenu.innerHTML = menuHtml;
    }

    // Preencher info do usuário no sidebar
    const sidebarUser = document.getElementById('sidebar-user');
    if (sidebarUser) {
      sidebarUser.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-top:1px solid rgba(255,255,255,0.07);margin-top:auto;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f9cf9,#7c5cbf);display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-weight:700;">
            ${(nome || 'U')[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:#e8eaf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nome || data.usuario}</div>
            <div style="font-size:10px;color:#7a85a0;">${isAdmin ? 'Administrador' : 'Usuário'}</div>
          </div>
          <button onclick="logout()" title="Sair" style="background:none;border:none;color:#7a85a0;cursor:pointer;padding:4px;border-radius:6px;transition:color 0.2s;" onmouseover="this.style.color='#f97070'" onmouseout="this.style.color='#7a85a0'">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      `;
    }

  } catch (e) {
    console.error('[auth-check] Erro:', e);
    window.location.href = '/login.html';
  }
})();

// Função global para alternar abertura/fechamento do submenu
window.toggleDropdownMenu = function(toggleEl) {
  const dropdownEl = toggleEl.nextElementSibling;
  const arrowEl = toggleEl.querySelector('.arrow');
  
  if (dropdownEl.classList.contains('open')) {
    dropdownEl.classList.remove('open');
    if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
  } else {
    dropdownEl.classList.add('open');
    if (arrowEl) arrowEl.style.transform = 'rotate(90deg)';
  }
};

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.href = '/login.html';
}

// Variáveis de Estado
let currentPage = 1;
const limit = 50;
let selectedChave = null;
let totalPages = 1;

// Elementos do DOM
const masterBody = document.getElementById('master-body');
const detailBody = document.getElementById('detail-body');
const detailTable = document.getElementById('detail-table');
const emptyDetailMessage = document.getElementById('empty-detail-message');

const loadingMaster = document.getElementById('loading-master');
const loadingDetail = document.getElementById('loading-detail');

// Paginação
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const currentPageNum = document.getElementById('current-page-num');
const totalPagesNum = document.getElementById('total-pages-num');
const pagShowingStart = document.getElementById('pag-showing-start');
const pagShowingEnd = document.getElementById('pag-showing-end');
const pagTotalItems = document.getElementById('pag-total-items');

// Filtros de Pesquisa
const filterFluxo = document.getElementById('filter-fluxo');
const filterStatus = document.getElementById('filter-status');
const filterFilial = document.getElementById('filter-filial');
const filterFornecedor = document.getElementById('filter-fornecedor');
const filterNumnf = document.getElementById('filter-numnf');
const filterEmissaoDe = document.getElementById('filter-emissao-de');
const filterEmissaoAte = document.getElementById('filter-emissao-ate');
const filterVencimentoDe = document.getElementById('filter-vencimento-de');
const filterVencimentoAte = document.getElementById('filter-vencimento-ate');
const filterXmlConfco = document.getElementById('filter-xmlconfco');

const btnApplyFilters = document.getElementById('btn-apply-filters');
const btnClearFilters = document.getElementById('btn-clear-filters');

// Mapeamento de status por fluxo/categoria
const PENDENTES_STATUSES = [
  'Rejeitada',
  'Pré-Nota',
  'Benef.Aberto',
  'Em Aberto',
  'Dev.Venda Aberto',
  'CT-e Aberto',
  'Sem Definição'
];

const CONCLUIDOS_STATUSES = [
  'Lançada'
];

function updateStatusOptions() {
  const fluxoVal = filterFluxo.value;
  const currentStatusVal = filterStatus.value;
  
  // Limpar opções existentes
  filterStatus.innerHTML = '';
  
  // Sempre adicionar a opção "Todos"
  const optionTodos = document.createElement('option');
  optionTodos.value = 'todos';
  optionTodos.textContent = 'Todos';
  filterStatus.appendChild(optionTodos);
  
  let targetStatuses = [];
  if (fluxoVal === 'pendentes') {
    targetStatuses = PENDENTES_STATUSES;
  } else if (fluxoVal === 'concluidos') {
    targetStatuses = CONCLUIDOS_STATUSES;
  } else {
    targetStatuses = [...PENDENTES_STATUSES, ...CONCLUIDOS_STATUSES];
  }
  
  targetStatuses.forEach(status => {
    const opt = document.createElement('option');
    opt.value = status;
    opt.textContent = status;
    filterStatus.appendChild(opt);
  });
  
  // Tentar restaurar o valor anterior se ele ainda existir na lista, caso contrário volta para "todos"
  if (targetStatuses.includes(currentStatusVal)) {
    filterStatus.value = currentStatusVal;
  } else {
    filterStatus.value = 'todos';
  }
}

// Helper para escapar HTML
function escapeHTML(str) {
  if (str === undefined || str === null) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// FUNÇÕES AUXILIARES / FORMATADORES
// ==========================================================================

function formatCurrency(val) {
  if (val === undefined || val === null) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateDisplay(dateStr) {
  if (dateStr && dateStr.length === 8) {
    return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
  }
  return dateStr || '';
}

function getDaysBadge(days) {
  const numDays = parseInt(days, 10) || 0;
  let colorClass = 'days-green';
  
  if (numDays >= 10) {
    colorClass = 'days-red'; // Vermelho acima de 10 dias
  } else if (numDays >= 4 && numDays <= 9) {
    colorClass = 'days-yellow'; // Amarelo de 4 a 9 dias
  } else {
    colorClass = 'days-green'; // Verde até 3 dias
  }
  
  return `<span class="badge-days ${colorClass}">${numDays} dias</span>`;
}

function getHeaderStatusBadge(row) {
  const status = row.XML_STATUS ? row.XML_STATUS.trim() : '';
  let dotClass = 'status-dot-grey';
  
  if (status === 'Rejeitada') {
    dotClass = 'status-dot-red';
  } else if (status === 'Lançada') {
    dotClass = 'status-dot-green';
  } else if (status === 'Pré-Nota') {
    dotClass = 'status-dot-lightblue';
  } else if (status === 'CT-e Aberto') {
    dotClass = 'status-dot-blue';
  } else if (status === 'Benef.Aberto' || status === 'Dev.Venda Aberto') {
    dotClass = 'status-dot-orange';
  } else {
    // Em Aberto, Sem Definição
    dotClass = 'status-dot-grey';
  }
  
  return `<span class="header-status-dot ${dotClass}" title="${escapeHTML(status)}"></span>`;
}

function getItemStatusDot(item) {
  const ok = item.XIT_OK ? item.XIT_OK.trim() : '';
  const pedido = item.XIT_PEDIDO ? item.XIT_PEDIDO.trim() : '';

  // 1. Sem Pedido de Compra
  if (!pedido) {
    return `<span class="item-status-dot item-status-blue" title="Não tem pedido de Compra"></span>`;
  }

  // 2. Confere
  if (ok === 'CF') {
    return `<span class="item-status-dot item-status-green" title="Quantidade/Preço confere com pedido de Compra"></span>`;
  }

  // 3. Divergente (Preço, Quantidade, etc. - ex: PC, CV, etc.)
  if (ok && ok !== '') {
    return `<span class="item-status-dot item-status-yellow" title="Quantidade/Preço divergente do pedido de compra"></span>`;
  }

  // Default: em análise/aberto
  return `<span class="item-status-dot item-status-yellow" title="Em Aberto (Aguardando conferência)"></span>`;
}

// ==========================================================================
// OPERAÇÕES DE DADOS (API FETCH)
// ==========================================================================

async function loadHeaders() {
  loadingMaster.classList.add('active');
  selectedChave = null;
  resetDetailPane();

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit,
      fluxo: filterFluxo.value,
      status: filterStatus.value,
      filial: filterFilial.value.trim(),
      fornecedor: filterFornecedor.value.trim(),
      numnf: filterNumnf.value.trim(),
      emissao_de: filterEmissaoDe.value,
      emissao_ate: filterEmissaoAte.value,
      vencimento_de: filterVencimentoDe.value,
      vencimento_ate: filterVencimentoAte.value,
      xml_confco: filterXmlConfco.value
    });

    const url = `/api/notas?${params.toString()}`;
    const res = await fetch(url);
    const result = await res.json();

    if (result.success) {
      renderHeaders(result.data);
      updatePaginationControls(result.page, result.limit, result.total);
      
      // Atualizar cards de totalização
      document.getElementById('val-total-pendentes').textContent = Number(result.totalPendentes || 0).toLocaleString('pt-BR');
      document.getElementById('val-total-concluidos').textContent = Number(result.totalConcluidos || 0).toLocaleString('pt-BR');
    } else {
      alert('Erro ao carregar cabeçalhos: ' + result.error);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de rede ao buscar cabeçalhos.');
  } finally {
    loadingMaster.classList.remove('active');
  }
}

function renderHeaders(data) {
  if (!data || data.length === 0) {
    masterBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center" style="padding: 40px; color: var(--text-muted);">
          Nenhuma nota fiscal pendente localizada.
        </td>
      </tr>
    `;
    return;
  }

  const rowsHTML = data.map(row => {
    return `
      <tr data-chave="${row.XML_CHAVE}">
        <td>${getDaysBadge(row.DIAS)}</td>
        <td class="text-center">${getHeaderStatusBadge(row)}</td>
        <td>${escapeHTML(row.XML_FIL_CALC)}</td>
        <td>${escapeHTML(row.XML_NUMNF)}</td>
        <td title="${escapeHTML(row.XML_NOMEMT)}">${escapeHTML(row.XML_NOMEMT)}</td>
        <td>${formatDateDisplay(row.XML_EMISSA)}</td>
        <td>${formatDateDisplay(row.XML_RECEB)}</td>
        <td class="text-right font-numeric">${formatCurrency(row.XML_VLRDOC)}</td>
        <td class="font-numeric" title="${escapeHTML(row.XML_CHAVE)}">${escapeHTML(row.XML_CHAVE)}</td>
      </tr>
    `;
  });

  masterBody.innerHTML = rowsHTML.join('');

  // Setup click row events
  const rows = masterBody.querySelectorAll('tr');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      // Remover seleção anterior
      rows.forEach(r => r.classList.remove('row-selected'));
      // Selecionar atual
      row.classList.add('row-selected');
      const chave = row.getAttribute('data-chave');
      
      // Carregar os itens correspondentes
      selectedChave = chave;
      loadItems(chave);
    });
  });
}

async function loadItems(chave) {
  loadingDetail.classList.add('active');
  emptyDetailMessage.classList.add('hidden');
  detailTable.classList.add('hidden');

  try {
    const res = await fetch(`/api/notas/${chave}/itens`);
    const result = await res.json();

    if (result.success) {
      renderItems(result.data);
    } else {
      alert('Erro ao carregar itens: ' + result.error);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de rede ao buscar itens da nota.');
  } finally {
    loadingDetail.classList.remove('active');
  }
}

function renderItems(data) {
  if (!data || data.length === 0) {
    detailBody.innerHTML = `
      <tr>
        <td colspan="14" class="text-center" style="padding: 30px; color: var(--text-muted);">
          Nenhum item localizado para esta nota fiscal no banco.
        </td>
      </tr>
    `;
    detailTable.classList.remove('hidden');
    return;
  }

  const rowsHTML = data.map(item => {
    const totalXml = item.XIT_TOTNFE || item.FT_TOTAL || 0;
    const unitXml = item.XIT_PRCNFE || (item.FT_QUANT > 0 ? (totalXml / item.FT_QUANT) : 0);
    const desc = item.XIT_DESCRI || '';

    return `
      <tr>
        <td class="text-center">${getItemStatusDot(item)}</td>
        <td>${escapeHTML(item.XIT_ITEM)}</td>
        <td>${escapeHTML(item.XIT_CODNFE || item.FT_PRODUTO)}</td>
        <td>${escapeHTML(item.D1_TES || item.FT_TES || '')}</td>
        <td>${escapeHTML(item.D1_CF || item.FT_CFOP || '')}</td>
        <td title="${escapeHTML(desc)}">${escapeHTML(desc)}</td>
        <td class="text-right font-numeric">${Number(item.XIT_QTENFE || item.FT_QUANT || 0).toLocaleString('pt-BR')}</td>
        <td>${escapeHTML(item.XIT_UMNFE || 'UN')}</td>
        <td class="text-right font-numeric">${formatCurrency(unitXml)}</td>
        <td class="text-right font-numeric">${formatCurrency(totalXml)}</td>
        <td>${escapeHTML(item.XIT_PEDIDO || '')}</td>
        <td>${escapeHTML(item.XIT_ITEMPC || '')}</td>
        <td>${escapeHTML(item.D1_CC || '')}</td>
        <td>${escapeHTML(item.D1_LOCAL || '')}</td>
      </tr>
    `;
  });

  detailBody.innerHTML = rowsHTML.join('');
  detailTable.classList.remove('hidden');
}

function resetDetailPane() {
  detailBody.innerHTML = '';
  detailTable.classList.add('hidden');
  emptyDetailMessage.classList.remove('hidden');
}

// ==========================================================================
// PAGINAÇÃO E BUSCA CONTROLES
// ==========================================================================

function updatePaginationControls(page, limitSize, total) {
  currentPage = page;
  totalPages = Math.ceil(total / limitSize) || 1;
  
  currentPageNum.textContent = currentPage;
  totalPagesNum.textContent = totalPages;
  pagTotalItems.textContent = total;

  const startIdx = total > 0 ? (currentPage - 1) * limitSize + 1 : 0;
  const endIdx = Math.min(currentPage * limitSize, total);
  
  pagShowingStart.textContent = startIdx;
  pagShowingEnd.textContent = endIdx;

  btnPrevPage.disabled = currentPage <= 1;
  btnNextPage.disabled = currentPage >= totalPages;
}

// Event Listeners para Paginação
btnPrevPage.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadHeaders();
  }
});

btnNextPage.addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage++;
    loadHeaders();
  }
});

// Event Listeners para Filtros e Ações
btnApplyFilters.addEventListener('click', () => {
  currentPage = 1;
  loadHeaders();
});

btnClearFilters.addEventListener('click', () => {
  // Limpar todos os campos
  filterFluxo.value = 'pendentes';
  updateStatusOptions();
  filterStatus.value = 'todos';
  filterFilial.value = '';
  filterFornecedor.value = '';
  filterNumnf.value = '';
  filterEmissaoDe.value = '';
  filterEmissaoAte.value = '';
  filterVencimentoDe.value = '';
  filterVencimentoAte.value = '';
  filterXmlConfco.value = 'todos';
  
  currentPage = 1;
  loadHeaders();
});

// Mostrar/Recolher Filtros de Pesquisa
const filtersCard = document.querySelector('.filters-card');
const filtersHeader = document.querySelector('.filters-header');
const centralXmlLayout = document.querySelector('.central-xml-layout');

function adjustLayoutHeight() {
  if (filtersCard.classList.contains('filters-collapsed')) {
    centralXmlLayout.style.height = 'calc(100vh - 300px)';
  } else {
    centralXmlLayout.style.height = 'calc(100vh - 470px)';
  }
}

filtersHeader.addEventListener('click', (e) => {
  // Evitar recolher se clicar nos botões de limpar ou filtrar
  if (e.target.closest('.filters-actions') || e.target.closest('.btn')) {
    return;
  }
  filtersCard.classList.toggle('filters-collapsed');
  adjustLayoutHeight();
});

// Ajustar a altura na carga inicial
adjustLayoutHeight();

// Atualizar automaticamente ao mudar o fluxo ou status da classificação
filterFluxo.addEventListener('change', () => {
  updateStatusOptions();
  currentPage = 1;
  loadHeaders();
});

filterStatus.addEventListener('change', () => {
  currentPage = 1;
  loadHeaders();
});

filterXmlConfco.addEventListener('change', () => {
  currentPage = 1;
  loadHeaders();
});

// Permitir filtrar ao pressionar Enter nos campos de texto
const textInputs = [filterFilial, filterFornecedor, filterNumnf];
textInputs.forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      loadHeaders();
    }
  });
});

// Carga Inicial ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
  updateStatusOptions();
  loadHeaders();
});

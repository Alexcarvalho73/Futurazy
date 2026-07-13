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
const filterD1Cc = document.getElementById('filter-d1-cc');

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
      xml_confco: filterXmlConfco.value,
      d1_cc: filterD1Cc ? filterD1Cc.value.trim() : ''
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
        <td colspan="11" class="text-center" style="padding: 40px; color: var(--text-muted);">
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
        <td class="text-center">
          <button class="btn-financeiro" title="Visualizar Financeiro" 
            data-chave="${row.XML_CHAVE}" 
            data-numnf="${escapeHTML(row.XML_NUMNF)}" 
            data-emit="${escapeHTML(row.XML_NOMEMT)}"
            data-cnpj="${escapeHTML(row.XML_EMIT)}">
            <i class="fa-solid fa-dollar-sign"></i>
          </button>
        </td>
        <td>${escapeHTML(row.XML_FIL_CALC)}</td>
        <td>${escapeHTML(row.XML_NUMNF)}</td>
        <td title="${escapeHTML(row.XML_NOMEMT)}">${escapeHTML(row.XML_NOMEMT)}</td>
        <td>${formatDateDisplay(row.XML_EMISSA)}</td>
        <td>${formatDateDisplay(row.XML_RECEB)}</td>
        <td>${formatDateDisplay(row.XML_DTRVLD)}</td>
        <td class="text-right font-numeric">${formatCurrency(row.XML_VLRDOC)}</td>
        <td class="font-numeric" title="${escapeHTML(row.XML_CHAVE)}">${escapeHTML(row.XML_CHAVE)}</td>
      </tr>
    `;
  });

  masterBody.innerHTML = rowsHTML.join('');

  // Setup click row events
  const rows = masterBody.querySelectorAll('tr');
  rows.forEach(row => {
    row.addEventListener('click', (e) => {
      // Se o clique foi no botão financeiro, não selecionar a linha para itens
      if (e.target.closest('.btn-financeiro')) {
        return;
      }
      // Remover seleção anterior
      rows.forEach(r => r.classList.remove('row-selected'));
      // Selecionar atual
      row.classList.add('row-selected');
      const chave = row.getAttribute('data-chave');
      
      // Carregar os itens correspondentes
      selectedChave = chave;
      loadItems(chave);
    });

    // Evento para botão financeiro individual
    const btnFin = row.querySelector('.btn-financeiro');
    if (btnFin) {
      btnFin.addEventListener('click', (e) => {
        e.stopPropagation();
        const chave = btnFin.getAttribute('data-chave');
        const numnf = btnFin.getAttribute('data-numnf');
        const emit = btnFin.getAttribute('data-emit');
        openFinanceiroModal(chave, numnf, emit);
      });
    }
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
  if (filterD1Cc) filterD1Cc.value = '';
  
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
const textInputs = [filterFilial, filterFornecedor, filterNumnf, filterD1Cc];
textInputs.forEach(input => {
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        currentPage = 1;
        loadHeaders();
      }
    });
  }
});

// Carga Inicial ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
  updateStatusOptions();
  loadHeaders();
});

// Exportar Excel
const btnExportExcel = document.getElementById('btn-export-excel');
if (btnExportExcel) {
  btnExportExcel.addEventListener('click', async () => {
    const originalText = btnExportExcel.innerHTML;
    btnExportExcel.disabled = true;
    btnExportExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exportando...';

    try {
      const params = new URLSearchParams({
        page: 1,
        limit: 100000, // buscar todos os registros correspondentes aos filtros
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

      if (result.success && result.data) {
        // Gerar CSV formatado para Excel no padrão PT-BR (delimitado por ponto e vírgula e BOM UTF-8)
        const headers = [
          'Dias Pend.',
          'Status',
          'Filial',
          'Número NF',
          'Fornecedor / Emitente',
          'Emissão',
          'Recebimento',
          'Vencimento',
          'Valor XML',
          'Chave XML'
        ];

        const rows = result.data.map(row => [
          row.DIAS || '0',
          row.XML_STATUS || '',
          row.XML_FIL_CALC || '',
          row.XML_NUMNF || '',
          row.XML_NOMEMT || '',
          formatDateDisplay(row.XML_EMISSA),
          formatDateDisplay(row.XML_RECEB),
          formatDateDisplay(row.XML_DTRVLD),
          Number(row.XML_VLRDOC || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          row.XML_CHAVE || ''
        ]);

        // Construir string do CSV separada por ponto e vírgula
        let csvContent = headers.join(';') + '\r\n';
        rows.forEach(row => {
          // Escapar aspas duplas e envolver os campos com aspas se necessário
          const escapedFields = row.map((field, index) => {
            const str = String(field).replace(/"/g, '""');
            // Índices: 2 (Filial), 3 (Número NF), 4 (Fornecedor/Emitente), 9 (Chave XML)
            // Usar ="valor" para forçar o Excel a tratar como texto e não notação científica ou perder zeros à esquerda
            if (index === 2 || index === 3 || index === 4 || index === 9) {
              return `="${str}"`;
            }
            return `"${str}"`;
          });
          csvContent += escapedFields.join(';') + '\r\n';
        });

        // Criar Blob com o BOM UTF-8 (\uFEFF) para garantir caracteres e acentos corretos no Excel
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const urlBlob = URL.createObjectURL(blob);
        
        // Nome do arquivo com data da exportação
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', urlBlob);
        link.setAttribute('download', `notas_fiscais_pendentes_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Erro ao exportar dados: ' + (result.error || 'Erro desconhecido.'));
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao exportar dados.');
    } finally {
      btnExportExcel.disabled = false;
      btnExportExcel.innerHTML = originalText;
    }
  });
}

// ==========================================================================
// CONTROLES DO MODAL E BUSCA FINANCEIRA
// ==========================================================================

const modalFinanceiro = document.getElementById('modal-financeiro');
const btnCloseModal = document.getElementById('btn-close-modal');
const loadingFinanceiro = document.getElementById('loading-financeiro');
const emptyFinanceiroMessage = document.getElementById('empty-financeiro-message');
const financialCardsContainer = document.getElementById('financial-cards-container');

if (modalFinanceiro && btnCloseModal) {
  btnCloseModal.addEventListener('click', () => {
    modalFinanceiro.classList.add('hidden');
  });

  modalFinanceiro.addEventListener('click', (e) => {
    if (e.target === modalFinanceiro) {
      modalFinanceiro.classList.add('hidden');
    }
  });
}

function openFinanceiroModal(chave, numnf, emitente) {
  const cleanChave = (chave || '').trim();
  document.getElementById('fin-modal-numnf').textContent = numnf;
  document.getElementById('fin-modal-fornecedor').textContent = emitente;
  document.getElementById('fin-modal-chave').textContent = cleanChave;

  modalFinanceiro.classList.remove('hidden');
  loadFinanceiro(cleanChave);
}

async function loadFinanceiro(chave) {
  const cleanChave = (chave || '').trim();
  loadingFinanceiro.classList.add('active');
  emptyFinanceiroMessage.classList.add('hidden');
  financialCardsContainer.innerHTML = '';

  try {
    const res = await fetch(`/api/notas/${cleanChave}/financeiro`);
    const result = await res.json();

    if (result.success) {
      renderFinanceiroCards(result.data);
    } else {
      alert('Erro ao buscar dados financeiros: ' + result.error);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de rede ao buscar dados financeiros do Protheus.');
  } finally {
    loadingFinanceiro.classList.remove('active');
  }
}

function renderFinanceiroCards(data) {
  if (!data || data.length === 0) {
    emptyFinanceiroMessage.classList.remove('hidden');
    return;
  }

  const cardsHTML = data.map(item => {
    const valor = Number(item.E2_VALOR || 0);
    const saldo = Number(item.E2_SALDO || 0);
    const vencRea = item.E2_VENCREA ? item.E2_VENCREA.trim() : '';
    const baixa = item.E2_BAIXA ? item.E2_BAIXA.trim() : '';

    let statusText = 'Em Aberto';
    let statusClass = 'status-open';

    if (saldo === 0 || baixa !== '') {
      statusText = 'Pago';
      statusClass = 'status-paid';
    } else if (vencRea) {
      const hojeStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      if (vencRea < hojeStr) {
        statusText = 'Atrasado';
        statusClass = 'status-overdue';
      }
    }

    const fatura = item.E2_FATURA && item.E2_FATURA.trim() !== '' ? item.E2_FATURA.trim() : 'Sem fatura vinculada';
    const hist = item.E2_HIST ? item.E2_HIST.trim() : 'Nenhum histórico detalhado';
    const tpGer = item.E2_TPGER ? item.E2_TPGER.trim() : 'N/A';
    const parc = item.E2_PARCELA ? item.E2_PARCELA.trim() : 'Única';

    return `
      <div class="financial-card">
        <div class="financial-card-header">
          <span class="financial-card-title">Parcela: ${escapeHTML(parc)}</span>
          <span class="financial-card-status ${statusClass}">${statusText}</span>
        </div>
        <div class="financial-card-grid">
          <div class="financial-card-field">
            <span class="financial-card-label">Valor do Título</span>
            <span class="financial-card-value amount">${formatCurrency(valor)}</span>
          </div>
          <div class="financial-card-field">
            <span class="financial-card-label">Saldo em Aberto</span>
            <span class="financial-card-value amount highlight">${formatCurrency(saldo)}</span>
          </div>
          <div class="financial-card-field">
            <span class="financial-card-label">Vencimento Real</span>
            <span class="financial-card-value">${formatDateDisplay(vencRea)}</span>
          </div>
          <div class="financial-card-field">
            <span class="financial-card-label">Vencimento Original</span>
            <span class="financial-card-value">${formatDateDisplay(item.E2_VENCTO)}</span>
          </div>
          <div class="financial-card-field">
            <span class="financial-card-label">Data de Emissão</span>
            <span class="financial-card-value">${formatDateDisplay(item.E2_EMISSAO)}</span>
          </div>
          <div class="financial-card-field">
            <span class="financial-card-label">Data de Baixa</span>
            <span class="financial-card-value">${baixa !== '' ? formatDateDisplay(baixa) : '-'}</span>
          </div>
          <div class="financial-card-field">
            <span class="financial-card-label">Tipo Gerência</span>
            <span class="financial-card-value">${escapeHTML(tpGer)}</span>
          </div>
          <div class="financial-card-field">
            <span class="financial-card-label">Fatura Gerada</span>
            <span class="financial-card-value">${escapeHTML(fatura)}</span>
          </div>
          <div class="financial-card-full-field">
            <span class="financial-card-label">Histórico</span>
            <p class="financial-card-desc" title="${escapeHTML(hist)}">${escapeHTML(hist)}</p>
          </div>
        </div>
      </div>
    `;
  });

  financialCardsContainer.innerHTML = cardsHTML.join('');
}

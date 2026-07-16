// Variáveis Globais de Estado
let allData = [];
let filteredData = [];

// Elementos do DOM
const pivotBody = document.getElementById('pivot-body');
const cubeTotalGeral = document.getElementById('cube-total-geral');
const loadingState = document.getElementById('loading-state');
const lastUpdateBadge = document.getElementById('last-update');

// KPIs
const valPesoTotal = document.getElementById('val-peso-total');
const valPesoTon = document.getElementById('val-peso-ton');
const valTotalPesagens = document.getElementById('val-total-pesagens');
const valPlacasUnicas = document.getElementById('val-placas-unicas');
const valMediaPeso = document.getElementById('val-media-peso');

// Filtros
const filterFilial = document.getElementById('filter-filial');
const filterDate = document.getElementById('filter-date');
const dayRangeContainer = document.getElementById('day-range-container');
const filterDayStart = document.getElementById('filter-day-start');
const filterDayEnd = document.getElementById('filter-day-end');
const filterNoment = document.getElementById('filter-noment');
const filterProduct = document.getElementById('filter-product');

// Botões
const btnRefresh = document.getElementById('btn-refresh');
const btnClearFilters = document.getElementById('btn-clear-filters');
const btnExpandAll = document.getElementById('btn-expand-all');
const btnCollapseAll = document.getElementById('btn-collapse-all');

// ==========================================================================
// FUNÇÕES AUXILIARES / FORMATADORES
// ==========================================================================

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatKg(val) {
  return Number(val).toLocaleString('pt-BR') + ' kg';
}

function formatTon(val) {
  const ton = Number(val) / 1000;
  return ton.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Ton';
}

function formatDateDisplay(dateStr) {
  if (dateStr && dateStr.length === 8) {
    return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
  }
  return dateStr;
}

// ==========================================================================
// CARGA DE DADOS DO BANCO (API)
// ==========================================================================

async function loadData() {
  loadingState.classList.add('active');
  try {
    const res = await fetch('/api/tratos');
    const result = await res.json();
    
    if (result.success) {
      allData = result.data;
      filteredData = [...allData];
      
      // Atualizar badge de última atualização
      const now = new Date();
      lastUpdateBadge.textContent = `Atualizado em: ${now.toLocaleTimeString()}`;
      
      // Popular filtros e renderizar painel
      populateFilterOptions();
      updateDashboard();
    } else {
      alert('Erro ao carregar dados: ' + result.error);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de rede ao buscar dados do servidor.');
  } finally {
    loadingState.classList.remove('active');
  }
}

// ==========================================================================
// CONFIGURAÇÃO DOS FILTROS
// ==========================================================================

function populateFilterOptions() {
  const filiais = new Set();
  const months = new Set();
  const noments = new Set();
  const products = new Set();

  allData.forEach(row => {
    if (row.NJH_FILIAL) filiais.add(row.NJH_FILIAL);
    if (row.NJH_DATA && row.NJH_DATA.length === 8) {
      const month = row.NJH_DATA.substring(4, 6) + '/' + row.NJH_DATA.substring(0, 4);
      months.add(month);
    }
    if (row.NJH_NOMENT) noments.add(row.NJH_NOMENT);
    if (row.NJH_DESPRO) products.add(row.NJH_DESPRO);
  });

  // 0. Popular Filiais
  const sortedFiliais = Array.from(filiais).sort((a, b) => a.localeCompare(b));
  filterFilial.innerHTML = '<option value="">Todas as Filiais</option>';
  sortedFiliais.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    filterFilial.appendChild(opt);
  });

  // 1. Popular Meses
  const sortedMonths = Array.from(months).sort((a, b) => {
    const [mA, yA] = a.split('/').map(Number);
    const [mB, yB] = b.split('/').map(Number);
    return yB !== yA ? yB - yA : mB - mA; // Ordenação decrescente por ano e mês
  });
  
  filterDate.innerHTML = '<option value="">Todas as Datas</option>';
  sortedMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    filterDate.appendChild(opt);
  });

  // 2. Popular Entidades/Fornecedores
  const sortedNoments = Array.from(noments).sort((a, b) => a.localeCompare(b));
  filterNoment.innerHTML = '<option value="">Todas as Entidades</option>';
  sortedNoments.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    filterNoment.appendChild(opt);
  });

  // 3. Popular Produtos
  const sortedProducts = Array.from(products).sort((a, b) => a.localeCompare(b));
  filterProduct.innerHTML = '<option value="">Todos os Produtos</option>';
  sortedProducts.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    filterProduct.appendChild(opt);
  });
}

function applyFilters() {
  const selectedFilial = filterFilial.value;
  const selectedMonth = filterDate.value;
  const selectedNoment = filterNoment.value;
  const selectedProduct = filterProduct.value;
  const dayStart = parseInt(filterDayStart.value, 10);
  const dayEnd = parseInt(filterDayEnd.value, 10);

  filteredData = allData.filter(row => {
    // Filtro Filial
    if (selectedFilial && row.NJH_FILIAL !== selectedFilial) return false;

    // Filtro Mês/Ano e Dias
    if (selectedMonth) {
      const rowMonth = row.NJH_DATA.substring(4, 6) + '/' + row.NJH_DATA.substring(0, 4);
      if (rowMonth !== selectedMonth) return false;
      
      const rowDay = parseInt(row.NJH_DATA.substring(6, 8), 10);
      if (!isNaN(dayStart) && rowDay < dayStart) return false;
      if (!isNaN(dayEnd) && rowDay > dayEnd) return false;
    }
    // Filtro Entidade
    if (selectedNoment && row.NJH_NOMENT !== selectedNoment) return false;
    // Filtro Produto
    if (selectedProduct && row.NJH_DESPRO !== selectedProduct) return false;

    return true;
  });

  updateDashboard();
}

function clearFilters() {
  filterFilial.value = '';
  filterDate.value = '';
  filterDayStart.value = '';
  filterDayEnd.value = '';
  dayRangeContainer.style.display = 'none';
  filterNoment.value = '';
  filterProduct.value = '';
  filteredData = [...allData];
  updateDashboard();
}

// ==========================================================================
// ATUALIZAÇÃO DE KPIS
// ==========================================================================

function updateDashboard() {
  updateKPIs();
  renderPivotTable();
}

function updateKPIs() {
  let totalWeight = 0;
  const uniquePlates = new Set();

  filteredData.forEach(row => {
    totalWeight += row.NJH_PSSUBT || 0;
    if (row.NJH_PLACA) {
      uniquePlates.add(row.NJH_PLACA);
    }
  });

  const totalTrips = filteredData.length;
  const avgWeight = totalTrips > 0 ? Math.round(totalWeight / totalTrips) : 0;

  // Renderizar valores nos cards
  valPesoTotal.textContent = Number(totalWeight).toLocaleString('pt-BR') + ' kg';
  valPesoTon.textContent = formatTon(totalWeight);
  valTotalPesagens.textContent = Number(totalTrips).toLocaleString('pt-BR');
  valPlacasUnicas.textContent = uniquePlates.size;
  valMediaPeso.textContent = Number(avgWeight).toLocaleString('pt-BR') + ' kg';
  
  cubeTotalGeral.textContent = Number(totalWeight).toLocaleString('pt-BR') + ' kg';
}

// ==========================================================================
// CONSTRUÇÃO E RENDERIZAÇÃO DO CUBO PIVOT (DRILL-DOWN)
// ==========================================================================

// Estrutura em árvore para agrupamento hierárquico
function buildHierarchicalTree(data) {
  const tree = {};

  data.forEach(row => {
    const prod = row.NJH_DESPRO || 'SEM PRODUTO';
    const noment = row.NJH_NOMENT || 'SEM ENTIDADE';
    const date = row.NJH_DATA || 'SEM DATA';
    const placa = row.NJH_PLACA || 'SEM PLACA';
    const hor1 = row.NJH_HORPS1 || '--:--';
    const hor2 = row.NJH_HORPS2 || '--:--';
    const weight = row.NJH_PSSUBT || 0;

    // Nível 0: Produto
    if (!tree[prod]) tree[prod] = { value: 0, children: {} };
    tree[prod].value += weight;

    // Nível 1: Entidade (Noment)
    if (!tree[prod].children[noment]) tree[prod].children[noment] = { value: 0, children: {} };
    tree[prod].children[noment].value += weight;

    // Nível 2: Data
    if (!tree[prod].children[noment].children[date]) tree[prod].children[noment].children[date] = { value: 0, children: {} };
    tree[prod].children[noment].children[date].value += weight;

    // Nível 3: Placa
    if (!tree[prod].children[noment].children[date].children[placa]) tree[prod].children[noment].children[date].children[placa] = { value: 0, children: {} };
    tree[prod].children[noment].children[date].children[placa].value += weight;

    // Nível 4: Hora 1
    if (!tree[prod].children[noment].children[date].children[placa].children[hor1]) tree[prod].children[noment].children[date].children[placa].children[hor1] = { value: 0, children: {} };
    tree[prod].children[noment].children[date].children[placa].children[hor1].value += weight;

    // Nível 5: Hora 2 (Nó folha)
    if (!tree[prod].children[noment].children[date].children[placa].children[hor1].children[hor2]) {
      tree[prod].children[noment].children[date].children[placa].children[hor1].children[hor2] = { value: 0 };
    }
    tree[prod].children[noment].children[date].children[placa].children[hor1].children[hor2].value += weight;
  });

  return tree;
}

function renderPivotTable() {
  const tree = buildHierarchicalTree(filteredData);
  const rowsHTML = [];

  // Mapear recursivamente o nó e gerar HTML flat para a tabela
  function traverse(node, label, level, parentPath) {
    const currentPath = parentPath ? `${parentPath}|${label}` : label;
    const hasChildren = node.children && Object.keys(node.children).length > 0;
    
    let displayLabel = label;
    if (level === 2) {
      displayLabel = formatDateDisplay(label);
    }

    let toggleHTML = '';
    if (hasChildren) {
      toggleHTML = `<button class="toggle-btn"><i class="fa-solid fa-plus"></i></button>`;
    } else {
      toggleHTML = `<span class="leaf-bullet"></span>`;
    }

    const trHTML = `
      <tr class="pivot-row level-${level} row-collapsed" 
          data-path="${escapeHTML(currentPath)}" 
          data-parent-path="${escapeHTML(parentPath || '')}" 
          data-level="${level}" 
          data-expanded="false">
        <td>
          ${toggleHTML}
          <span>${escapeHTML(displayLabel)}</span>
        </td>
        <td class="text-right font-numeric">${Number(node.value).toLocaleString('pt-BR')} kg</td>
      </tr>
    `;

    rowsHTML.push(trHTML);

    if (hasChildren) {
      // Ordenar filhos por ordem alfabética ou decrescente de valor
      const sortedKeys = Object.keys(node.children).sort();
      sortedKeys.forEach(childKey => {
        traverse(node.children[childKey], childKey, level + 1, currentPath);
      });
    }
  }

  // Iniciar travessia pelas chaves de nível 0 (Produtos)
  const sortedProducts = Object.keys(tree).sort();
  sortedProducts.forEach(prod => {
    traverse(tree[prod], prod, 0, '');
  });

  if (rowsHTML.length === 0) {
    pivotBody.innerHTML = `
      <tr>
        <td colspan="2" class="text-center" style="padding: 40px; color: var(--text-muted);">
          Nenhum registro encontrado para os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  pivotBody.innerHTML = rowsHTML.join('');

  // Configurar clique de linhas e botões de expandir
  setupRowInteractions();
}

function setupRowInteractions() {
  const rows = pivotBody.querySelectorAll('tr');

  // Inicialmente, os nós do Nível 0 (produtos) devem ficar visíveis
  rows.forEach(row => {
    const level = parseInt(row.getAttribute('data-level'), 10);
    if (level === 0) {
      row.classList.remove('row-collapsed');
    }
  });

  rows.forEach(row => {
    const level = parseInt(row.getAttribute('data-level'), 10);
    const hasToggle = row.querySelector('.toggle-btn');

    if (hasToggle) {
      const toggleAction = (e) => {
        e.stopPropagation();
        const expanded = row.getAttribute('data-expanded') === 'true';
        row.setAttribute('data-expanded', expanded ? 'false' : 'true');
        
        // Se estiver recolhendo, devemos forçar recolhimento em todos os descendentes
        if (expanded) {
          collapseDescendants(row.getAttribute('data-path'));
        }
        
        updateTableVisibility();
      };

      // Permitir clique no botão ou na própria linha
      row.addEventListener('click', toggleAction);
    }
  });
}

// Recolhe recursivamente todos os descendentes de um path
function collapseDescendants(parentPath) {
  const rows = pivotBody.querySelectorAll('tr');
  rows.forEach(row => {
    const path = row.getAttribute('data-path');
    if (path.startsWith(parentPath + '|')) {
      row.setAttribute('data-expanded', 'false');
    }
  });
}

function updateTableVisibility() {
  const rows = pivotBody.querySelectorAll('tr');
  
  const expandedMap = {};
  const visibleMap = {};

  // Mapear estados de expansão
  rows.forEach(row => {
    const path = row.getAttribute('data-path');
    const level = parseInt(row.getAttribute('data-level'), 10);
    expandedMap[path] = row.getAttribute('data-expanded') === 'true';
    
    if (level === 0) {
      visibleMap[path] = true;
    } else {
      visibleMap[path] = false;
    }
  });

  // Propagar visibilidade
  rows.forEach(row => {
    const level = parseInt(row.getAttribute('data-level'), 10);
    if (level === 0) return;

    const path = row.getAttribute('data-path');
    const parentPath = row.getAttribute('data-parent-path');

    // Um filho só fica visível se o pai direto estiver visível e expandido
    if (visibleMap[parentPath] && expandedMap[parentPath]) {
      visibleMap[path] = true;
    }
  });

  // Aplicar display no DOM
  rows.forEach(row => {
    const path = row.getAttribute('data-path');
    const toggleIcon = row.querySelector('.toggle-btn i');

    if (visibleMap[path]) {
      row.classList.remove('row-collapsed');
      if (toggleIcon) {
        if (expandedMap[path]) {
          toggleIcon.className = 'fa-solid fa-square-minus';
        } else {
          toggleIcon.className = 'fa-solid fa-square-plus';
        }
      }
    } else {
      row.classList.add('row-collapsed');
    }
  });
}

// ==========================================================================
// OPERAÇÕES DO CUBO (EXPAND ALL / COLLAPSE ALL)
// ==========================================================================

function expandAll() {
  const rows = pivotBody.querySelectorAll('tr');
  rows.forEach(row => {
    if (row.querySelector('.toggle-btn')) {
      row.setAttribute('data-expanded', 'true');
    }
  });
  updateTableVisibility();
}

function collapseAll() {
  const rows = pivotBody.querySelectorAll('tr');
  rows.forEach(row => {
    if (row.querySelector('.toggle-btn')) {
      row.setAttribute('data-expanded', 'false');
    }
  });
  updateTableVisibility();
}

// ==========================================================================
// REGISTRO DE EVENTOS
// ==========================================================================

filterFilial.addEventListener('change', applyFilters);
filterDate.addEventListener('change', () => {
  if (filterDate.value) {
    dayRangeContainer.style.display = 'flex';
  } else {
    dayRangeContainer.style.display = 'none';
    filterDayStart.value = '';
    filterDayEnd.value = '';
  }
  applyFilters();
});
filterDayStart.addEventListener('input', applyFilters);
filterDayEnd.addEventListener('input', applyFilters);
filterNoment.addEventListener('change', applyFilters);
filterProduct.addEventListener('change', applyFilters);

btnClearFilters.addEventListener('click', clearFilters);
btnRefresh.addEventListener('click', loadData);
btnExpandAll.addEventListener('click', expandAll);
btnCollapseAll.addEventListener('click', collapseAll);

// Carga Inicial ao abrir a página
document.addEventListener('DOMContentLoaded', loadData);

/**
 * app_receita.js — Lógica completa da tela de Receitas (Fechamento Financeiro)
 * v2 — Com suporte a moeda BRL / USD (PTAX via SM2020)
 */

// ─────────────────────────────────────────────
// Constantes e Estado Global
// ─────────────────────────────────────────────
const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const state = {
  tipoCalendario: 'safra',   // 'safra' | 'calendario'
  empresaFiltro:  'TOTAL',   // 'TOTAL' | '028501' | '028503'
  moeda:          'BRL',     // 'BRL' | 'USD'
  kpiPeriodo:     'atual',   // 'atual' | 'anterior'
  allData:        [],        // dados brutos do Oracle
  resumoAnual:    null,      // resposta do /api/receita/resumo-anual
  fecharPending:  null,      // { mes, ano, empresa }
};

const fmtBrl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtCot = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// Formata valor monetário conforme moeda selecionada
function fmtMoeda(v) {
  if (v == null || v === '' || isNaN(Number(v))) return '—';
  const n = Number(v);
  if (state.moeda === 'USD') return 'US$ ' + fmtUsd.format(n);
  return 'R$ ' + fmtBrl.format(n);
}

// Formata número simples (sacas, qtd)
function fmtN(v) {
  if (v == null || isNaN(Number(v))) return '—';
  return fmtNum.format(Number(v));
}

// Prefixo da moeda
function moedaPrefix() { return state.moeda === 'USD' ? 'US$' : 'R$'; }

// Obtém campo de valor correto para a linha conforme moeda
function campos() {
  return state.moeda === 'USD'
    ? { total: 'TOTAL_USD', facs: 'VLR_FACS_USD', fethab: 'VLR_FETHAB_USD', funrural: 'VL_FUNRURAL_USD' }
    : { total: 'TOTAL',     facs: 'VLR_FACS',     fethab: 'VLR_FETHAB',     funrural: 'VL_FUNRURAL' };
}

function getSafraYear(hoje = new Date()) {
  return hoje.getMonth() + 1 >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}
function getMesesSafra(anoSafra) {
  return [
    { ano: anoSafra-1, mes:9  }, { ano: anoSafra-1, mes:10 },
    { ano: anoSafra-1, mes:11 }, { ano: anoSafra-1, mes:12 },
    { ano: anoSafra,   mes:1  }, { ano: anoSafra,   mes:2  },
    { ano: anoSafra,   mes:3  }, { ano: anoSafra,   mes:4  },
    { ano: anoSafra,   mes:5  }, { ano: anoSafra,   mes:6  },
    { ano: anoSafra,   mes:7  }, { ano: anoSafra,   mes:8  }
  ];
}
function getMesesCalendario(ano) {
  return Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1 }));
}

// ─────────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadAll();
});

function setupEventListeners() {
  // Toggle calendário
  document.getElementById('btn-toggle-cal')?.addEventListener('click', () => {
    state.tipoCalendario = state.tipoCalendario === 'safra' ? 'calendario' : 'safra';
    const btn = document.getElementById('btn-toggle-cal');
    const lbl = document.getElementById('label-cal');
    if (state.tipoCalendario === 'safra') {
      btn.classList.remove('cal-contabil');
      lbl.textContent = 'Safra Agrícola';
    } else {
      btn.classList.add('cal-contabil');
      lbl.textContent = 'Calendário Contábil';
    }
    renderAnualTable();
    updateLabelPeriodo();
  });

  // Toggle moeda
  document.querySelectorAll('.moeda-btn[data-moeda]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.moeda-btn[data-moeda]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.moeda = btn.dataset.moeda;
      atualizarLabelsMoeda();
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
      renderCube(filtered);
      renderAnualTable();
    });
  });

  // Toggle período do KPI
  document.querySelectorAll('.moeda-btn[data-kpi-periodo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.moeda-btn[data-kpi-periodo]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kpiPeriodo = btn.dataset.kpiPeriodo;
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
    });
  });

  // Refresh
  document.getElementById('btn-refresh')?.addEventListener('click', loadAll);

  // Filtros
  document.getElementById('filtros-toggle-header')?.addEventListener('click', () => {
    document.getElementById('filtros-section').classList.toggle('filters-collapsed');
  });
  document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
    const filtered = applyFilters(state.allData);
    renderCube(filtered);
    updateKpis(filtered);
  });
  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    ['f-tipo-negocio','f-empresa','f-cfop','f-produto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'SELECT') el.value = el.options[0].value;
        else el.value = '';
      }
    });
    renderCube(state.allData);
    updateKpis(state.allData);
  });

  // Expand / Collapse cubo
  document.getElementById('btn-expand-all')?.addEventListener('click', () => {
    document.querySelectorAll('#cube-body .row-hidden').forEach(r => r.classList.remove('row-hidden'));
    document.querySelectorAll('#cube-body .toggle-btn').forEach(b => b.innerHTML = '▼');
  });
  document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
    document.querySelectorAll('#cube-body tr').forEach(r => {
      if (!r.classList.contains('lvl-0')) r.classList.add('row-hidden');
    });
    document.querySelectorAll('#cube-body .toggle-btn').forEach(b => b.innerHTML = '▶');
  });

  // Tabs empresa (tabela anual)
  document.querySelectorAll('.empresa-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.empresa-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.empresaFiltro = tab.dataset.emp;
      renderAnualTable();
    });
  });

  // Modal fechar
  document.getElementById('btn-cancel-fechar')?.addEventListener('click', closeModal);
  document.getElementById('btn-confirm-fechar')?.addEventListener('click', confirmarFechamento);

  // Modal de Ajustes Manuais
  document.getElementById('btn-open-edit-fechamento')?.addEventListener('click', () => {
    document.getElementById('modal-edit-fechamento').classList.add('open');
    loadClosedFechamentos();
  });
  document.getElementById('btn-close-edit-fechamento-modal')?.addEventListener('click', closeEditFechamentoModal);
  document.getElementById('btn-cancel-edit-form')?.addEventListener('click', () => {
    document.getElementById('edit-fechamento-form-view').style.display = 'none';
    document.getElementById('edit-fechamento-list-view').style.display = 'block';
  });
  document.getElementById('btn-save-edit-form')?.addEventListener('click', saveFechamentoForm);

  document.getElementById('modal-edit-fechamento')?.addEventListener('click', e => {
    if (e.target.id === 'modal-edit-fechamento') closeEditFechamentoModal();
  });
}

// Atualiza labels dinâmicos de moeda na página
function atualizarLabelsMoeda() {
  const prefix = moedaPrefix();
  const els = document.querySelectorAll('[data-moeda-label]');
  els.forEach(el => { el.textContent = prefix; });
  // Cabeçalhos da tabela do cubo
  const thTotal = document.getElementById('th-total-cubo');
  const thFacs  = document.getElementById('th-facs-cubo');
  const thFeth  = document.getElementById('th-fethab-cubo');
  const thFun   = document.getElementById('th-funrural-cubo');
  if (thTotal) thTotal.textContent = `Total (${prefix})`;
  if (thFacs)  thFacs.textContent  = `Vlr FACS (${prefix})`;
  if (thFeth)  thFeth.textContent  = `FETHAB (${prefix})`;
  if (thFun)   thFun.textContent   = `FUNRURAL (${prefix})`;
  // Indicador de moeda no cabeçalho USD
  const usdNote = document.getElementById('moeda-note');
  if (usdNote) {
    usdNote.style.display = state.moeda === 'USD' ? 'inline-flex' : 'none';
  }
}

// ─────────────────────────────────────────────
// Carregamento de Dados
// ─────────────────────────────────────────────
async function loadAll() {
  const hoje     = new Date();
  const anoSafra = getSafraYear(hoje);

  setLoading('cube',  true);
  setLoading('anual', true);

  try {
    const [resData, resAnual] = await Promise.all([
      fetch(`/api/receita/dados?ano_safra=${anoSafra}`).then(r => r.json()),
      fetch(`/api/receita/resumo-anual?ano_safra=${anoSafra}&tipo=safra`).then(r => r.json())
    ]);

    if (resData.success) {
      state.allData = resData.data;
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
      renderCube(filtered);
    } else {
      showError('cube', resData.error || 'Erro ao carregar dados.');
    }

    if (resAnual.success) {
      state.resumoAnual = resAnual;
      renderAnualTable();
      updateLabelPeriodo();
    } else {
      showError('anual', resAnual.error || 'Erro ao carregar resumo anual.');
    }
  } catch(err) {
    console.error(err);
    showError('cube',  'Falha na conexão com o servidor.');
    showError('anual', 'Falha na conexão com o servidor.');
  } finally {
    setLoading('cube',  false);
    setLoading('anual', false);
    atualizarLabelsMoeda();
  }
}

function applyFilters(data) {
  const tipo    = document.getElementById('f-tipo-negocio').value;
  const empresa = document.getElementById('f-empresa').value;
  const cfop    = document.getElementById('f-cfop').value.trim().toUpperCase();
  const produto = document.getElementById('f-produto').value.trim().toUpperCase();

  return data.filter(r => {
    if (tipo    !== 'todos'  && r.TIPO_NEGOCIO !== tipo)                 return false;
    if (empresa !== 'todas'  && r.EMPRESA !== empresa)                   return false;
    if (cfop    && !(r.CFOP    || '').toUpperCase().includes(cfop))      return false;
    if (produto && !(r.PRODUTO || '').toUpperCase().includes(produto))   return false;
    return true;
  });
}

// ─────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────
function updateKpis(data) {
  const cf = campos();

  // Determinar datas do mês corrente e anterior
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const prevD = new Date(anoAtual, mesAtual - 1, 1);
  const mesAnt = prevD.getMonth();
  const anoAnt = prevD.getFullYear();

  // Filtrar os dados conforme o período escolhido para os cards
  const kpiData = data.filter(r => {
    if (!r.EMISSAO) return false;
    const d = new Date(r.EMISSAO);
    const m = d.getMonth();
    const y = d.getFullYear();

    if (state.kpiPeriodo === 'atual') {
      return m === mesAtual && y === anoAtual;
    } else {
      return m === mesAnt && y === anoAnt;
    }
  });

  let receita=0, sacas=0, cabecas=0, funrural=0, fethab=0;
  let totalBrl=0, totalUsd=0;

  for (const r of kpiData) {
    receita  += Number(r[cf.total]    || 0);
    totalBrl += Number(r.TOTAL        || 0);
    totalUsd += Number(r.TOTAL_USD    || 0);
    sacas    += Number(r.SACAS        || 0);
    cabecas  += Number(r.CABECAS      || 0);
    funrural += Number(r[cf.funrural] || 0);
    fethab   += Number(r[cf.fethab]   || 0);
  }

  const valorDolar = totalUsd > 0 ? (totalBrl / totalUsd) : 0;
  const labelMes = state.kpiPeriodo === 'atual'
    ? `${NOMES_MES[mesAtual]}/${anoAtual}`
    : `${NOMES_MES[mesAnt]}/${anoAnt}`;

  document.getElementById('kpi-receita').textContent   = fmtMoeda(receita);

  let kpiSacasText = '';
  if (sacas > 0 && cabecas > 0) {
    kpiSacasText = `${fmtN(sacas)} Sc / ${fmtN(cabecas)} Cab`;
  } else if (cabecas > 0) {
    kpiSacasText = `${fmtN(cabecas)} Cab`;
  } else {
    kpiSacasText = fmtN(sacas);
  }
  document.getElementById('kpi-sacas').textContent     = kpiSacasText;

  document.getElementById('kpi-val-dolar').textContent = valorDolar > 0 ? fmtCot.format(valorDolar) : '—';
  document.getElementById('kpi-funrural').textContent  = fmtMoeda(funrural);
  document.getElementById('kpi-fethab').textContent    = fmtMoeda(fethab);

  // Subtítulos informativos para cada card indicando o período selecionado
  const subText = `${labelMes} | ${state.moeda === 'USD' ? 'USD (PTAX)' : 'BRL'}`;
  document.getElementById('kpi-receita-sub').textContent   = `${kpiData.length.toLocaleString('pt-BR')} reg. · ${subText}`;
  document.getElementById('kpi-sacas-sub').textContent     = `Equivalente físico · ${labelMes}`;
  document.getElementById('kpi-val-dolar-sub').textContent = `Média ponderada · ${labelMes}`;
  document.getElementById('kpi-funrural-sub').textContent  = `Contrib. social · ${subText}`;
  document.getElementById('kpi-fethab-sub').textContent    = `Fundo transp. · ${subText}`;
}

// ─────────────────────────────────────────────
// CUBO PIVOT — Drill-down
// ─────────────────────────────────────────────
function buildHierarchy(data) {
  const tree = {};
  for (const r of data) {
    const tipo    = r.TIPO_NEGOCIO || 'Outros';
    const empresa = r.EMPRESA      || '—';
    const emissao = r.EMISSAO ? new Date(r.EMISSAO) : null;
    const mesKey  = emissao ? `${NOMES_MES[emissao.getMonth()]}/${emissao.getFullYear()}` : '—';
    const mesSort = emissao ? emissao.getFullYear() * 100 + emissao.getMonth() + 1 : 0;
    const produto = (r.PRODUTO || '—').trim();

    if (!tree[tipo])                              tree[tipo]                              = {};
    if (!tree[tipo][empresa])                     tree[tipo][empresa]                     = {};
    if (!tree[tipo][empresa][mesKey])             tree[tipo][empresa][mesKey]             = { rows: {}, mesSort };
    if (!tree[tipo][empresa][mesKey].rows[produto]) tree[tipo][empresa][mesKey].rows[produto] = [];
    tree[tipo][empresa][mesKey].rows[produto].push(r);
  }
  return tree;
}

function sumRows(rows) {
  const cf = campos();
  return rows.reduce((acc, r) => {
    acc.quant      += Number(r.QUANT        || 0);
    acc.total      += Number(r[cf.total]    || 0);
    acc.totalBrl   += Number(r.TOTAL        || 0);
    acc.totalUsd   += Number(r.TOTAL_USD    || 0);
    acc.sacas      += Number(r.SACAS        || 0);
    acc.cabecas    += Number(r.CABECAS      || 0);
    acc.facs       += Number(r[cf.facs]     || 0);
    acc.fethab     += Number(r[cf.fethab]   || 0);
    acc.funrural   += Number(r[cf.funrural] || 0);
    return acc;
  }, { quant:0, total:0, totalBrl:0, totalUsd:0, sacas:0, cabecas:0, facs:0, fethab:0, funrural:0 });
}

let _rowId = 0;
function nextId() { return 'cr_' + (++_rowId); }

function renderCube(data) {
  _rowId = 0;
  const tbody = document.getElementById('cube-body');
  tbody.innerHTML = '';
  atualizarLabelsMoeda();

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center" style="padding:40px;color:var(--text-muted);">
      <i class="fa-solid fa-inbox" style="font-size:24px;opacity:.3;display:block;margin-bottom:10px;"></i>
      Nenhum dado encontrado para os filtros selecionados.</td></tr>`;
    updateTotals({ quant:0, total:0, sacas:0, facs:0, fethab:0, funrural:0 });
    return;
  }

  const tree   = buildHierarchy(data);
  const totais = sumRows(data);
  const rows   = [];

  const tipoOrder = ['Pecuária','Agricultura','Outros'];
  const tipos = [...tipoOrder.filter(t => tree[t]), ...Object.keys(tree).filter(t => !tipoOrder.includes(t))];

  for (const tipo of tipos) {
    const tipoData = tree[tipo];
    const tipoRows = data.filter(r => (r.TIPO_NEGOCIO || 'Outros') === tipo);
    const tipoTot  = sumRows(tipoRows);
    const tipoId   = nextId();

    const badge = tipo === 'Agricultura' ? 'badge-agro' : tipo === 'Pecuária' ? 'badge-pec' : 'badge-out';
    const iconColor = tipo === 'Agricultura' ? '#10b981' : tipo === 'Pecuária' ? '#f59e0b' : '#94a3b8';

    rows.push(buildRow({
      id: tipoId, parentId: null, level: 0,
      labelHtml: `<button class="toggle-btn" data-group="${tipoId}">▼</button>
        <i class="fa-solid fa-circle-dot" style="color:${iconColor};margin-right:6px;font-size:11px;"></i>
        <span class="${badge}">${tipo}</span>`,
      sums: tipoTot
    }));

    for (const empresa of Object.keys(tipoData)) {
      const empRows = tipoRows.filter(r => r.EMPRESA === empresa);
      const empTot  = sumRows(empRows);
      const empId   = nextId();

      rows.push(buildRow({
        id: empId, parentId: tipoId, level: 1,
        labelHtml: `<button class="toggle-btn" data-group="${empId}">▼</button>
          <i class="fa-solid fa-building" style="margin-right:6px;font-size:11px;color:var(--color-primary)"></i>
          Empresa ${empresa}`,
        sums: empTot
      }));

      const meses = Object.entries(tipoData[empresa]).sort((a, b) => a[1].mesSort - b[1].mesSort);

      for (const [mesKey, mesData] of meses) {
        const mesRows = Object.values(mesData.rows).flat();
        const mesTot  = sumRows(mesRows);
        const mesId   = nextId();

        rows.push(buildRow({
          id: mesId, parentId: empId, level: 2,
          labelHtml: `<button class="toggle-btn" data-group="${mesId}">▼</button>
            <i class="fa-regular fa-calendar" style="margin-right:6px;font-size:11px;"></i>
            ${mesKey}`,
          sums: mesTot
        }));

        for (const [produto, pRows] of Object.entries(mesData.rows)) {
          const pTot = sumRows(pRows);
          const pId  = nextId();

          rows.push(buildRow({
            id: pId, parentId: mesId, level: 3,
            labelHtml: `<span style="display:inline-block;width:10px;height:2px;background:var(--border-color);margin-right:10px;vertical-align:middle;"></span>${produto}`,
            sums: pTot,
            extra: pRows[0] ? {
              cfop:  pRows[0].CFOP  || '—',
              transp: pRows[0].TRANSP || '—',
              cotacao: pRows[0].COTACAO_DOLAR
            } : {}
          }));
        }
      }
    }
  }

  tbody.innerHTML = rows.join('');
  updateTotals(totais);
  attachToggleListeners();
}

function buildRow({ id, parentId, level, labelHtml, sums, extra = {} }) {
  const parentAttr = parentId ? `data-parent="${parentId}"` : '';
  // Cotação visível apenas no nível de produto e somente se USD selecionado
  let cotacaoCell = '';
  if (level === 3 && extra.cotacao != null) {
    cotacaoCell = state.moeda === 'USD'
      ? `<span style="font-size:10px;color:#f59e0b;font-weight:600;" title="PTAX usada">R$${fmtBrl.format(extra.cotacao)}</span>`
      : '';
  }

  let qCell = '';
  if (sums.sacas > 0 && sums.cabecas > 0) {
    qCell = `${fmtN(sums.sacas)} Sc / ${fmtN(sums.cabecas)} Cab`;
  } else if (sums.cabecas > 0) {
    qCell = `${fmtN(sums.cabecas)} Cab`;
  } else {
    qCell = fmtN(sums.sacas);
  }

  const rowDolar = sums.totalUsd > 0 ? (sums.totalBrl / sums.totalUsd) : 0;
  const dolarText = rowDolar > 0 ? fmtCot.format(rowDolar) : '—';

  return `
    <tr id="${id}" ${parentAttr} class="lvl-${level}" data-level="${level}">
      <td style="min-width:280px">${labelHtml}</td>
      <td class="text-right">${fmtN(sums.quant)}</td>
      <td class="text-right" style="font-weight:${level<=1?'600':'400'}">${fmtMoeda(sums.total)}</td>
      <td class="text-right" style="color:#f59e0b;font-weight:600;">${dolarText}</td>
      <td class="text-right">${qCell}</td>
      <td class="text-right">—</td>
      <td class="text-right">${fmtMoeda(sums.facs)}</td>
      <td class="text-right">${fmtMoeda(sums.fethab)}</td>
      <td class="text-right">${fmtMoeda(sums.funrural)}</td>
      <td>${extra.cfop || ''}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;">${cotacaoCell || extra.transp || ''}</td>
    </tr>`;
}

function attachToggleListeners() {
  document.querySelectorAll('#cube-body .toggle-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const groupId  = btn.dataset.group;
      const children = document.querySelectorAll(`#cube-body [data-parent="${groupId}"]`);
      const isExpanded = btn.innerHTML.includes('▼');
      children.forEach(child => {
        if (isExpanded) { child.classList.add('row-hidden');    collapseChildren(child.id); }
        else             { child.classList.remove('row-hidden'); }
      });
      btn.innerHTML = isExpanded ? '▶' : '▼';
    });
  });
}

function collapseChildren(parentId) {
  document.querySelectorAll(`#cube-body [data-parent="${parentId}"]`).forEach(child => {
    child.classList.add('row-hidden');
    collapseChildren(child.id);
    const btn = child.querySelector('.toggle-btn');
    if (btn) btn.innerHTML = '▶';
  });
}

function updateTotals(sums) {
  let qCell = '';
  if (sums.sacas > 0 && sums.cabecas > 0) {
    qCell = `${fmtN(sums.sacas)} Sc / ${fmtN(sums.cabecas)} Cab`;
  } else if (sums.cabecas > 0) {
    qCell = `${fmtN(sums.cabecas)} Cab`;
  } else {
    qCell = fmtN(sums.sacas);
  }

  const totDolar = sums.totalUsd > 0 ? (sums.totalBrl / sums.totalUsd) : 0;
  const dolarText = totDolar > 0 ? fmtCot.format(totDolar) : '—';

  document.getElementById('tot-quant').textContent    = fmtN(sums.quant);
  document.getElementById('tot-total').textContent    = fmtMoeda(sums.total);
  document.getElementById('tot-dolar').textContent    = dolarText;
  document.getElementById('tot-sacas').textContent    = qCell;
  document.getElementById('tot-facs').textContent     = fmtMoeda(sums.facs);
  document.getElementById('tot-fethab').textContent   = fmtMoeda(sums.fethab);
  document.getElementById('tot-funrural').textContent = fmtMoeda(sums.funrural);
}

// ─────────────────────────────────────────────
// TABELA ANUAL — Meses Horizontais
// ─────────────────────────────────────────────
function updateLabelPeriodo() {
  if (!state.resumoAnual) return;
  const hoje     = new Date();
  const anoSafra = getSafraYear(hoje);
  const lbl      = document.getElementById('label-periodo');
  if (lbl) {
    lbl.textContent = state.tipoCalendario === 'safra'
      ? `Safra ${anoSafra-1}/${String(anoSafra).slice(2)}`
      : `Calendário ${hoje.getFullYear()}`;
  }
}

function renderAnualTable() {
  if (!state.resumoAnual) return;
  atualizarLabelsMoeda();

  const hoje        = new Date();
  const anoSafra    = getSafraYear(hoje);
  const mesAtual    = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const prevD       = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnterior = { ano: prevD.getFullYear(), mes: prevD.getMonth() + 1 };

  const meses = state.tipoCalendario === 'safra'
    ? getMesesSafra(anoSafra)
    : getMesesCalendario(hoje.getFullYear());

  const emp = state.empresaFiltro;



  // ── Helpers para obter valor do resumoAnual ──
  function getValor(m, negocio, campo) {
    if (!state.resumoAnual?.meses) return null;
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return null;
    const dEmp = emp === 'TOTAL' ? mesData.porEmpresa['TOTAL'] : mesData.porEmpresa[emp];
    if (!dEmp || !dEmp[negocio]) return null;
    return Number(dEmp[negocio][campo] ?? 0);
  }

  function getValorUsd(m, negocio, campoUsd) {
    if (!state.resumoAnual?.meses) return null;
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return null;
    const dEmp = emp === 'TOTAL' ? mesData.porEmpresa['TOTAL'] : mesData.porEmpresa[emp];
    if (!dEmp || !dEmp[negocio]) return null;
    return Number(dEmp[negocio][campoUsd] ?? 0);
  }

  function getStatus(m) {
    if (!state.resumoAnual?.meses) return 'futuro';
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return 'futuro';
    const dEmp = emp === 'TOTAL' ? mesData.porEmpresa['TOTAL'] : mesData.porEmpresa[emp];
    return dEmp?.status || mesData.status || 'futuro';
  }

  // ── CABEÇALHO ──────────────────────────────
  // Primeira linha: Mês (colspan=4)
  let thHtml = `<tr><th rowspan="2" style="vertical-align:middle; text-align:left;">Métrica <span id="moeda-note" style="display:${state.moeda==='USD'?'inline-flex':'none'};align-items:center;gap:4px;background:rgba(245,158,11,.15);color:#f59e0b;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;">US$ PTAX</span></th>`;
  for (const m of meses) {
    const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    let cls = '';
    if (isAtual)    cls = 'col-atual';
    if (isAnterior) cls = 'col-anterior';
    const label  = `${NOMES_MES[m.mes-1]}/${String(m.ano).slice(2)}`;
    const suffix = isAtual ? ' 🟡' : isAnterior ? ' 🔴' : '';
    thHtml += `<th class="${cls}" colspan="4" style="text-align:center;">${label}${suffix}</th>`;
  }
  thHtml += '<th colspan="4" style="text-align:center;">TOTAL SAFRA</th></tr>';

  // Segunda linha: Negócio (Pecuária, Agrícola, Outros, Total)
  thHtml += '<tr>';
  for (const m of meses) {
    const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    let cls = '';
    if (isAtual)    cls = 'col-atual';
    if (isAnterior) cls = 'col-anterior';
    thHtml += `<th class="${cls}" style="font-size:10px;text-align:center;background:rgba(255,255,255,0.02);">Pec.</th>`;
    thHtml += `<th class="${cls}" style="font-size:10px;text-align:center;background:rgba(255,255,255,0.02);">Agri.</th>`;
    thHtml += `<th class="${cls}" style="font-size:10px;text-align:center;background:rgba(255,255,255,0.02);">Outr.</th>`;
    thHtml += `<th class="${cls}" style="font-size:10px;text-align:center;font-weight:700;background:rgba(255,255,255,0.05);">Total</th>`;
  }
  thHtml += `<th style="font-size:10px;text-align:center;background:rgba(255,255,255,0.02);">Pec.</th>`;
  thHtml += `<th style="font-size:10px;text-align:center;background:rgba(255,255,255,0.02);">Agri.</th>`;
  thHtml += `<th style="font-size:10px;text-align:center;background:rgba(255,255,255,0.02);">Outr.</th>`;
  thHtml += `<th style="font-size:10px;text-align:center;font-weight:700;background:rgba(255,255,255,0.05);">Total</th>`;
  thHtml += '</tr>';
  document.getElementById('anual-thead').innerHTML = thHtml;

  // Helper para renderizar cada linha de métrica
  function renderMetricaRow(label, fieldBrl, fieldUsd, formatFn, isTax = false, isDollar = false) {
    let rowHtml = `<tr><td style="font-weight:${isTax ? 'normal' : '600'}; padding-left:${isTax ? '20px' : '10px'};">${label}</td>`;
    const segs = ['Pecuaria', 'Agricola', 'Outros', 'Total'];
    const segmentTotals = { Pecuaria: 0, Agricola: 0, Outros: 0, Total: 0 };

    for (const m of meses) {
      const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
      const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
      const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      let cls = '';
      if (isAtual)    cls = 'col-atual';
      if (isAnterior) cls = 'col-anterior';

      for (const seg of segs) {
        if (isFuturo) {
          rowHtml += `<td class="${cls}" style="text-align:center;color:#475569;">—</td>`;
          continue;
        }

        let val = null;
        if (isDollar) {
          val = getValor(m, seg, 'dolarMedio') || getValor(m, 'Total', 'dolarMedio') || 0;
        } else if (state.moeda === 'USD' && fieldUsd) {
          val = getValorUsd(m, seg, fieldUsd);
        } else {
          val = getValor(m, seg, fieldBrl);
        }

        if (!isDollar) {
          segmentTotals[seg] += Number(val || 0);
        }

        let valStr = '—';
        if (val !== null && val !== 0) {
          valStr = formatFn(val);
          if (isTax && val > 0) {
            valStr = `-${valStr}`;
          }
        }
        
        let style = 'text-align:right;';
        if (seg === 'Total') style += 'font-weight:700;background:rgba(255,255,255,0.03);';
        rowHtml += `<td class="${cls}" style="${style}">${valStr}</td>`;
      }
    }

    // Totais Safra (Fim da linha)
    for (const seg of segs) {
      let totalVal = segmentTotals[seg];
      if (isDollar) {
        let sumBrl = 0;
        let sumUsd = 0;
        for (const m of meses) {
          if (new Date(m.ano, m.mes-1, 1) > hoje) continue;
          sumBrl += getValor(m, seg, 'receita') || 0;
          sumUsd += getValorUsd(m, seg, 'receitaUsd') || 0;
        }
        totalVal = sumUsd > 0 ? (sumBrl / sumUsd) : 0;
      }

      let valStr = totalVal !== 0 ? formatFn(totalVal) : '—';
      if (isTax && totalVal > 0) valStr = `-${valStr}`;
      
      let style = 'text-align:right;font-weight:700;background:rgba(255,255,255,0.06);';
      if (seg === 'Total') style += 'font-weight:800;background:rgba(255,255,255,0.09);';
      rowHtml += `<td class="col-total" style="${style}">${valStr}</td>`;
    }

    rowHtml += '</tr>';
    return rowHtml;
  }

  function renderTotalizerRow() {
    let rowHtml = `<tr style="border-top:1.5px solid rgba(255,255,255,0.15); border-bottom:1.5px solid rgba(255,255,255,0.15); background:rgba(16,185,129,0.08);"><td style="font-weight:700;color:#10b981;padding-left:10px;">📊 Totalizador (Rec. Líquida)</td>`;
    const segs = ['Pecuaria', 'Agricola', 'Outros', 'Total'];
    const segmentTotals = { Pecuaria: 0, Agricola: 0, Outros: 0, Total: 0 };

    for (const m of meses) {
      const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
      const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
      const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      let cls = '';
      if (isAtual)    cls = 'col-atual';
      if (isAnterior) cls = 'col-anterior';

      for (const seg of segs) {
        if (isFuturo) {
          rowHtml += `<td class="${cls}" style="text-align:center;color:#475569;">—</td>`;
          continue;
        }

        let rec, fac, fet, fun;
        if (state.moeda === 'USD') {
          rec = getValorUsd(m, seg, 'receitaUsd') || 0;
          fac = getValorUsd(m, seg, 'vlrFacsUsd') || 0;
          fet = getValorUsd(m, seg, 'fethabUsd') || 0;
          fun = getValorUsd(m, seg, 'funruralUsd') || 0;
        } else {
          rec = getValor(m, seg, 'receita') || 0;
          fac = getValor(m, seg, 'vlrFacs') || 0;
          fet = getValor(m, seg, 'fethab') || 0;
          fun = getValor(m, seg, 'funrural') || 0;
        }

        const net = rec - fac - fet - fun;
        segmentTotals[seg] += net;

        let style = 'text-align:right;font-weight:700;color:#10b981;';
        if (seg === 'Total') style += 'font-weight:800;background:rgba(255,255,255,0.03);';
        rowHtml += `<td class="${cls}" style="${style}">${net !== 0 ? fmtMoeda(net) : '—'}</td>`;
      }
    }

    // Totais Safra para o totalizer
    for (const seg of segs) {
      const val = segmentTotals[seg];
      let style = 'text-align:right;font-weight:800;color:#10b981;background:rgba(255,255,255,0.06);';
      if (seg === 'Total') style += 'font-weight:900;background:rgba(255,255,255,0.1);';
      rowHtml += `<td class="col-total" style="${style}">${val !== 0 ? fmtMoeda(val) : '—'}</td>`;
    }

    rowHtml += '</tr>';
    return rowHtml;
  }

  // Montar linhas da tabela
  let rows = '';
  rows += renderMetricaRow('💰 Receita de Vendas', 'receita', 'receitaUsd', fmtMoeda);
  rows += renderMetricaRow('(-) FACS', 'vlrFacs', 'vlrFacsUsd', fmtMoeda, true);
  rows += renderMetricaRow('(-) FETHAB', 'fethab', 'fethabUsd', fmtMoeda, true);
  rows += renderMetricaRow('(-) FUNRURAL', 'funrural', 'funruralUsd', fmtMoeda, true);
  rows += renderTotalizerRow();
  rows += renderMetricaRow('📦 Sacas', 'sacas', null, fmtN);
  rows += renderMetricaRow('🐄 Cabeças', 'cabecas', null, fmtN);
  rows += renderMetricaRow('💵 Valor Dólar', 'dolarMedio', null, v => fmtCot.format(v), false, true);

  // ── Linha de Status ──────────────────────────
  rows += `<tr class="section-row"><td colspan="53" style="font-weight:700;background:rgba(255,255,255,0.02);padding:6px 10px;">Status de Fechamento</td></tr>`;
  rows += '<tr class="status-row"><td>Status</td>';
  for (const m of meses) {
    const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
    const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    let cls = '';
    if (isAtual)    cls = 'col-atual';
    if (isAnterior) cls = 'col-anterior';
    const status = isFuturo ? 'futuro' : getStatus(m);

    let icon = '—';
    if      (status === 'fechado')             icon = '<span style="color:#10b981;font-size:12px;">✅ Fechado</span>';
    else if (status === 'dinamico_atual')       icon = '<span style="color:#3b82f6;font-size:12px;">🟡 Em Curso</span>';
    else if (status === 'dinamico_anterior')    icon = '<span style="color:#f59e0b;font-size:12px;">🔴 Pendente</span>';
    else if (status === 'aguardando')           icon = '<span style="color:#64748b;font-size:12px;">⬜ Sem dados</span>';

    rows += `<td class="${cls}" colspan="4" style="text-align:center;">${icon}</td>`;
  }
  rows += '<td class="col-total" colspan="4" style="text-align:center;">—</td></tr>';

  // ── Linha de Ações ────────────────────────────
  rows += '<tr class="action-row"><td>Ação</td>';
  for (const m of meses) {
    const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
    let cls = '';
    if (isAtual)    cls = 'col-atual';
    if (isAnterior) cls = 'col-anterior';
    const status = isFuturo ? 'futuro' : getStatus(m);

    let action = '';
    if (isAnterior && status !== 'fechado') {
      const recValor = getValor(m, 'Total', 'receita') || 0;
      const sacasVal = getValor(m, 'Total', 'sacas')   || 0;
      const cabecasVal = getValor(m, 'Total', 'cabecas') || 0;
      const nfsVal   = getValor(m, 'Total', 'qtdNfs')  || 0;
      const funVal   = getValor(m, 'Total', 'funrural') || 0;
      action = `<button class="btn btn-sm btn-success"
        onclick="abrirModalFechar(${m.mes},${m.ano},'${emp}',${recValor},${sacasVal},${cabecasVal},${nfsVal},${funVal})"
        style="font-size:11px;padding:4px 10px;">
        <i class="fa-solid fa-lock"></i> Fechar Mês
      </button>`;
    } else if (status === 'fechado') {
      const recValor = getValor(m, 'Total', 'receita') || 0;
      const sacasVal = getValor(m, 'Total', 'sacas')   || 0;
      const cabecasVal = getValor(m, 'Total', 'cabecas') || 0;
      const nfsVal   = getValor(m, 'Total', 'qtdNfs')  || 0;
      const funVal   = getValor(m, 'Total', 'funrural') || 0;
      if (isAnterior) {
        action = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
            <span style="font-size:11px;color:#10b981;font-weight:600;">✔ Fechado</span>
            <button class="btn btn-sm btn-secondary"
              onclick="abrirModalFechar(${m.mes},${m.ano},'${emp}',${recValor},${sacasVal},${cabecasVal},${nfsVal},${funVal})"
              style="font-size:9px;padding:2px 6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#cbd5e1;cursor:pointer;">
              <i class="fa-solid fa-arrows-rotate"></i> Refazer
            </button>
          </div>
        `;
      } else {
        action = `
          <span style="font-size:11px;color:#10b981;font-weight:600;">✔ Fechado</span>
        `;
      }
    }
    rows += `<td class="${cls}" colspan="4" style="text-align:center;">${action}</td>`;
  }
  rows += '<td class="col-total" colspan="4"></td></tr>';

  document.getElementById('anual-tbody').innerHTML = rows;
}

// ─────────────────────────────────────────────
// Modal de Fechamento
// ─────────────────────────────────────────────
function abrirModalFechar(mes, ano, empresa, receita, sacas, cabecas, nfs, funrural) {
  state.fecharPending = { mes, ano, empresa };
  document.getElementById('modal-mes-ano').textContent  = `${NOMES_MES[mes-1]}/${ano}`;
  document.getElementById('modal-empresa').textContent  = empresa;
  document.getElementById('modal-receita').textContent  = fmtMoeda(receita);
  
  let qCell = '';
  if (sacas > 0 && cabecas > 0) {
    qCell = `${fmtN(sacas)} Sc / ${fmtN(cabecas)} Cab`;
  } else if (cabecas > 0) {
    qCell = `${fmtN(cabecas)} Cab`;
  } else {
    qCell = fmtN(sacas);
  }
  document.getElementById('modal-sacas').textContent    = qCell;
  document.getElementById('modal-nfs').textContent      = Number(nfs).toLocaleString('pt-BR');
  document.getElementById('modal-funrural').textContent = fmtMoeda(funrural);
  document.getElementById('modal-fechar').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-fechar').classList.remove('open');
  state.fecharPending = null;
}

async function confirmarFechamento() {
  if (!state.fecharPending) return;
  const { mes, ano, empresa } = state.fecharPending;
  const btnConfirm = document.getElementById('btn-confirm-fechar');
  btnConfirm.disabled = true;
  btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gravando…';

  try {
    const resp = await fetch('/api/receita/fechar-mes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa: empresa === 'TOTAL' ? 'TODAS' : empresa, mes, ano })
    });
    const json = await resp.json();
    if (json.success) {
      closeModal();
      showToast('✅ Mês fechado com sucesso!', 'success');
      const anoSafra = getSafraYear(new Date());
      const resAnual = await fetch(
        `/api/receita/resumo-anual?ano_safra=${anoSafra}&tipo=${state.tipoCalendario}`
      ).then(r => r.json());
      if (resAnual.success) { state.resumoAnual = resAnual; renderAnualTable(); }
    } else {
      showToast('❌ Erro: ' + json.error, 'error');
    }
  } catch(err) {
    showToast('❌ Falha na conexão com o servidor.', 'error');
  } finally {
    btnConfirm.disabled = false;
    btnConfirm.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Fechamento';
  }
}

// ─────────────────────────────────────────────
// Utilitários UI
// ─────────────────────────────────────────────
function setLoading(section, active) {
  const id = section === 'cube' ? 'loading-cube' : 'loading-anual';
  const el = document.getElementById(id);
  if (el) el.classList.toggle('active', active);
}

function showError(section, msg) {
  const bodyId = section === 'cube' ? 'cube-body' : 'anual-tbody';
  const el = document.getElementById(bodyId);
  if (el) {
    el.innerHTML = `<tr><td colspan="14" class="text-center" style="padding:40px;color:#ef4444;">
      <i class="fa-solid fa-triangle-exclamation" style="font-size:24px;display:block;margin-bottom:10px;"></i>
      ${msg}</td></tr>`;
  }
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  const color = type === 'success' ? '#10b981' : '#ef4444';
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:999;
    background:var(--bg-card);border:1px solid ${color};
    color:${color};padding:14px 22px;border-radius:10px;
    font-weight:600;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.3);
    animation:fadeIn .3s ease;`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

document.getElementById('modal-fechar')?.addEventListener('click', e => {
  if (e.target.id === 'modal-fechar') closeModal();
});

// ─────────────────────────────────────────────
// Ajustes Manuais (CRUD)
// ─────────────────────────────────────────────
let _closedFechamentosList = [];

async function loadClosedFechamentos() {
  const body = document.getElementById('edit-fechamento-list-body');
  body.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>`;
  
  try {
    const res = await fetch('/api/receita/fechados');
    const json = await res.json();
    if (json.success) {
      _closedFechamentosList = json.data;
      renderClosedFechamentosList(json.data);
    } else {
      body.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--color-danger)">Erro: ${json.error}</td></tr>`;
    }
  } catch(e) {
    body.innerHTML = `<tr><td colspan="5" class="text-center" style="color:var(--color-danger)">Erro de conexão.</td></tr>`;
  }
}

function renderClosedFechamentosList(data) {
  const body = document.getElementById('edit-fechamento-list-body');
  if (data.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="text-center">Nenhum fechamento localizado no banco.</td></tr>`;
    return;
  }
  
  body.innerHTML = data.map(item => {
    const periodoStr = `${NOMES_MES[item.FR_MES - 1]}/${item.FR_ANO}`;
    return `
      <tr>
        <td>${periodoStr}</td>
        <td>${escapeHTML(item.FR_EMPRESA)}</td>
        <td>${escapeHTML(item.FR_NEGOCIO || '—')}</td>
        <td class="text-right">${Number(item.FR_RECEITA_TOTAL || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="openEditForm(${item.FR_ID})">
            <i class="fa-solid fa-pencil"></i> Editar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Global para chamar via onclick inline
window.openEditForm = function(id) {
  const item = _closedFechamentosList.find(x => x.FR_ID === id);
  if (!item) return;
  
  document.getElementById('edit-fr-id').value = item.FR_ID;
  document.getElementById('edit-fr-periodo').value = `${NOMES_MES[item.FR_MES - 1]}/${item.FR_ANO}`;
  document.getElementById('edit-fr-filial').value = item.FR_EMPRESA;
  document.getElementById('edit-fr-negocio').value = item.FR_NEGOCIO || '—';
  
  document.getElementById('edit-fr-receita').value = item.FR_RECEITA_TOTAL || 0;
  document.getElementById('edit-fr-sacas').value = item.FR_SACAS || 0;
  document.getElementById('edit-fr-dolar').value = item.FR_DOLAR_MEDIO || 0;
  document.getElementById('edit-fr-funrural').value = item.FR_FUNRURAL || 0;
  document.getElementById('edit-fr-fethab').value = item.FR_FETHAB || 0;
  document.getElementById('edit-fr-facs').value = item.FR_VLR_FACS || 0;
  document.getElementById('edit-fr-nfs').value = item.FR_QTD_NFS || 0;
  
  document.getElementById('edit-fr-agro-receita').value = item.FR_AGRO_RECEITA || 0;
  document.getElementById('edit-fr-agro-sacas').value = item.FR_AGRO_SACAS || 0;
  document.getElementById('edit-fr-pec-receita').value = item.FR_PEC_RECEITA || 0;
  document.getElementById('edit-fr-pec-sacas').value = item.FR_PEC_SACAS || 0;
  document.getElementById('edit-fr-outros-receita').value = item.FR_OUTROS_RECEITA || 0;
  document.getElementById('edit-fr-outros-sacas').value = item.FR_OUTROS_SACAS || 0;
  
  document.getElementById('edit-fr-obs').value = item.FR_OBS || '';
  
  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
};

async function saveFechamentoForm() {
  const id = document.getElementById('edit-fr-id').value;
  const btnSave = document.getElementById('btn-save-edit-form');
  btnSave.disabled = true;
  btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
  
  const payload = {
    receitaTotal: Number(document.getElementById('edit-fr-receita').value || 0),
    sacas: Number(document.getElementById('edit-fr-sacas').value || 0),
    dolarMedio: Number(document.getElementById('edit-fr-dolar').value || 0),
    funrural: Number(document.getElementById('edit-fr-funrural').value || 0),
    fethab: Number(document.getElementById('edit-fr-fethab').value || 0),
    vlrFacs: Number(document.getElementById('edit-fr-facs').value || 0),
    qtdNfs: parseInt(document.getElementById('edit-fr-nfs').value || 0, 10),
    agroReceita: Number(document.getElementById('edit-fr-agro-receita').value || 0),
    agroSacas: Number(document.getElementById('edit-fr-agro-sacas').value || 0),
    pecReceita: Number(document.getElementById('edit-fr-pec-receita').value || 0),
    pecSacas: Number(document.getElementById('edit-fr-pec-sacas').value || 0),
    outrosReceita: Number(document.getElementById('edit-fr-outros-receita').value || 0),
    outrosSacas: Number(document.getElementById('edit-fr-outros-sacas').value || 0),
    obs: document.getElementById('edit-fr-obs').value
  };
  
  try {
    const res = await fetch(`/api/receita/fechamento/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      showToast('✅ Lançamento atualizado com sucesso!', 'success');
      document.getElementById('edit-fechamento-form-view').style.display = 'none';
      document.getElementById('edit-fechamento-list-view').style.display = 'block';
      loadClosedFechamentos();
      loadAll(); // Atualiza dashboard principal!
    } else {
      showToast('❌ Erro: ' + json.error, 'error');
    }
  } catch(e) {
    showToast('❌ Falha na conexão com o servidor.', 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações';
  }
}

function closeEditFechamentoModal() {
  document.getElementById('modal-edit-fechamento').classList.remove('open');
  document.getElementById('edit-fechamento-form-view').style.display = 'none';
  document.getElementById('edit-fechamento-list-view').style.display = 'block';
}

function escapeHTML(str) {
  if (str === undefined || str === null) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

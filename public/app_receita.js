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
  allData:        [],        // dados brutos do Oracle
  resumoAnual:    null,      // resposta do /api/receita/resumo-anual
  fecharPending:  null,      // { mes, ano, empresa }
};

const fmtBrl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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
  document.getElementById('btn-toggle-cal').addEventListener('click', () => {
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
  document.querySelectorAll('.moeda-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.moeda-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.moeda = btn.dataset.moeda;
      atualizarLabelsMoeda();
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
      renderCube(filtered);
      renderAnualTable();
    });
  });

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', loadAll);

  // Filtros
  document.getElementById('filtros-toggle-header').addEventListener('click', () => {
    document.getElementById('filtros-section').classList.toggle('filters-collapsed');
  });
  document.getElementById('btn-apply-filters').addEventListener('click', () => {
    const filtered = applyFilters(state.allData);
    renderCube(filtered);
    updateKpis(filtered);
  });
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    ['f-tipo-negocio','f-empresa','f-cfop','f-produto','f-periodo-mes'].forEach(id => {
      const el = document.getElementById(id);
      if (el.tagName === 'SELECT') el.value = el.options[0].value;
      else el.value = '';
    });
    renderCube(state.allData);
    updateKpis(state.allData);
  });

  // Expand / Collapse cubo
  document.getElementById('btn-expand-all').addEventListener('click', () => {
    document.querySelectorAll('#cube-body .row-hidden').forEach(r => r.classList.remove('row-hidden'));
    document.querySelectorAll('#cube-body .toggle-btn').forEach(b => b.innerHTML = '▼');
  });
  document.getElementById('btn-collapse-all').addEventListener('click', () => {
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
  document.getElementById('btn-cancel-fechar').addEventListener('click', closeModal);
  document.getElementById('btn-confirm-fechar').addEventListener('click', confirmarFechamento);
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
  const periodo = document.getElementById('f-periodo-mes').value; // 'todos' | 'anterior' | 'atual'

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const prevD = new Date(anoAtual, mesAtual - 1, 1);
  const mesAnt = prevD.getMonth();
  const anoAnt = prevD.getFullYear();

  return data.filter(r => {
    if (tipo    !== 'todos'  && r.TIPO_NEGOCIO !== tipo)                 return false;
    if (empresa !== 'todas'  && r.EMPRESA !== empresa)                   return false;
    if (cfop    && !(r.CFOP    || '').toUpperCase().includes(cfop))      return false;
    if (produto && !(r.PRODUTO || '').toUpperCase().includes(produto))   return false;

    if (periodo !== 'todos') {
      if (!r.EMISSAO) return false;
      const d = new Date(r.EMISSAO);
      // O Date construído a partir de ISO string 'YYYY-MM-DDT00:00:00.000Z' pode ser interpretado em UTC.
      // Para evitar problemas de timezone com as datas do banco (que não têm timezone),
      // usamos os métodos getUTCDate e getUTCMonth se a string vier como ISO.
      // Vamos verificar e comparar usando getUTCMonth / getUTCFullYear ou getMonth / getFullYear de forma segura.
      // Já que no backend convertemos to_date(F2_EMISSAO,'yyyymmdd'), ele vem como data do Oracle que o driver node-oracledb
      // retorna como um objeto Date local ou UTC dependendo da config.
      // Como o objeto já é uma instância Date em JS, vamos extrair mês/ano do objeto.
      const m = d.getMonth();
      const y = d.getFullYear();
      if (periodo === 'atual') {
        if (m !== mesAtual || y !== anoAtual) return false;
      } else if (periodo === 'anterior') {
        if (m !== mesAnt || y !== anoAnt) return false;
      }
    }
    return true;
  });
}

// ─────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────
function updateKpis(data) {
  const cf = campos();
  let receita=0, sacas=0, cabecas=0, funrural=0, fethab=0;
  const nfsSet = new Set();

  for (const r of data) {
    receita  += Number(r[cf.total]    || 0);
    sacas    += Number(r.SACAS        || 0);
    cabecas  += Number(r.CABECAS      || 0);
    funrural += Number(r[cf.funrural] || 0);
    fethab   += Number(r[cf.fethab]   || 0);
    if (r.NF) nfsSet.add(r.NF);
  }
  
  let ticket = 0;
  if (sacas > 0 && cabecas > 0) {
    ticket = receita / (sacas + cabecas);
  } else if (cabecas > 0) {
    ticket = receita / cabecas;
  } else if (sacas > 0) {
    ticket = receita / sacas;
  }

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
  
  document.getElementById('kpi-nfs').textContent       = nfsSet.size.toLocaleString('pt-BR');
  document.getElementById('kpi-ticket').textContent    = fmtMoeda(ticket);
  document.getElementById('kpi-funrural').textContent  = fmtMoeda(funrural);
  document.getElementById('kpi-fethab').textContent    = fmtMoeda(fethab);
  document.getElementById('kpi-receita-sub').textContent =
    `${data.length.toLocaleString('pt-BR')} registros | ${state.moeda === 'USD' ? 'Valores em USD (PTAX)' : 'Valores em BRL'}`;
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
    acc.quant    += Number(r.QUANT        || 0);
    acc.total    += Number(r[cf.total]    || 0);
    acc.sacas    += Number(r.SACAS        || 0);
    acc.cabecas  += Number(r.CABECAS      || 0);
    acc.facs     += Number(r[cf.facs]     || 0);
    acc.fethab   += Number(r[cf.fethab]   || 0);
    acc.funrural += Number(r[cf.funrural] || 0);
    return acc;
  }, { quant:0, total:0, sacas:0, cabecas:0, facs:0, fethab:0, funrural:0 });
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

  return `
    <tr id="${id}" ${parentAttr} class="lvl-${level}" data-level="${level}">
      <td style="min-width:280px">${labelHtml}</td>
      <td class="text-right">${fmtN(sums.quant)}</td>
      <td class="text-right" style="font-weight:${level<=1?'600':'400'}">${fmtMoeda(sums.total)}</td>
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

  document.getElementById('tot-quant').textContent    = fmtN(sums.quant);
  document.getElementById('tot-total').textContent    = fmtMoeda(sums.total);
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

  // ── CABEÇALHO ──────────────────────────────
  let thHtml = `<tr><th>Métrica <span id="moeda-note" style="display:${state.moeda==='USD'?'inline-flex':'none'};align-items:center;gap:4px;background:rgba(245,158,11,.15);color:#f59e0b;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;">US$ PTAX</span></th>`;
  for (const m of meses) {
    const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
    const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    let cls = '';
    if (isAtual)    cls = 'col-atual';
    if (isAnterior) cls = 'col-anterior';
    const label  = `${NOMES_MES[m.mes-1]}/${String(m.ano).slice(2)}`;
    const suffix = isAtual ? ' 🟡' : isAnterior ? ' 🔴' : isFuturo ? '' : '';
    thHtml += `<th class="${cls}" title="${m.mes}/${m.ano}" data-mes="${m.mes}" data-ano="${m.ano}">${label}${suffix}</th>`;
  }
  thHtml += '<th class="col-total">TOTAL</th></tr>';
  document.getElementById('anual-thead').innerHTML = thHtml;

  // ── Helpers para obter valor do resumoAnual ──
  function getValor(m, campo) {
    if (!state.resumoAnual?.meses) return null;
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return null;
    const dEmp = emp === 'TOTAL' ? mesData.porEmpresa['TOTAL'] : mesData.porEmpresa[emp];
    if (!dEmp) return null;
    return Number(dEmp[campo] ?? 0);
  }

  function getValorUsd(m, campoUsd) {
    // USD disponível apenas para meses dinâmicos (não fechados)
    if (!state.resumoAnual?.meses) return null;
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return null;
    const dEmp = emp === 'TOTAL' ? mesData.porEmpresa['TOTAL'] : mesData.porEmpresa[emp];
    if (!dEmp) return null;
    // Meses fechados não têm USD ainda → retornar null
    if (dEmp.status === 'fechado') return null;
    return Number(dEmp[campoUsd] ?? 0);
  }

  function getStatus(m) {
    if (!state.resumoAnual?.meses) return 'futuro';
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return 'futuro';
    const dEmp = emp === 'TOTAL' ? mesData.porEmpresa['TOTAL'] : mesData.porEmpresa[emp];
    return dEmp?.status || mesData.status || 'futuro';
  }

  // ── Métricas ──────────────────────────────
  const metricas = [
    { brl: 'receita',  usd: 'receitaUsd',  label: '💰 Receita Total',     format: fmtMoeda },
    { brl: 'sacas',    usd: null,           label: '📦 Sacas',              format: fmtN     },
    { brl: 'cabecas',  usd: null,           label: '🐄 Cabeças',            format: fmtN     },
    { brl: 'qtdNfs',   usd: null,           label: '📄 Nº de NFs',          format: v => Number(v).toLocaleString('pt-BR') },
    { brl: 'funrural', usd: 'funruralUsd',  label: '🌿 FUNRURAL',           format: fmtMoeda },
    { brl: 'fethab',   usd: 'fethabUsd',    label: '🚛 FETHAB',             format: fmtMoeda },
    { brl: 'vlrFacs',  usd: 'vlrFacsUsd',  label: '📋 Vlr. FACS',          format: fmtMoeda },
  ];

  let rows = '';

  for (const metrica of metricas) {
    let totalAcum = 0;
    let rowHtml   = `<tr><td>${metrica.label}</td>`;

    for (const m of meses) {
      const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
      const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
      const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      let cls = '';
      if (isAtual)    cls = 'col-atual';
      if (isAnterior) cls = 'col-anterior';

      if (isFuturo) {
        rowHtml += `<td class="${cls}">—</td>`;
        continue;
      }

      let val;
      if (state.moeda === 'USD' && metrica.usd) {
        val = getValorUsd(m, metrica.usd);
        if (val === null) {
          // Mês fechado sem USD armazenado → sinalizar
          rowHtml += `<td class="${cls}" style="text-align:right;font-size:11px;color:#64748b;font-style:italic;" title="Mês fechado — USD não disponível">BRL</td>`;
          continue;
        }
      } else {
        val = getValor(m, metrica.brl);
      }

      totalAcum += Number(val || 0);
      rowHtml += `<td class="${cls}" style="text-align:right;">${val != null ? metrica.format(val) : '—'}</td>`;
    }

    rowHtml += `<td class="col-total">${metrica.format(totalAcum)}</td></tr>`;
    rows += rowHtml;
  }

  // ── Linha de Status ──────────────────────────
  rows += `<tr class="section-row"><td colspan="${meses.length + 2}">Status de Fechamento</td></tr>`;
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

    rows += `<td class="${cls}" style="text-align:center;">${icon}</td>`;
  }
  rows += '<td class="col-total">—</td></tr>';

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
      const recValor = getValor(m, 'receita') || 0;
      const sacasVal = getValor(m, 'sacas')   || 0;
      const cabecasVal = getValor(m, 'cabecas') || 0;
      const nfsVal   = getValor(m, 'qtdNfs')  || 0;
      const funVal   = getValor(m, 'funrural') || 0;
      action = `<button class="btn btn-sm btn-success"
        onclick="abrirModalFechar(${m.mes},${m.ano},'${emp}',${recValor},${sacasVal},${cabecasVal},${nfsVal},${funVal})"
        style="font-size:11px;padding:4px 10px;">
        <i class="fa-solid fa-lock"></i> Fechar Mês
      </button>`;
    } else if (status === 'fechado') {
      action = `<span style="font-size:11px;color:#10b981;font-weight:600;">✔ Fechado</span>`;
    }
    rows += `<td class="${cls}">${action}</td>`;
  }
  rows += '<td class="col-total"></td></tr>';

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

/**
 * app_receita.js — Lógica completa da tela de Receitas (Fechamento Financeiro)
 * Funcionalidades:
 *  - KPI Cards  (totais período)
 *  - Cubo Pivot drill-down (Tipo Negócio > Empresa > Mês > Produto > Detalhe NF)
 *  - Tabela Anual horizontal (meses como colunas)
 *  - Filtros (tipo negócio, empresa, cfop, produto)
 *  - Alternância Calendário Agrícola (Set-Ago) ↔ Contábil (Jan-Dez)
 *  - Modal de Fechamento do mês anterior
 */

// ─────────────────────────────────────────────
// Constantes e Estado Global
// ─────────────────────────────────────────────
const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const state = {
  tipoCalendario: 'safra',      // 'safra' | 'calendario'
  empresaFiltro:  'TOTAL',       // 'TOTAL' | '028501' | '028503'
  allData:        [],            // dados brutos do Oracle
  resumoAnual:    null,          // resposta do /api/receita/resumo-anual
  fecharPending:  null,          // { mes, ano, empresa } aguardando confirmação
};

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = v => v == null || isNaN(v) ? '—' : 'R$ ' + fmt.format(v);
const fmtN = v => v == null || isNaN(v) ? '—' : fmt.format(v);

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
    const btn  = document.getElementById('btn-toggle-cal');
    const lbl  = document.getElementById('label-cal');
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

  // Refresh
  document.getElementById('btn-refresh').addEventListener('click', loadAll);

  // Filtros
  document.getElementById('filtros-toggle-header').addEventListener('click', () => {
    document.getElementById('filtros-section').classList.toggle('filters-collapsed');
  });
  document.getElementById('btn-apply-filters').addEventListener('click', () => {
    renderCube(applyFilters(state.allData));
    updateKpis(applyFilters(state.allData));
  });
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    ['f-tipo-negocio','f-empresa','f-cfop','f-produto'].forEach(id => {
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

// ─────────────────────────────────────────────
// Carregamento de Dados
// ─────────────────────────────────────────────
async function loadAll() {
  const hoje     = new Date();
  const anoSafra = getSafraYear(hoje);

  setLoading('cube', true);
  setLoading('anual', true);

  try {
    // Cubo: dados brutos da safra inteira
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
    showError('cube', 'Falha na conexão com o servidor.');
  } finally {
    setLoading('cube', false);
    setLoading('anual', false);
  }
}

function applyFilters(data) {
  const tipo    = document.getElementById('f-tipo-negocio').value;
  const empresa = document.getElementById('f-empresa').value;
  const cfop    = document.getElementById('f-cfop').value.trim().toUpperCase();
  const produto = document.getElementById('f-produto').value.trim().toUpperCase();

  return data.filter(r => {
    if (tipo    !== 'todos'  && r.TIPO_NEGOCIO !== tipo)                          return false;
    if (empresa !== 'todas'  && r.EMPRESA !== empresa)                            return false;
    if (cfop    && !(r.CFOP || '').toUpperCase().includes(cfop))                  return false;
    if (produto && !(r.PRODUTO || '').toUpperCase().includes(produto))            return false;
    return true;
  });
}

// ─────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────
function updateKpis(data) {
  let receita=0, sacas=0, funrural=0, fethab=0;
  const nfsSet = new Set();
  for (const r of data) {
    receita  += Number(r.TOTAL       || 0);
    sacas    += Number(r.SACAS       || 0);
    funrural += Number(r.VL_FUNRURAL || 0);
    fethab   += Number(r.VLR_FETHAB  || 0);
    if (r.NF) nfsSet.add(r.NF);
  }
  const ticket = sacas > 0 ? receita / sacas : 0;

  document.getElementById('kpi-receita').textContent   = fmtK(receita);
  document.getElementById('kpi-sacas').textContent     = fmtN(sacas);
  document.getElementById('kpi-nfs').textContent       = nfsSet.size.toLocaleString('pt-BR');
  document.getElementById('kpi-ticket').textContent    = fmtK(ticket);
  document.getElementById('kpi-funrural').textContent  = fmtK(funrural);
  document.getElementById('kpi-fethab').textContent    = fmtK(fethab);

  document.getElementById('kpi-receita-sub').textContent =
    `${data.length.toLocaleString('pt-BR')} registros`;
}

// ─────────────────────────────────────────────
// CUBO PIVOT — Drill-down
// ─────────────────────────────────────────────
function buildHierarchy(data) {
  // Estrutura: tipo -> empresa -> mes -> produto -> [rows]
  const tree = {};
  for (const r of data) {
    const tipo    = r.TIPO_NEGOCIO || 'Outros';
    const empresa = r.EMPRESA      || '—';
    const emissao = r.EMISSAO ? new Date(r.EMISSAO) : null;
    const mesKey  = emissao
      ? `${NOMES_MES[emissao.getMonth()]}/${emissao.getFullYear()}`
      : '—';
    const mesSort = emissao
      ? emissao.getFullYear() * 100 + emissao.getMonth() + 1
      : 0;
    const produto = (r.PRODUTO || '—').trim();

    if (!tree[tipo])                        tree[tipo]                        = {};
    if (!tree[tipo][empresa])               tree[tipo][empresa]               = {};
    if (!tree[tipo][empresa][mesKey])       tree[tipo][empresa][mesKey]       = { rows: {}, mesSort };
    if (!tree[tipo][empresa][mesKey].rows[produto])
                                            tree[tipo][empresa][mesKey].rows[produto] = [];
    tree[tipo][empresa][mesKey].rows[produto].push(r);
  }
  return tree;
}

function sumRows(rows) {
  return rows.reduce((acc, r) => {
    acc.quant    += Number(r.QUANT       || 0);
    acc.total    += Number(r.TOTAL       || 0);
    acc.sacas    += Number(r.SACAS       || 0);
    acc.facs     += Number(r.VLR_FACS    || 0);
    acc.fethab   += Number(r.VLR_FETHAB  || 0);
    acc.funrural += Number(r.VL_FUNRURAL || 0);
    return acc;
  }, { quant:0, total:0, sacas:0, facs:0, fethab:0, funrural:0 });
}

let _rowId = 0;
function nextId() { return 'cr_' + (++_rowId); }

function renderCube(data) {
  _rowId = 0;
  const tbody = document.getElementById('cube-body');
  tbody.innerHTML = '';

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
    const empresaIds = [];

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
      empresaIds.push(empId);

      rows.push(buildRow({
        id: empId, parentId: tipoId, level: 1,
        labelHtml: `<button class="toggle-btn" data-group="${empId}">▼</button>
          <i class="fa-solid fa-building" style="margin-right:6px;font-size:11px;color:var(--color-primary)"></i>
          Empresa ${empresa}`,
        sums: empTot
      }));

      // Ordenar meses
      const meses = Object.entries(tipoData[empresa])
        .sort((a, b) => a[1].mesSort - b[1].mesSort);

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
            labelHtml: `<span style="display:inline-block;width:10px;height:2px;background:var(--border-color);margin-right:10px;vertical-align:middle;"></span>
              ${produto}`,
            sums: pTot,
            extra: pRows[0] ? { cfop: pRows[0].CFOP||'—', transp: pRows[0].TRANSP||'—' } : {}
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
  const hidden     = level > 0 ? '' : '';   // nível 0 sempre visível
  return `
    <tr id="${id}" ${parentAttr} class="lvl-${level}" data-level="${level}">
      <td style="min-width:280px">${labelHtml}</td>
      <td class="text-right">${fmtN(sums.quant)}</td>
      <td class="text-right">${fmtK(sums.total)}</td>
      <td class="text-right">${fmtN(sums.sacas)}</td>
      <td class="text-right">—</td>
      <td class="text-right">${fmtK(sums.facs)}</td>
      <td class="text-right">${fmtK(sums.fethab)}</td>
      <td class="text-right">${fmtK(sums.funrural)}</td>
      <td>${extra.cfop || ''}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;">${extra.transp || ''}</td>
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
        if (isExpanded) {
          child.classList.add('row-hidden');
          // Recolher netos também
          collapseChildren(child.id);
        } else {
          child.classList.remove('row-hidden');
        }
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
  document.getElementById('tot-quant').textContent   = fmtN(sums.quant);
  document.getElementById('tot-total').textContent   = fmtK(sums.total);
  document.getElementById('tot-sacas').textContent   = fmtN(sums.sacas);
  document.getElementById('tot-facs').textContent    = fmtK(sums.facs);
  document.getElementById('tot-fethab').textContent  = fmtK(sums.fethab);
  document.getElementById('tot-funrural').textContent = fmtK(sums.funrural);
}

// ─────────────────────────────────────────────
// TABELA ANUAL — Meses Horizontais
// ─────────────────────────────────────────────
function updateLabelPeriodo() {
  if (!state.resumoAnual) return;
  const hoje     = new Date();
  const anoSafra = getSafraYear(hoje);
  const lbl      = document.getElementById('label-periodo');
  if (state.tipoCalendario === 'safra') {
    lbl.textContent = `Safra ${anoSafra-1}/${String(anoSafra).slice(2)}`;
  } else {
    lbl.textContent = `Calendário ${hoje.getFullYear()}`;
  }
}

function renderAnualTable() {
  if (!state.resumoAnual) return;

  const hoje       = new Date();
  const anoSafra   = getSafraYear(hoje);
  const mesAtual   = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const prevD      = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnterior = { ano: prevD.getFullYear(), mes: prevD.getMonth() + 1 };

  // Determinar lista de meses a exibir (pode diferir do resumoAnual se troca de tipo)
  const meses = state.tipoCalendario === 'safra'
    ? getMesesSafra(anoSafra)
    : getMesesCalendario(hoje.getFullYear());

  const thead = document.getElementById('anual-thead');
  const tbody = document.getElementById('anual-tbody');

  // ── CABEÇALHO (linha de meses) ──────────────
  let thHtml = '<tr><th>Métrica</th>';
  for (const m of meses) {
    const isFuturo  = new Date(m.ano, m.mes-1, 1) > hoje;
    const isAtual   = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    let cls = '';
    if (isAtual)    cls = 'col-atual';
    if (isAnterior) cls = 'col-anterior';
    const label = `${NOMES_MES[m.mes-1]}/${String(m.ano).slice(2)}`;
    const suffix = isAtual ? ' 🟡' : isAnterior ? ' 🔴' : isFuturo ? ' —' : '';
    thHtml += `<th class="${cls}" title="${m.mes}/${m.ano}" data-mes="${m.mes}" data-ano="${m.ano}">${label}${suffix}</th>`;
  }
  thHtml += '<th class="col-total">TOTAL</th></tr>';
  thead.innerHTML = thHtml;

  // ── CORPO (linhas de métricas) ───────────────
  const emp = state.empresaFiltro;

  // Helper para obter valor de um mês (do resumoAnual se disponível)
  function getValor(m, campo) {
    if (!state.resumoAnual?.meses) return 0;
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return 0;
    const dEmp = mesData.porEmpresa[emp] || mesData.porEmpresa['TOTAL'] || {};
    return Number(dEmp[campo] || 0);
  }

  function getStatus(m) {
    if (!state.resumoAnual?.meses) return 'futuro';
    const mesData = state.resumoAnual.meses.find(x => x.ano === m.ano && x.mes === m.mes);
    if (!mesData) return 'futuro';
    const dEmp = mesData.porEmpresa[emp] || {};
    return dEmp.status || mesData.status || 'futuro';
  }

  const metricas = [
    { key: 'receita',  label: '💰 Receita Total (R$)', format: fmtK },
    { key: 'sacas',    label: '📦 Sacas',               format: fmtN },
    { key: 'qtdNfs',   label: '📄 Nº de NFs',           format: v => Number(v).toLocaleString('pt-BR') },
    { key: 'funrural', label: '🌿 FUNRURAL (R$)',        format: fmtK },
    { key: 'fethab',   label: '🚛 FETHAB (R$)',          format: fmtK },
    { key: 'vlrFacs',  label: '📋 Vlr. FACS (R$)',       format: fmtK },
  ];

  let rows = '';

  for (const metrica of metricas) {
    let totalAcum = 0;
    let rowHtml = `<tr><td>${metrica.label}</td>`;
    for (const m of meses) {
      const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
      const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
      const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      let cls = '';
      if (isAtual)    cls = 'col-atual';
      if (isAnterior) cls = 'col-anterior';

      const val = isFuturo ? null : getValor(m, metrica.key);
      totalAcum += Number(val || 0);
      rowHtml += `<td class="${cls}">${isFuturo ? '—' : metrica.format(val)}</td>`;
    }
    rowHtml += `<td class="col-total">${metrica.format(totalAcum)}</td></tr>`;
    rows += rowHtml;
  }

  // ── Linha de Status ──────────────────────────
  rows += '<tr class="status-row section-row"><td colspan="' + (meses.length + 2) + '">Status de Fechamento</td></tr>';
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
    if (status === 'fechado')           icon = '<span title="Fechado" style="color:#10b981">✅ Fechado</span>';
    else if (status === 'dinamico_atual')   icon = '<span title="Em Curso" style="color:#3b82f6">🟡 Em Curso</span>';
    else if (status === 'dinamico_anterior') icon = '<span title="Pendente de Fechamento" style="color:#f59e0b">🔴 Pendente</span>';
    else if (status === 'aguardando')   icon = '<span title="Sem dados fechados" style="color:#64748b">⬜ Sem dados</span>';
    else                                icon = '<span style="color:#374151">—</span>';

    rows += `<td class="${cls}" style="text-align:center;font-size:12px;">${icon}</td>`;
  }
  rows += '<td class="col-total">—</td></tr>';

  // ── Linha de Ações ────────────────────────────
  rows += '<tr class="action-row"><td>Ação</td>';
  for (const m of meses) {
    const isFuturo   = new Date(m.ano, m.mes-1, 1) > hoje;
    const isAtual    = m.ano === mesAtual.ano   && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    let cls = '';
    if (isAtual)    cls = 'col-atual';
    if (isAnterior) cls = 'col-anterior';
    const status = isFuturo ? 'futuro' : getStatus(m);

    let action = '';
    if (isAnterior && status !== 'fechado') {
      const recValor = getValor(m, 'receita');
      const sacasVal = getValor(m, 'sacas');
      const nfsVal   = getValor(m, 'qtdNfs');
      const funVal   = getValor(m, 'funrural');
      action = `<button class="btn btn-sm btn-success" 
        onclick="abrirModalFechar(${m.mes},${m.ano},'${emp}',${recValor},${sacasVal},${nfsVal},${funVal})"
        style="font-size:11px;padding:4px 10px;">
        <i class="fa-solid fa-lock"></i> Fechar Mês
      </button>`;
    } else if (status === 'fechado') {
      action = `<span style="font-size:11px;color:#10b981;font-weight:600;">✔ Fechado</span>`;
    }
    rows += `<td class="${cls}">${action}</td>`;
  }
  rows += '<td class="col-total"></td></tr>';

  tbody.innerHTML = rows;
}

// ─────────────────────────────────────────────
// Modal de Fechamento
// ─────────────────────────────────────────────
function abrirModalFechar(mes, ano, empresa, receita, sacas, nfs, funrural) {
  state.fecharPending = { mes, ano, empresa };
  document.getElementById('modal-mes-ano').textContent  = `${NOMES_MES[mes-1]}/${ano}`;
  document.getElementById('modal-empresa').textContent  = empresa;
  document.getElementById('modal-receita').textContent  = fmtK(receita);
  document.getElementById('modal-sacas').textContent    = fmtN(sacas);
  document.getElementById('modal-nfs').textContent      = Number(nfs).toLocaleString('pt-BR');
  document.getElementById('modal-funrural').textContent = fmtK(funrural);
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
      // Recarregar resumo anual
      const anoSafra = getSafraYear(new Date());
      const resAnual = await fetch(`/api/receita/resumo-anual?ano_safra=${anoSafra}&tipo=${state.tipoCalendario}`).then(r => r.json());
      if (resAnual.success) {
        state.resumoAnual = resAnual;
        renderAnualTable();
      }
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
    position:fixed; bottom:24px; right:24px; z-index:999;
    background:var(--bg-card); border:1px solid ${color};
    color:${color}; padding:14px 22px; border-radius:10px;
    font-weight:600; font-size:14px; box-shadow:0 8px 24px rgba(0,0,0,.3);
    animation:fadeIn .3s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Fechar modal ao clicar fora
document.getElementById('modal-fechar')?.addEventListener('click', e => {
  if (e.target.id === 'modal-fechar') closeModal();
});

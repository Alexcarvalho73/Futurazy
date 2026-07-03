/**
 * app_insumos.js — Lógica completa da tela de Custos com Insumos (Fechamento Financeiro)
 * Espelha a arquitetura de app_receita.js adaptada para insumos agrícolas.
 * Grid superior: resumo anual por subgrupo (bm.bm_desc) agrupado por tipo_produto
 * Grid inferior: drill-down hierárquico Tipo → Subgrupo → Produto
 */

// ─────────────────────────────────────────────
// Constantes e Estado Global
// ─────────────────────────────────────────────
const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function getTipoConfig(tipoName) {
  const t = (tipoName || '').toUpperCase();
  if (t.includes('DEFENS')) return { badge: 'badge-def',  cor: '#a78bfa', icon: '🛡️' };
  if (t.includes('FERTIL')) return { badge: 'badge-fert', cor: '#10b981', icon: '🧪' };
  if (t.includes('SEMENT')) return { badge: 'badge-sem',  cor: '#f59e0b', icon: '🌱' };
  return { badge: 'badge-out',  cor: '#94a3b8', icon: '📦' };
}

const state = {
  tipoCalendario: 'safra',   // 'safra' | 'calendario'
  empresaFiltro:  'TOTAL',   // 'TOTAL' | '028501' | '028503'
  moeda:          'BRL',     // 'BRL' | 'USD'
  kpiPeriodo:     'atual',   // 'atual' | 'anterior'
  allData:        [],        // dados brutos do Oracle (grid inferior)
  resumoAnual:    null,      // resposta do /api/insumos/resumo-anual
  fecharPending:  null,      // { mes, ano, empresa }
  params:         { za5_safra: '', za5_filial: '', descricao: '' },
};

const fmtBrl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

function fmtMoeda(v, forceMode) {
  if (v == null || v === '' || isNaN(Number(v))) return '—';
  const n = Number(v);
  const mode = forceMode || state.moeda;
  if (mode === 'USD') return 'US$ ' + fmtUsd.format(n);
  return 'R$ ' + fmtBrl.format(n);
}
function fmtMoedaBrl(v) { return fmtMoeda(v, 'BRL'); }
function fmtMoedaUsd(v) { return fmtMoeda(v, 'USD'); }

function fmtN(v) {
  if (v == null || isNaN(Number(v))) return '—';
  return fmtNum.format(Number(v));
}

function moedaPrefix() { return state.moeda === 'USD' ? 'US$' : 'R$'; }

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
  loadParams();
  loadTiposInsumo();
  loadAll();
});

async function loadTiposInsumo() {
  try {
    const res = await fetch('/api/insumos/tipos').then(r => r.json());
    if (res.success && res.data) {
      const select = document.getElementById('f-tipo-insumo');
      const selectEdit = document.getElementById('edit-fi-tipo');
      
      if (selectEdit) {
        selectEdit.innerHTML = '<option value="TOTAL">Total Geral</option>';
      }
      
      if (select) {
        // Remove existing options except the first one ('todos')
        while (select.options.length > 1) {
          select.remove(1);
        }
        res.data.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.BM_GRUPO; // '0201' etc.
          // Fallback simple icons
          let icon = '📦';
          if (t.BM_DESC.includes('DEFENS')) icon = '🛡️';
          else if (t.BM_DESC.includes('FERTIL')) icon = '🧪';
          else if (t.BM_DESC.includes('SEMENT')) icon = '🌱';
          opt.textContent = `${icon} ${t.BM_DESC}`;
          select.appendChild(opt);

          if (selectEdit) {
            const optEdit = document.createElement('option');
            optEdit.value = t.BM_DESC.trim().toUpperCase(); // Para salvar no banco
            optEdit.textContent = `${icon} ${t.BM_DESC}`;
            selectEdit.appendChild(optEdit);
          }
        });
      }
    }
  } catch (err) {
    console.error('Erro ao buscar tipos de insumo:', err);
  }
}

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

  // Toggle período KPI
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

  document.getElementById('btn-apply-filters')?.addEventListener('click', async () => {
    const filtered = applyFilters(state.allData);
    renderCube(filtered);
    updateKpis(filtered);

    const anoSafra = getSafraYear(new Date());
    const fazenda  = document.getElementById('f-fazenda').value.trim();
    const produto  = document.getElementById('f-produto').value.trim();
    const tipoIns  = document.getElementById('f-tipo-insumo').value;

    setLoading('anual', true);
    try {
      const params = new URLSearchParams({
        ano_safra: anoSafra,
        tipo: state.tipoCalendario,
        ...(fazenda  ? { fazenda }  : {}),
        ...(produto  ? { produto }  : {}),
        ...(tipoIns && tipoIns !== 'todos' ? { tipo_insumo: tipoIns } : {}),
      });
      const res = await fetch(`/api/insumos/resumo-anual?${params}`).then(r => r.json());
      if (res.success) state.resumoAnual = res;
    } catch (err) {
      console.error('Erro ao buscar resumo anual filtrado:', err);
    } finally {
      setLoading('anual', false);
      const empFilter = document.getElementById('f-empresa').value;
      const targetEmp = (empFilter && empFilter !== 'todas') ? empFilter : 'TOTAL';
      document.querySelectorAll('.empresa-tab').forEach(t => t.classList.remove('active'));
      const tab = document.querySelector(`.empresa-tab[data-emp="${targetEmp}"]`);
      if (tab) tab.classList.add('active');
      state.empresaFiltro = targetEmp;
      renderAnualTable();
    }
  });

  document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    ['f-empresa','f-tipo-insumo','f-fazenda','f-produto'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'SELECT') el.value = el.options[0].value;
        else el.value = '';
      }
    });
    document.querySelectorAll('.empresa-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.empresa-tab[data-emp="TOTAL"]')?.classList.add('active');
    state.empresaFiltro = 'TOTAL';
    renderCube(state.allData);
    updateKpis(state.allData);
    renderAnualTable();
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

  // Modal Excluir
  document.getElementById('btn-cancel-excluir')?.addEventListener('click', () => {
    document.getElementById('modal-excluir').classList.remove('open');
    pendingDeleteId = null;
  });
  document.getElementById('btn-confirm-excluir')?.addEventListener('click', confirmDeleteFechamento);

  // Modal ajustes manuais
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

  document.getElementById('filter-modal-periodo')?.addEventListener('input', filterModalList);
  document.getElementById('filter-modal-filial')?.addEventListener('change', filterModalList);
  document.getElementById('filter-modal-tipo')?.addEventListener('change', filterModalList);

  // Parâmetros
  document.getElementById('btn-save-params')?.addEventListener('click', saveParams);
}

// ─────────────────────────────────────────────
// Parâmetros de Safra
// ─────────────────────────────────────────────
async function loadParams() {
  try {
    const res = await fetch('/api/params').then(r => r.json());
    if (res.success && res.data && res.data.insumos) {
      const p = res.data.insumos;
      state.params = { ...p };
      const el1 = document.getElementById('param-za5-safra');
      const el2 = document.getElementById('param-za5-filial');
      const el3 = document.getElementById('param-descricao');
      if (el1) el1.value = p.za5_safra || '';
      if (el2) el2.value = p.za5_filial || '';
      if (el3) el3.value = p.descricao || '';
    }
  } catch (err) {
    console.warn('[params] Erro ao carregar parâmetros:', err);
  }
}

async function saveParams() {
  const za5_safra  = document.getElementById('param-za5-safra').value.trim();
  const za5_filial = document.getElementById('param-za5-filial').value.trim();
  const descricao  = document.getElementById('param-descricao').value.trim();

  if (!za5_safra || !za5_filial) {
    alert('Preencha ao menos ZA5_SAFRA e ZA5_FILIAL.');
    return;
  }

  try {
    const res = await fetch('/api/params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insumos: { za5_safra, za5_filial, descricao } })
    }).then(r => r.json());

    if (res.success) {
      state.params = { za5_safra, za5_filial, descricao };
      const ok = document.getElementById('param-save-ok');
      if (ok) {
        ok.style.display = 'inline-flex';
        setTimeout(() => { ok.style.display = 'none'; }, 3000);
      }
      // Recarregar dados com novos parâmetros
      loadAll();
    } else {
      alert('Erro ao salvar parâmetros: ' + res.error);
    }
  } catch (err) {
    alert('Erro ao salvar parâmetros: ' + err.message);
  }
}

// ─────────────────────────────────────────────
// Labels e Atualizações Visuais
// ─────────────────────────────────────────────
function atualizarLabelsMoeda() {
  const prefix = moedaPrefix();
  const thCusto   = document.getElementById('th-custo-cubo');
  const thCustoUsd = document.getElementById('th-custo-usd-cubo');
  if (thCusto)    thCusto.textContent    = `Custo (${prefix})`;
  if (thCustoUsd) thCustoUsd.textContent = `Custo (${state.moeda === 'BRL' ? 'USD' : 'R$'})`;
}

function updateLabelPeriodo() {
  const hoje = new Date();
  const anoSafra = getSafraYear(hoje);
  const lbl = document.getElementById('label-periodo');
  if (!lbl) return;
  if (state.tipoCalendario === 'safra') {
    lbl.textContent = `Safra ${anoSafra-1}/${String(anoSafra).slice(2)}`;
  } else {
    lbl.textContent = `Ano ${hoje.getFullYear()}`;
  }
}

function setLoading(zone, active) {
  const el = document.getElementById(`loading-${zone}`);
  if (el) el.classList.toggle('active', active);
}

// ─────────────────────────────────────────────
// Carregamento de Dados
// ─────────────────────────────────────────────
async function loadAll() {
  const hoje     = new Date();
  const anoSafra = getSafraYear(hoje);

  setLoading('cube',  true);
  setLoading('anual', true);

  updateLabelPeriodo();

  // Buscar mês anterior e atual para o cubo inferior
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const dataDe = dateToStr(prevDate);
  const dataAte = dateToStr(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));

  try {
    const [resDados, resAnual] = await Promise.all([
      fetch(`/api/insumos/dados?data_de=${dataDe}&data_ate=${dataAte}`).then(r => r.json()),
      fetch(`/api/insumos/resumo-anual?ano_safra=${anoSafra}&tipo=${state.tipoCalendario}`).then(r => r.json()),
    ]);

    if (resDados.success) {
      state.allData = resDados.data || [];
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
      renderCube(filtered);
    } else {
      console.error('[insumos/dados] Erro:', resDados.error);
    }

    if (resAnual.success) {
      state.resumoAnual = resAnual;
      renderAnualTable();
    } else {
      console.error('[insumos/resumo-anual] Erro:', resAnual.error);
    }
  } catch (err) {
    console.error('[loadAll] Erro:', err);
  } finally {
    setLoading('cube',  false);
    setLoading('anual', false);
  }
}

function dateToStr(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

// ─────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────
function applyFilters(data) {
  const empresa    = document.getElementById('f-empresa')?.value;
  const tipoInsumo = document.getElementById('f-tipo-insumo')?.value;
  const fazenda    = (document.getElementById('f-fazenda')?.value || '').toLowerCase().trim();
  const produto    = (document.getElementById('f-produto')?.value || '').toLowerCase().trim();

  return data.filter(r => {
    if (empresa && empresa !== 'todas' && r.EMPRESA !== empresa) return false;
    if (tipoInsumo && tipoInsumo !== 'todos' && r.GRUPO !== tipoInsumo) return false;
    if (fazenda && !(r.FAZENDA || '').toLowerCase().includes(fazenda)) return false;
    if (produto && !(r.PRODUTO || '').toLowerCase().includes(produto)) return false;
    return true;
  });
}

// ─────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────
function updateKpis(data) {
  const hoje = new Date();
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAtual    = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

  const periodo = state.kpiPeriodo === 'anterior' ? mesAnterior : mesAtual;

  const filtered = data.filter(r => {
    const d = r.DDATA instanceof Date ? r.DDATA : (r.DDATA ? new Date(r.DDATA) : null);
    if (!d) return false;
    return d.getFullYear() === periodo.ano && d.getMonth() + 1 === periodo.mes;
  });

  let custoTotal = 0, custoUsd = 0;
  const porTipo  = {};

  for (const r of filtered) {
    const brl = Number(r.CUSTO_BRL || 0);
    const usd = Number(r.CUSTO_USD || 0);
    custoTotal += brl;
    custoUsd   += usd;
    const t = r.TIPO_PRODUTO || 'OUTROS';
    if (!porTipo[t]) porTipo[t] = { brl: 0, usd: 0 };
    porTipo[t].brl += brl;
    porTipo[t].usd += usd;
  }

  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const periodoLabel = `${nomesMes[periodo.mes-1]}/${periodo.ano}`;

  const set = (id, val, sub) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
    const elSub = document.getElementById(id + '-sub');
    if (elSub && sub) elSub.textContent = sub;
  };

  const usarUsd = state.moeda === 'USD';
  set('kpi-custo-total', fmtMoedaBrl(custoTotal), periodoLabel);
  set('kpi-custo-usd',   'US$ ' + fmtUsd.format(custoUsd), periodoLabel);

  const dynKpis = document.getElementById('dynamic-kpis');
  if (dynKpis) {
    const tipos = Object.keys(porTipo).sort((a, b) => a.localeCompare(b));
    let html = '';
    for (const tipo of tipos) {
      const cfg = getTipoConfig(tipo);
      const val = usarUsd ? (porTipo[tipo]?.usd||0) : (porTipo[tipo]?.brl||0);
      html += `
        <div class="kpi-card">
          <div class="kpi-icon" style="background:${cfg.cor}1a;color:${cfg.cor};font-size:1.5rem;">
            ${cfg.icon}
          </div>
          <div class="kpi-data">
            <h3>${escHtml(tipo)}</h3>
            <h2>${fmtMoeda(val)}</h2>
            <span class="kpi-sub">${escHtml(periodoLabel)}</span>
          </div>
        </div>
      `;
    }
    dynKpis.innerHTML = html;
  }
}

// ─────────────────────────────────────────────
// Grid Inferior — Cubo Drill-down
// Hierarquia: Tipo → Subgrupo → Produto
// ─────────────────────────────────────────────
function renderCube(data) {
  const body = document.getElementById('cube-body');
  if (!body) return;

  // Agregar: Tipo → Produto
  const tree = {}; // { tipo: { _brl, _usd, _consumo, produtos: { prod: { rows: [...], _brl, _usd, _consumo } } } }

  let grandBrl = 0, grandUsd = 0, grandConsumo = 0;

  for (const r of data) {
    const tipo = r.TIPO_PRODUTO || 'OUTROS';
    const prod = r.PRODUTO     || '(sem produto)';

    if (!tree[tipo]) tree[tipo] = { _brl: 0, _usd: 0, _consumo: 0, produtos: {} };
    const T = tree[tipo];
    
    if (!T.produtos[prod]) T.produtos[prod] = { _brl: 0, _usd: 0, _consumo: 0, rows: [] };
    const P = T.produtos[prod];

    const brl  = Number(r.CUSTO_BRL || 0);
    const usd  = Number(r.CUSTO_USD || 0);
    const cons = Number(r.CONSUMO   || 0);

    T._brl     += brl; T._usd     += usd; T._consumo     += cons;
    P._brl     += brl; P._usd     += usd; P._consumo     += cons;
    P.rows.push(r);
    grandBrl += brl; grandUsd += usd; grandConsumo += cons;
  }

  const rows = [];
  let uid = 0;

    const tiposOrdem = Object.keys(tree).sort((a, b) => a.localeCompare(b));

  const finalRows = [];
  for (const tipo of tiposOrdem) {
    const T   = tree[tipo];
    const cfg = getTipoConfig(tipo);
    const tipoId = `tipo_${uid++}`;
    const tValUsd = T._usd;
    const tValBrl = T._brl;

    finalRows.push(`
      <tr class="lvl-0" data-id="${tipoId}">
        <td>
          <span class="toggle-btn" onclick="toggleRows('${tipoId}')">▶</span>
          <span class="${cfg.badge}" style="margin-right:6px;">${cfg.icon} ${tipo}</span>
        </td>
        <td class="text-right">—</td>
        <td class="text-right">${fmtN(T._consumo)}</td>
        <td class="text-right">${fmtMoedaUsd(tValUsd)}</td>
        <td class="text-right">${fmtMoedaBrl(tValBrl)}</td>
        <td class="text-right">—</td>
        <td class="text-right">—</td>
        <td colspan="2">—</td>
      </tr>
    `);

    let prUid = 0;
    for (const [prod, P] of Object.entries(T.produtos)) {
      const prId = `pr_${tipoId}_${prUid++}`;
      const prValUsd = P._usd;
      const prValBrl = P._brl;
      const exRow = P.rows[0] || {};

      finalRows.push(`
        <tr class="lvl-1 row-hidden" data-parent="${tipoId}" data-id="${prId}">
          <td><span class="toggle-btn" onclick="toggleRows('${prId}')">▶</span>${escHtml(prod)}</td>
          <td class="text-right">${escHtml(exRow.FAZENDA || '—')}</td>
          <td class="text-right">${fmtN(P._consumo)}</td>
          <td class="text-right">${fmtMoedaUsd(prValUsd)}</td>
          <td class="text-right">${fmtMoedaBrl(prValBrl)}</td>
          <td class="text-right">—</td>
          <td class="text-right">—</td>
          <td>—</td>
          <td>—</td>
        </tr>
      `);

      for (const row of P.rows) {
        const ddata  = row.DDATA ? formatDate(row.DDATA) : '—';
        const cBrl   = Number(row.CUSTO_BRL || 0);
        const cUsd   = Number(row.CUSTO_USD || 0);
        const vBrl   = Number(row.VLR_BRL   || 0);
        const vUsd   = Number(row.VLR_USD   || 0);
        const dValUsd = cUsd;
        const dValBrl = cBrl;
        finalRows.push(`
          <tr class="lvl-2 row-hidden" data-parent="${prId}">
            <td style="padding-left:100px !important; font-style:italic; color:#475569;">
              O.S. ${escHtml(row.O_S || '—')}
            </td>
            <td class="text-right">${escHtml(row.FAZENDA || '—')}</td>
            <td class="text-right">${fmtN(row.CONSUMO)}</td>
            <td class="text-right">${fmtMoedaUsd(dValUsd)}</td>
            <td class="text-right">${fmtMoedaBrl(dValBrl)}</td>
            <td class="text-right">${fmtMoedaBrl(vBrl)}</td>
            <td class="text-right">${fmtMoedaUsd(vUsd)}</td>
            <td>${escHtml(row.TALHAO || '—')}</td>
            <td>${ddata}</td>
          </tr>
        `);
      }
    }
  }

  body.innerHTML = finalRows.join('');

  // Grand totals
  const elC   = document.getElementById('tot-consumo');
  const elUsd = document.getElementById('tot-usd');
  const elBrl = document.getElementById('tot-brl');
  if (elC)   elC.textContent   = fmtN(grandConsumo);
  if (elUsd) elUsd.textContent = fmtMoedaUsd(grandUsd);
  if (elBrl) elBrl.textContent = fmtMoedaBrl(grandBrl);
}

function toggleRows(parentId) {
  const rows = document.querySelectorAll(`[data-parent="${parentId}"]`);
  rows.forEach(r => {
    const isHidden = r.classList.toggle('row-hidden');
    // Se estamos recolhendo, recolher filhos também
    if (isHidden) {
      const childId = r.dataset.id;
      if (childId) {
        document.querySelectorAll(`[data-parent="${childId}"]`).forEach(c => c.classList.add('row-hidden'));
      }
    }
  });
  // Atualizar ícone
  const btn = document.querySelector(`[data-id="${parentId}"] .toggle-btn`);
  if (btn) {
    const firstChild = document.querySelector(`[data-parent="${parentId}"]`);
    btn.innerHTML = firstChild && firstChild.classList.contains('row-hidden') ? '▶' : '▼';
  }
}

// ─────────────────────────────────────────────
// Grid Superior — Resumo Anual (linhas = subgrupos por tipo, colunas = meses)
// ─────────────────────────────────────────────
function renderAnualTable() {
  if (!state.resumoAnual) return;

  const hoje     = new Date();
  const anoSafra = getSafraYear(hoje);
  const anoCalend = hoje.getFullYear();

  const meses = state.tipoCalendario === 'calendario'
    ? getMesesCalendario(anoCalend)
    : getMesesSafra(anoSafra);

  const mesAtual    = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const prevDate    = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

  const emp = state.empresaFiltro; // 'TOTAL' | '028501' | '028503'

  // Montar thead
  const thead = document.getElementById('anual-thead');
  const colHeaders = meses.map((m, i) => {
    const isAtual    = m.ano === mesAtual.ano    && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    const cls = isAtual ? 'col-atual' : isAnterior ? 'col-anterior' : '';
    const lbl = `${NOMES_MES[m.mes-1]}<br><small>${String(m.ano).slice(2)}</small>`;
    return `<th class="${cls}">${lbl}</th>`;
  }).join('');
  thead.innerHTML = `
    <tr>
      <th>Subgrupo / Tipo</th>
      ${colHeaders}
      <th class="col-total">TOTAL</th>
    </tr>
  `;

  // Coletar todos os tipos do resumo anual
  const allTipos = new Set();
  for (const mesData of (state.resumoAnual.meses || [])) {
    const empData = mesData.porEmpresa?.[emp] || mesData.porEmpresa?.['TOTAL'] || {};
    for (const tipo of Object.keys(empData.porTipo || {})) {
      allTipos.add(tipo);
    }
  }

  const usarUsd = state.moeda === 'USD';
  const tbody = document.getElementById('anual-tbody');
  const bodyRows = [];

  function getTipoVal(mesData, tipo) {
    const empData = mesData.porEmpresa?.[emp] || mesData.porEmpresa?.['TOTAL'] || {};
    const v = empData.porTipo?.[tipo];
    if (!v) return null;
    return usarUsd ? (v.custoUsd || 0) : (v.custoBrl || 0);
  }
  function getTotalVal(mesData) {
    const empData = mesData.porEmpresa?.[emp] || mesData.porEmpresa?.['TOTAL'] || {};
    return usarUsd ? (empData.totalUsd || 0) : (empData.totalBrl || 0);
  }

  const tiposOrdem = [...allTipos].sort((a, b) => a.localeCompare(b));

  for (const tipo of tiposOrdem) {
    const cfg = getTipoConfig(tipo);

    // Linha do tipo (subtotal)
    let tipoRowTotal = 0;
    const tipoCells = meses.map((m, i) => {
      const mesData = (state.resumoAnual.meses || []).find(md => md.ano === m.ano && md.mes === m.mes);
      const isAtual    = m.ano === mesAtual.ano    && m.mes === mesAtual.mes;
      const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      const cls = isAtual ? 'col-atual' : isAnterior ? 'col-anterior' : '';

      if (!mesData) return `<td class="${cls}">—</td>`;
      const val = getTipoVal(mesData, tipo) || 0;
      tipoRowTotal += val;

      // Status
      const empData = mesData.porEmpresa?.[emp] || mesData.porEmpresa?.['TOTAL'] || {};
      const status  = empData.status || mesData.status || '';
      const isFechado   = status === 'fechado';
      const isDinamicoA = status === 'dinamico_atual';
      const isDinamicoP = status === 'dinamico_anterior';
      const isFuturo    = status === 'futuro';

      let icon = '';
      if (isFechado)   icon = '<i class="fa-solid fa-lock" style="color:#10b981;margin-right:4px;font-size:10px;" title="Fechado"></i>';
      else if (isFuturo) icon = '';
      else if (isDinamicoA) icon = '<i class="fa-solid fa-bolt" style="color:#3b82f6;margin-right:4px;font-size:10px;" title="Mês atual"></i>';
      else if (isDinamicoP) icon = '<i class="fa-solid fa-clock-rotate-left" style="color:#f59e0b;margin-right:4px;font-size:10px;" title="Mês anterior"></i>';

      const txt = val > 0 ? fmtMoeda(val) : (isFuturo ? '·' : '—');
      return `<td class="${cls}" style="font-weight:600;color:${cfg.cor};">${icon}${txt}</td>`;
    }).join('');

    // Botão fechar mês (no mês anterior dinâmico)
    const mesAnteriorData = (state.resumoAnual.meses || []).find(
      md => md.ano === mesAnterior.ano && md.mes === mesAnterior.mes
    );
    const empDadoAnterior = mesAnteriorData?.porEmpresa?.[emp] || mesAnteriorData?.porEmpresa?.['TOTAL'] || {};
    const statusAnterior  = empDadoAnterior.status || mesAnteriorData?.status || '';
    const podeFechar = statusAnterior === 'dinamico_anterior';

    bodyRows.push(`
      <tr style="background:rgba(255,255,255,.015);">
        <td style="font-weight:700;color:${cfg.cor};">
          <span class="${cfg.badge}" style="margin-right:6px;">${cfg.icon} ${tipo}</span>
        </td>
        ${tipoCells}
        <td class="col-total">${fmtMoeda(tipoRowTotal)}</td>
      </tr>
    `);

    // Se pode fechar, adicionar linha de ação para este tipo
    if (podeFechar && tipo === tiposOrdem[tiposOrdem.length - 1]) {
      // Linha de ação apenas na última linha de tipo (fechamento geral do mês)
    }
  }

  // Linha TOTAL
  let grandTotal = 0;
  const grandCells = meses.map((m, i) => {
    const mesData = (state.resumoAnual.meses || []).find(md => md.ano === m.ano && md.mes === m.mes);
    const isAtual    = m.ano === mesAtual.ano    && m.mes === mesAtual.mes;
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    const cls = isAtual ? 'col-atual' : isAnterior ? 'col-anterior' : '';
    if (!mesData) return `<td class="${cls}">—</td>`;
    const val = getTotalVal(mesData) || 0;
    grandTotal += val;
    const empData = mesData.porEmpresa?.[emp] || mesData.porEmpresa?.['TOTAL'] || {};
    const status  = empData.status || mesData.status || '';
    const isFechado    = status === 'fechado';
    const isDinanicoP  = status === 'dinamico_anterior';
    const isFuturo     = status === 'futuro';

    let icon = '';
    if (isFechado)   icon = '<i class="fa-solid fa-lock" style="color:#10b981;margin-right:4px;font-size:10px;"></i>';
    else if (isDinanicoP) icon = '<i class="fa-solid fa-clock-rotate-left" style="color:#f59e0b;margin-right:4px;font-size:10px;"></i>';

    const txt = val > 0 ? fmtMoeda(val) : (isFuturo ? '·' : '—');
    return `<td class="${cls}" style="font-weight:700;color:#f87171;">${icon}${txt}</td>`;
  }).join('');

  // Botão de fechar mês (linha de ação do mês anterior)
  const mesAnteriorData2 = (state.resumoAnual.meses || []).find(
    md => md.ano === mesAnterior.ano && md.mes === mesAnterior.mes
  );
  const empDadoAnt2 = mesAnteriorData2?.porEmpresa?.[emp] || mesAnteriorData2?.porEmpresa?.['TOTAL'] || {};
  const statusAnt2  = empDadoAnt2.status || mesAnteriorData2?.status || '';
  const podeFecharGeral = statusAnt2 === 'dinamico_anterior';

  const actionCells = meses.map((m, i) => {
    const isAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
    if (!isAnterior || !podeFecharGeral) return '<td></td>';

    const empLabel = emp === 'TOTAL' ? 'TODAS' : emp;
    const mLabel   = `${NOMES_MES[m.mes-1]}/${m.ano}`;
    return `
      <td class="col-anterior" style="text-align:center; padding:4px;">
        <button class="btn btn-sm" style="background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.3);font-size:11px;padding:3px 8px;"
          onclick="openModalFechar(${m.mes}, ${m.ano}, '${empLabel}')">
          <i class="fa-solid fa-lock"></i> Fechar ${mLabel}
        </button>
      </td>
    `;
  }).join('');

  bodyRows.push(`
    <tr style="border-top: 2px solid var(--border-color);">
      <td style="font-weight:700; color:#f87171;">
        <i class="fa-solid fa-sigma" style="margin-right:6px;"></i>TOTAL INSUMOS
      </td>
      ${grandCells}
      <td class="col-total">${fmtMoeda(grandTotal)}</td>
    </tr>
    <tr class="action-row">
      <td></td>
      ${actionCells}
      <td></td>
    </tr>
  `);

  tbody.innerHTML = bodyRows.join('');
}

// ─────────────────────────────────────────────
// Modal de Fechamento
// ─────────────────────────────────────────────
function openModalFechar(mes, ano, empresa) {
  const mesData = (state.resumoAnual?.meses || []).find(m => m.ano === ano && m.mes === mes);
  if (!mesData) return;

  const empKey  = empresa === 'TODAS' ? 'TOTAL' : empresa;
  const empData = mesData.porEmpresa?.[empKey] || mesData.porEmpresa?.['TOTAL'] || {};

  const custoB  = empData.totalBrl || 0;
  const ptaxMed = empData.ptaxMedio || 0;

  // Subgrupos por tipo
  let defBrl = 0, fertBrl = 0, semBrl = 0;
  for (const [tipo, subs] of Object.entries(empData.subgrupos || {})) {
    for (const v of Object.values(subs)) {
      if (tipo === 'DEFENSIVO')    defBrl  += (v.custoBrl || 0);
      if (tipo === 'FERTILIZANTE') fertBrl += (v.custoBrl || 0);
      if (tipo === 'SEMENTE')      semBrl  += (v.custoBrl || 0);
    }
  }

  state.fecharPending = { mes, ano, empresa };

  document.getElementById('modal-mes-ano').textContent      = `${NOMES_MES[mes-1]}/${ano}`;
  document.getElementById('modal-empresa').textContent      = empresa;
  document.getElementById('modal-custo').textContent        = fmtMoedaBrl(custoB);
  document.getElementById('modal-ptax').textContent         = ptaxMed > 0 ? `R$ ${fmtBrl.format(ptaxMed)}` : '—';
  document.getElementById('modal-defensivo').textContent    = fmtMoedaBrl(defBrl);
  document.getElementById('modal-fertilizante').textContent = fmtMoedaBrl(fertBrl);

  document.getElementById('modal-fechar').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-fechar').classList.remove('open');
  state.fecharPending = null;
}

async function confirmarFechamento() {
  if (!state.fecharPending) return;
  const { mes, ano, empresa } = state.fecharPending;

  const btn = document.getElementById('btn-confirm-fechar');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fechando…';

  try {
    const res = await fetch('/api/insumos/fechar-mes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa, mes, ano })
    }).then(r => r.json());

    if (res.success) {
      closeModal();
      await loadAll();
      showToast('Mês fechado com sucesso!', 'success');
    } else {
      showToast('Erro ao fechar mês: ' + res.error, 'error');
    }
  } catch (err) {
    showToast('Erro: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Fechamento';
  }
}

// ─────────────────────────────────────────────
// Modal Ajustes Manuais — FECHAMENTO_INSUMOS
// ─────────────────────────────────────────────
let _allFechamentos = [];

async function loadClosedFechamentos() {
  const body = document.getElementById('edit-fechamento-list-body');
  if (body) body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Carregando…</td></tr>';

  try {
    const res = await fetch('/api/insumos/fechados').then(r => r.json());
    _allFechamentos = res.data || [];
    filterModalList();
  } catch (err) {
    console.error('[loadClosedFechamentos]', err);
  }
}

function filterModalList() {
  const periodo = document.getElementById('filter-modal-periodo')?.value;
  const filial  = document.getElementById('filter-modal-filial')?.value;
  const tipo    = document.getElementById('filter-modal-tipo')?.value;

  let filtered = _allFechamentos;
  if (periodo) {
    const [y, m] = periodo.split('-');
    filtered = filtered.filter(r => String(r.FI_ANO) === y && String(r.FI_MES) === m);
  }
  if (filial)  filtered = filtered.filter(r => r.FI_EMPRESA === filial);
  if (tipo)    filtered = filtered.filter(r => r.FI_TIPO_INSUMO === tipo);

  const body = document.getElementById('edit-fechamento-list-body');
  if (!body) return;

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Nenhum registro encontrado.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map(r => {
    const per = `${String(r.FI_MES).padStart(2,'0')}/${r.FI_ANO}`;
    const dtF = r.FI_DT_FECHAMENTO ? formatDate(r.FI_DT_FECHAMENTO) : '—';
    const ptaxFmt = r.FI_PTAX > 0 ? `R$ ${fmtBrl.format(r.FI_PTAX)}` : '—';
    return `
      <tr>
        <td>${per}</td>
        <td>${r.FI_EMPRESA}</td>
        <td>${r.FI_TIPO_INSUMO || '—'}</td>
        <td class="text-right">${fmtMoedaBrl(r.FI_CUSTO_TOTAL)}</td>
        <td class="text-right">${ptaxFmt}</td>
        <td>${dtF}</td>
        <td>
          <button class="btn btn-sm" style="padding:2px 8px;background:rgba(59,130,246,.15);color:#3b82f6;border:1px solid rgba(59,130,246,.3);"
            onclick="openEditForm(${r.FI_ID})">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-sm" style="padding:2px 8px;background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.3);margin-left:4px;"
            onclick="deleteFechamento(${r.FI_ID})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openEditForm(id) {
  const rec = _allFechamentos.find(r => r.FI_ID === id);
  if (!rec) return;

  document.getElementById('edit-fi-id').value       = rec.FI_ID;
  document.getElementById('edit-fi-periodo').value   = `${rec.FI_ANO}-${String(rec.FI_MES).padStart(2,'0')}`;
  document.getElementById('edit-fi-filial').value    = rec.FI_EMPRESA;
  document.getElementById('edit-fi-tipo').value      = rec.FI_TIPO_INSUMO || '';
  document.getElementById('edit-fi-custo-brl').value = rec.FI_CUSTO_TOTAL || '';
  document.getElementById('edit-fi-ptax').value      = rec.FI_PTAX         || '';
  document.getElementById('edit-fi-obs').value       = rec.FI_OBS          || '';

  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
}

function openNewFechamentoForm() {
  document.getElementById('edit-fi-id').value        = '';
  document.getElementById('edit-fi-periodo').value   = '';
  document.getElementById('edit-fi-filial').value    = '028501';
  document.getElementById('edit-fi-tipo').value = 'TOTAL';
  document.getElementById('edit-fi-custo-brl').value = '';
  document.getElementById('edit-fi-ptax').value      = '';
  document.getElementById('edit-fi-obs').value       = '';

  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
}

async function saveFechamentoForm() {
  const id      = document.getElementById('edit-fi-id').value;
  const periodo = document.getElementById('edit-fi-periodo').value;
  const filial  = document.getElementById('edit-fi-filial').value;
  const tipo    = document.getElementById('edit-fi-tipo').value;
  const custoBrl = document.getElementById('edit-fi-custo-brl').value;
  const ptaxVal  = document.getElementById('edit-fi-ptax').value;
  const obs      = document.getElementById('edit-fi-obs').value;

  if (!periodo || !filial || !tipo) {
    alert('Preencha Período, Filial e Tipo.');
    return;
  }

  const btn = document.getElementById('btn-save-edit-form');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    let res;
    if (id) {
      res = await fetch(`/api/insumos/fechamento/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custoBrl, ptaxVal, obs })
      }).then(r => r.json());
    } else {
      res = await fetch('/api/insumos/fechamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo, filial, tipo, custoBrl, ptaxVal, obs })
      }).then(r => r.json());
    }

    if (res.success) {
      document.getElementById('edit-fechamento-form-view').style.display = 'none';
      document.getElementById('edit-fechamento-list-view').style.display = 'block';
      await loadClosedFechamentos();
      showToast('Registro salvo com sucesso!', 'success');
    } else {
      alert('Erro: ' + res.error);
    }
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
  }
}

let pendingDeleteId = null;

function deleteFechamento(id) {
  pendingDeleteId = id;
  document.getElementById('modal-excluir').classList.add('open');
}

async function confirmDeleteFechamento() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  const btn = document.getElementById('btn-confirm-excluir');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...';

  try {
    const res = await fetch(`/api/insumos/fechamento/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.success) {
      await loadClosedFechamentos();
      showToast('Registro excluído.', 'success');
      document.getElementById('modal-excluir').classList.remove('open');
    } else {
      alert('Erro: ' + res.error);
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    pendingDeleteId = null;
  }
}

function closeEditFechamentoModal() {
  document.getElementById('modal-edit-fechamento').classList.remove('open');
  document.getElementById('edit-fechamento-form-view').style.display = 'none';
  document.getElementById('edit-fechamento-list-view').style.display = 'block';
}

// ─────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(val) {
  if (!val) return '—';
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d)) return String(val).slice(0, 10);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function showToast(msg, type) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${type==='success' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)'};
    color:#fff; padding:12px 24px; border-radius:8px;
    font-size:14px; font-weight:600; font-family:'Inter',sans-serif;
    box-shadow:0 8px 24px rgba(0,0,0,.3);
    animation:slideIn .3s ease;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

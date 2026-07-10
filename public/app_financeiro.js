
/**
 * app_financeiro.js
 */

const state = {
  tipoCalendario: 'safra',
  empresaFiltro:  'TOTAL',
  moeda:          'BRL',
  kpiPeriodo:     'atual',
  allData:        [],
  resumoAnual:    null,
  fecharPending:  null,
  params:         {}
};

const fmtBrl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtMoeda(v, forceMode) {
  if (v == null || v === '' || isNaN(Number(v))) return '—';
  const n = Number(v);
  const mode = forceMode || state.moeda;
  if (mode === 'USD') return 'US$ ' + fmtUsd.format(n);
  return 'R$ ' + fmtBrl.format(n);
}

function fmtMoedaBrl(v) { return fmtMoeda(v, 'BRL'); }
function fmtMoedaUsd(v) { return fmtMoeda(v, 'USD'); }

function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getSafraYear(hoje = new Date()) {
  return hoje.getMonth() + 1 >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadParams();
});

function setupEventListeners() {
  document.getElementById('btn-refresh')?.addEventListener('click', loadAll);
  
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
    const filtered = applyFilters(state.allData);
    renderAnual(filtered);
  });

  // Toggle moeda
  document.querySelectorAll('.moeda-btn[data-moeda]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.moeda-btn[data-moeda]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.moeda = btn.dataset.moeda;
      const filtered = applyFilters(state.allData);
      const periodFiltered = applyPeriodFilter(filtered);
      updateKpis(periodFiltered);
      renderCube(periodFiltered);
      renderAnual(filtered);
    });
  });

  // Toggle período KPI
  document.querySelectorAll('.moeda-btn[data-kpi-periodo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.moeda-btn[data-kpi-periodo]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kpiPeriodo = btn.dataset.kpiPeriodo;
      const filtered = applyFilters(state.allData);
      const periodFiltered = applyPeriodFilter(filtered);
      updateKpis(periodFiltered);
      renderCube(periodFiltered);
    });
  });

  document.getElementById('f-empresa')?.addEventListener('change', (e) => {
    const val = e.target.value;
    document.querySelectorAll('.empresa-tab').forEach(b => b.classList.remove('active'));
    const targetId = val === 'todas' ? 'tab-total' : `tab-${val}`;
    document.getElementById(targetId)?.classList.add('active');

    const filtered = applyFilters(state.allData);
    const periodFiltered = applyPeriodFilter(filtered);
    updateKpis(periodFiltered);
    renderCube(periodFiltered);
    renderAnual(filtered);
  });

  document.querySelectorAll('.empresa-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.empresa-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const emp = btn.dataset.emp;
      
      const select = document.getElementById('f-empresa');
      if (select) {
        select.value = emp === 'TOTAL' ? 'todas' : emp;
      }
      
      const filtered = applyFilters(state.allData);
      const periodFiltered = applyPeriodFilter(filtered);
      updateKpis(periodFiltered);
      renderCube(periodFiltered);
      renderAnual(filtered);
    });
  });
  
  // Rateio params toggle
  document.getElementById('params-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('params-body');
    const chev = document.getElementById('params-chevron');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      chev.style.transform = 'rotate(0deg)';
    } else {
      body.style.display = 'none';
      chev.style.transform = 'rotate(-90deg)';
    }
  });

  document.getElementById('params-filial')?.addEventListener('change', updateParamsUI);
  document.getElementById('params-mes-ano')?.addEventListener('change', updateParamsUI);
  
  document.getElementById('btn-save-params')?.addEventListener('click', async () => {
    const filial = document.getElementById('params-filial').value;
    const mesAno = document.getElementById('params-mes-ano').value; // YYYY-MM
    if(!filial || !mesAno) return;
    
    const pctPec = Number(document.getElementById('p-rateio-pecuaria').value || 0);
    const pctAgr = Number(document.getElementById('p-rateio-agricultura').value || 0);
    const pctAba = Number(document.getElementById('p-rateio-geral-aba').value || 0);
    const pctAgp = Number(document.getElementById('p-rateio-geral-agp').value || 0);
    
    const [y, m] = mesAno.split('-');
    const key = y + '_' + m;
    
    if (!state.params.financeiro) state.params.financeiro = {};
    if (!state.params.financeiro[filial]) state.params.financeiro[filial] = {};
    if (!state.params.financeiro.geral) state.params.financeiro.geral = {};
    
    state.params.financeiro[filial][key] = {
      pecuaria: pctPec,
      agricultura: pctAgr
    };
    
    state.params.financeiro.geral[key] = {
      aba: pctAba,
      agp: pctAgp
    };
    
    document.getElementById('params-save-status').textContent = 'Salvando...';
    try {
      await fetch('/api/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financeiro: state.params.financeiro })
      });
      document.getElementById('params-save-status').textContent = 'Salvo!';
      setTimeout(() => document.getElementById('params-save-status').textContent = '', 2000);
      loadAll(); // reload data with new rateio
    } catch(e) {
      console.error(e);
      document.getElementById('params-save-status').textContent = 'Erro';
    }
  });
}

async function loadParams() {
  try {
    const res = await fetch('/api/params').then(r => r.json());
    if (res.success && res.data) {
      state.params = res.data;
    }
    const d = new Date();
    document.getElementById('params-mes-ano').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    updateParamsUI();
    loadAll();
  } catch(e) {
    console.error(e);
  }
}

function updateParamsUI() {
  const filial = document.getElementById('params-filial').value;
  const mesAno = document.getElementById('params-mes-ano').value;
  if (!filial || !mesAno) return;
  const [y, m] = mesAno.split('-');
  const key = y + '_' + m;
  
  const fin = state.params.financeiro || {};
  const fObj = fin[filial] || {};
  const dObj = fObj[key] || { pecuaria: 50, agricultura: 50 }; // default 50/50 if not set
  
  document.getElementById('p-rateio-pecuaria').value = dObj.pecuaria;
  document.getElementById('p-rateio-agricultura').value = dObj.agricultura;

  const geralObj = fin.geral || {};
  const dGeral = geralObj[key] || { aba: 50, agp: 50 };
  
  document.getElementById('p-rateio-geral-aba').value = dGeral.aba;
  document.getElementById('p-rateio-geral-agp').value = dGeral.agp;
}

function getRateioParams(filial, ano, mes) {
  const key = ano + '_' + String(mes).padStart(2, '0');
  const fin = state.params.financeiro || {};
  const fObj = fin[filial] || {};
  return fObj[key] || { pecuaria: 50, agricultura: 50 };
}

function getRateioGeralParams(ano, mes) {
  const key = ano + '_' + String(mes).padStart(2, '0');
  const fin = state.params.financeiro || {};
  const fObj = fin.geral || {};
  return fObj[key] || { aba: 50, agp: 50 };
}

async function loadAll() {
  const hoje = new Date();
  
  // Buscar mês anterior e atual
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const dataDe = dateToStr(prevDate);
  const dataAte = dateToStr(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));

  try {
    const safraAno = getSafraYear(hoje);
    
    const [resDados, resFechados] = await Promise.all([
      fetch(`/api/financeiro/dados?data_de=${dataDe}&data_ate=${dataAte}`).then(r => r.json()),
      fetch(`/api/financeiro/fechados`).then(r => r.json())
    ]);

    if (resDados.success) {
      // Process Rateio
      const processed = [];
      for (const r of resDados.data || []) {
        r.ANO_MES = `${r.ANO}${String(r.MES).padStart(2, '0')}`;
        
        const vlrBrl = Number(r.VALOR_R$ || 0);
        const ptax = Number(r.PTAX || 1) || 1;
        const vlrUsd = vlrBrl / ptax;
        
        const tipoRateio = r.TIPO_RATEIO || '';
        
        if (tipoRateio === 'Rateio Geral') {
          // Rateio Geral: Duplo rateio. 
          // Primeiro por Filial
          const rateioGeral = getRateioGeralParams(r.ANO, r.MES);
          const pAba = rateioGeral.aba / 100;
          const pAgp = rateioGeral.agp / 100;

          // Segundo por Negócio dentro de cada Filial
          if (pAba > 0) {
            const rAba = getRateioParams('028501', r.ANO, r.MES);
            const pPecAba = rAba.pecuaria / 100;
            const pAgrAba = rAba.agricultura / 100;
            const brlAba = vlrBrl * pAba;
            const usdAba = vlrUsd * pAba;
            
            if (pPecAba > 0) processed.push({ ...r, FILIAL: '028501', NEGOCIO: 'PECUARIA', VLR_BRL: brlAba * pPecAba, VLR_USD: usdAba * pPecAba });
            if (pAgrAba > 0) processed.push({ ...r, FILIAL: '028501', NEGOCIO: 'AGRICULTURA', VLR_BRL: brlAba * pAgrAba, VLR_USD: usdAba * pAgrAba });
          }
          if (pAgp > 0) {
            const rAgp = getRateioParams('028503', r.ANO, r.MES);
            const pPecAgp = rAgp.pecuaria / 100;
            const pAgrAgp = rAgp.agricultura / 100;
            const brlAgp = vlrBrl * pAgp;
            const usdAgp = vlrUsd * pAgp;
            
            if (pPecAgp > 0) processed.push({ ...r, FILIAL: '028503', NEGOCIO: 'PECUARIA', VLR_BRL: brlAgp * pPecAgp, VLR_USD: usdAgp * pPecAgp });
            if (pAgrAgp > 0) processed.push({ ...r, FILIAL: '028503', NEGOCIO: 'AGRICULTURA', VLR_BRL: brlAgp * pAgrAgp, VLR_USD: usdAgp * pAgrAgp });
          }
          
        } else if (tipoRateio === 'Rateio Interno') {
          // Rateio Interno: Rateio por Negócio na própria filial
          const rateio = getRateioParams(r.FILIAL, r.ANO, r.MES);
          const pPec = rateio.pecuaria / 100;
          const pAgr = rateio.agricultura / 100;
          
          if (pPec > 0) processed.push({ ...r, NEGOCIO: 'PECUARIA', VLR_BRL: vlrBrl * pPec, VLR_USD: vlrUsd * pPec });
          if (pAgr > 0) processed.push({ ...r, NEGOCIO: 'AGRICULTURA', VLR_BRL: vlrBrl * pAgr, VLR_USD: vlrUsd * pAgr });
          
        } else {
          // Custeio Direto (Sem Rateio de percentual)
          let negocio = (tipoRateio === 'SOJA') ? 'AGRICULTURA' : (tipoRateio === 'PECUARIA' ? 'PECUARIA' : 'ND');
          processed.push({ ...r, NEGOCIO: negocio, VLR_BRL: vlrBrl, VLR_USD: vlrUsd });
        }
      }
      
      const mesesFechados = new Set();
      if (resFechados && resFechados.success && resFechados.data) {
        for (const f of resFechados.data) {
          mesesFechados.add(`${f.FF_ANO}_${f.FF_MES}`);
        }
        
        // Remove from processed any SQL data that is already closed
        const dadosSQLFiltrados = processed.filter(p => !mesesFechados.has(`${p.ANO}_${p.MES}`));
        processed.length = 0;
        processed.push(...dadosSQLFiltrados);
        
        for (const f of resFechados.data) {
           const ptax = Number(f.FF_PTAX || 1) || 1;
           const vlrBrl = Number(f.FF_VALOR_BRL || 0);
           const vlrUsd = vlrBrl / ptax;
           
           processed.push({
             ANO: f.FF_ANO,
             MES: f.FF_MES,
             ANO_MES: `${f.FF_ANO}${String(f.FF_MES).padStart(2, '0')}`,
             FILIAL: f.FF_EMPRESA,
             NEGOCIO: f.FF_NEGOCIO,
             CC_GRUPO: f.FF_CC_GRUPO,
             CC_SUBGRUPO: f.FF_CC_SUBGRUPO,
             TIPO_RATEIO: f.FF_TIPO_RATEIO || '',
             VLR_BRL: vlrBrl,
             VLR_USD: vlrUsd,
             PTAX: ptax,
             isFechado: true
           });
        }
      }
      state.mesesFechados = mesesFechados;
      
      state.allData = processed;
      const filtered = applyFilters(state.allData);
      const periodFiltered = applyPeriodFilter(filtered);
      updateKpis(periodFiltered);
      renderCube(periodFiltered);
      renderAnual(filtered);
    } else {
      console.error('Erro /api/financeiro/dados:', resDados.error);
    }
  } catch (err) {
    console.error('[loadAll] Erro:', err);
  }
}

function applyFilters(data) {
  const empresa = document.getElementById('f-empresa')?.value;
  return data.filter(r => {
    if (empresa && empresa !== 'todas' && r.FILIAL !== empresa) return false;
    return true;
  });
}

function getTipoConfig(tipoName) {
  const t = (tipoName || '').toUpperCase();
  if (t.includes('PECUARIA')) return { badge: 'badge-pec', cor: '#f59e0b', icon: '🐄' };
  if (t.includes('AGRICULTURA')) return { badge: 'badge-agr', cor: '#10b981', icon: '🌾' };
  return { badge: 'badge-out',  cor: '#94a3b8', icon: '📦' };
}

function applyPeriodFilter(data) {
  const hoje = new Date();
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAtual    = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };
  const periodo = state.kpiPeriodo === 'anterior' ? mesAnterior : mesAtual;
  return data.filter(r => {
    return Number(r.ANO) === periodo.ano && Number(r.MES) === periodo.mes;
  });
}

function updateKpis(data) {
  const hoje = new Date();
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAtual    = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

  const periodo = state.kpiPeriodo === 'anterior' ? mesAnterior : mesAtual;

  let custoTotal = 0, custoUsd = 0;
  const porNegocio  = {};

  for (const r of data) {
    const brl = Number(r.VLR_BRL || 0);
    const usd = Number(r.VLR_USD || 0);
    custoTotal += brl;
    custoUsd   += usd;
    const t = r.NEGOCIO || 'OUTROS';
    if (!porNegocio[t]) porNegocio[t] = { brl: 0, usd: 0 };
    porNegocio[t].brl += brl;
    porNegocio[t].usd += usd;
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
    const tipos = Object.keys(porNegocio).sort((a, b) => a.localeCompare(b));
    let html = '';
    for (const tipo of tipos) {
      const cfg = getTipoConfig(tipo);
      const val = usarUsd ? (porNegocio[tipo]?.usd||0) : (porNegocio[tipo]?.brl||0);
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

function toggleRows(parentId) {
  const rows = document.querySelectorAll(`tr[data-parent="${parentId}"]`);
  rows.forEach(r => {
    r.classList.toggle('row-hidden');
    // Se estou escondendo, escondo tb os filhos
    if (r.classList.contains('row-hidden')) {
      const id = r.getAttribute('data-id');
      if (id) {
        document.querySelectorAll(`tr[data-parent="${id}"]`).forEach(c => c.classList.add('row-hidden'));
      }
    }
  });
  
  // Muda o ícone (gambi rápida: pega o pai de quem chamou e busca o .toggle-btn)
  const ev = window.event;
  if(ev && ev.target) {
    if (ev.target.textContent === '▶') ev.target.textContent = '▼';
    else if (ev.target.textContent === '▼') ev.target.textContent = '▶';
  }
}

function renderCube(data) {
  const body = document.getElementById('cube-body');
  if (!body) return;

  const tree = {}; 
  const grandTotal = {
    pecAba: { brl: 0, usd: 0 },
    pecAgp: { brl: 0, usd: 0 },
    sojaAgp: { brl: 0, usd: 0 },
    consolidado: { brl: 0, usd: 0 }
  };

  const createNode = () => ({
    pecAba: { brl: 0, usd: 0 },
    pecAgp: { brl: 0, usd: 0 },
    sojaAgp: { brl: 0, usd: 0 },
    consolidado: { brl: 0, usd: 0 },
    children: {}
  });

  const addValue = (node, filial, negocio, brl, usd) => {
    if (filial === '028501' && negocio === 'PECUARIA') {
      node.pecAba.brl += brl; node.pecAba.usd += usd;
    } else if (filial === '028503' && negocio === 'PECUARIA') {
      node.pecAgp.brl += brl; node.pecAgp.usd += usd;
    } else if (filial === '028503' && negocio === 'AGRICULTURA') {
      node.sojaAgp.brl += brl; node.sojaAgp.usd += usd;
    }
    node.consolidado.brl += brl; node.consolidado.usd += usd;
  };

  for (const r of data) {
    const tpRat = r.TIPO_RATEIO || 'Sem Tipo Rateio';
    const grupo = r.CC_GRUPO || '(sem grupo)';
    const subgrp = r.CC_SUBGRUPO || '(sem subgrupo)';
    const tpGer = r.TIPO_GERENCIAL || 'Sem Classificação';
    
    const fil = r.FILIAL;
    const neg = r.NEGOCIO;
    let colName = 'unknown';
    if (fil === '028501' && neg === 'PECUARIA') colName = 'pecAba';
    else if (fil === '028503' && neg === 'PECUARIA') colName = 'pecAgp';
    else if (fil === '028503' && neg === 'AGRICULTURA') colName = 'sojaAgp';

    const titulo = `${r.PREFIXO || ''} ${r.NUMERO || ''} ${r.PARCELA || ''}`.trim();
    let baseDocKey = `${r.DATA_PAGAMENTO}_${titulo}_${r.NATUREZA || ''}_${r.HISTORICO_BAIXA || ''}`;

    if (!tree[tpRat]) tree[tpRat] = createNode();
    const TR = tree[tpRat];

    if (!TR.children[grupo]) TR.children[grupo] = createNode();
    const G = TR.children[grupo];

    if (!G.children[subgrp]) G.children[subgrp] = createNode();
    const SG = G.children[subgrp];
    
    if (!SG.children[tpGer]) SG.children[tpGer] = createNode();
    const TG = SG.children[tpGer];

    // Documentos no último nível
    if (!TG.docsMap) { TG.docsMap = {}; TG.docs = []; }
    const docKey = r.REGSE5 ? String(r.REGSE5) : baseDocKey;

    if (!TG.docsMap[docKey]) {
      const DOC = {
        REGSE5: r.REGSE5 || '',
        DATA: r.DATA_PAGAMENTO,
        TITULO: titulo || 'Sem Título',
        NATUREZA: r.NATUREZA,
        HISTORICO: r.HISTORICO_BAIXA,
        FORNECEDOR: r.BENEF || r.CLI_FOR,
        vals: createNode()
      };
      TG.docsMap[docKey] = DOC;
      TG.docs.push(DOC);
    }
    const DOC = TG.docsMap[docKey];

    const brl  = Number(r.VLR_BRL || 0);
    const usd  = Number(r.VLR_USD || 0);

    addValue(TR, fil, neg, brl, usd);
    addValue(G, fil, neg, brl, usd);
    addValue(SG, fil, neg, brl, usd);
    addValue(TG, fil, neg, brl, usd);
    addValue(DOC.vals, fil, neg, brl, usd);
    addValue(grandTotal, fil, neg, brl, usd);
  }

  const renderCols = (node) => {
    const usarUsd = state.moeda === 'USD';
    const vPecAba = usarUsd ? node.pecAba.usd : node.pecAba.brl;
    const vPecAgp = usarUsd ? node.pecAgp.usd : node.pecAgp.brl;
    const vSojaAgp = usarUsd ? node.sojaAgp.usd : node.sojaAgp.brl;
    const vConsol = usarUsd ? node.consolidado.usd : node.consolidado.brl;
    return `
      <td class="text-right">${vPecAba === 0 ? '—' : fmtMoeda(vPecAba)}</td>
      <td class="text-right">${vPecAgp === 0 ? '—' : fmtMoeda(vPecAgp)}</td>
      <td class="text-right">${vSojaAgp === 0 ? '—' : fmtMoeda(vSojaAgp)}</td>
      <td class="text-right" style="font-weight:bold; color:var(--text-white);">${vConsol === 0 ? '—' : fmtMoeda(vConsol)}</td>
    `;
  };

  const rowsHtml = [];
  let uid = 0;

  const trsOrdem = Object.keys(tree).sort((a, b) => a.localeCompare(b));
  for (const tpRat of trsOrdem) {
    const TR = tree[tpRat];
    const trId = `tr_${uid++}`;
    
    rowsHtml.push(`
      <tr class="lvl-0" data-id="${trId}">
        <td><span class="toggle-btn" onclick="toggleRows('${trId}')">▶</span><strong>${escHtml(tpRat)}</strong></td>
        <td>—</td><td>—</td><td>—</td>
        ${renderCols(TR)}
      </tr>
    `);

    const gOrdem = Object.keys(TR.children).sort((a, b) => a.localeCompare(b));
    let gUid = 0;
    for (const grupo of gOrdem) {
      const G = TR.children[grupo];
      const gId = `g_${trId}_${gUid++}`;
      
      rowsHtml.push(`
        <tr class="lvl-1 row-hidden" data-parent="${trId}" data-id="${gId}">
          <td style="padding-left: 28px;"><span class="toggle-btn" onclick="toggleRows('${gId}')">▶</span>${escHtml(grupo)}</td>
          <td>—</td><td>—</td><td>—</td>
          ${renderCols(G)}
        </tr>
      `);

      const sgOrdem = Object.keys(G.children).sort((a, b) => a.localeCompare(b));
      let sgUid = 0;
      for (const subgrp of sgOrdem) {
        const SG = G.children[subgrp];
        const sgId = `sg_${gId}_${sgUid++}`;

        rowsHtml.push(`
          <tr class="lvl-2 row-hidden" data-parent="${gId}" data-id="${sgId}">
            <td style="padding-left: 52px;"><span class="toggle-btn" onclick="toggleRows('${sgId}')">▶</span>${escHtml(subgrp)}</td>
            <td>—</td><td>—</td><td>—</td>
            ${renderCols(SG)}
          </tr>
        `);

        const tgsOrdem = Object.keys(SG.children).sort((a, b) => a.localeCompare(b));
        let tgUid = 0;
        for (const tpGer of tgsOrdem) {
          const TG = SG.children[tpGer];
          const tgId = `tg_${sgId}_${tgUid++}`;

          rowsHtml.push(`
            <tr class="lvl-3 row-hidden" data-parent="${sgId}" data-id="${tgId}">
              <td style="padding-left: 76px; font-style: italic;"><span class="toggle-btn" onclick="toggleRows('${tgId}')">▶</span>${escHtml(tpGer)}</td>
              <td>—</td><td>—</td><td>—</td>
              ${renderCols(TG)}
            </tr>
          `);
          
          if (TG.docs) {
            for (const doc of TG.docs) {
              const d = doc.DATA ? new Date(doc.DATA).toLocaleDateString('pt-BR') : '—';
              rowsHtml.push(`
                <tr class="lvl-3 row-hidden" data-parent="${tgId}">
                  <td style="padding-left: 100px; color: #94a3b8;">${escHtml(doc.TITULO)} - ${escHtml(doc.NATUREZA)} - ${escHtml(doc.HISTORICO)}</td>
                  <td>${escHtml(doc.REGSE5)}</td>
                  <td>${d}</td>
                  <td>${escHtml(doc.FORNECEDOR)}</td>
                  ${renderCols(doc.vals)}
                </tr>
              `);
            }
          }
        }
      }
    }
  }

  body.innerHTML = rowsHtml.join('');

  // Update Grand Total in Tfoot
  const usarUsd = state.moeda === 'USD';
  const elTotPecAba = document.getElementById('tot-pec-aba');
  const elTotPecAgp = document.getElementById('tot-pec-agp');
  const elTotSojaAgp = document.getElementById('tot-soja-agp');
  const elTotConsol = document.getElementById('tot-consolidado');
  
  if (elTotPecAba) elTotPecAba.textContent = fmtMoeda(usarUsd ? grandTotal.pecAba.usd : grandTotal.pecAba.brl);
  if (elTotPecAgp) elTotPecAgp.textContent = fmtMoeda(usarUsd ? grandTotal.pecAgp.usd : grandTotal.pecAgp.brl);
  if (elTotSojaAgp) elTotSojaAgp.textContent = fmtMoeda(usarUsd ? grandTotal.sojaAgp.usd : grandTotal.sojaAgp.brl);
  if (elTotConsol) elTotConsol.textContent = fmtMoeda(usarUsd ? grandTotal.consolidado.usd : grandTotal.consolidado.brl);
}

function getSafraMonths(hoje = new Date()) {
  const safraAno = getSafraYear(hoje);
  const arr = [];
  for (let i = 0; i < 12; i++) {
    let m = 9 + i;
    let y = safraAno - 1;
    if (m > 12) {
      m -= 12;
      y = safraAno;
    }
    arr.push(`${y}${String(m).padStart(2,'0')}`);
  }
  return arr;
}

function getContabilMonths(hoje = new Date()) {
  const ano = hoje.getFullYear();
  const arr = [];
  for (let i = 1; i <= 12; i++) {
    arr.push(`${ano}${String(i).padStart(2,'0')}`);
  }
  return arr;
}

function renderAnual(data) {
  const thead = document.getElementById('anual-thead');
  const tbody = document.getElementById('anual-tbody');
  if (!thead || !tbody) return;

  const safraAno = getSafraYear(new Date());
  const anoAtual = new Date().getFullYear();
  const labelPeriodo = document.getElementById('label-periodo');
  if (labelPeriodo) {
     labelPeriodo.textContent = state.tipoCalendario === 'safra' 
       ? `Safra ${safraAno - 1}/${String(safraAno).substring(2)}`
       : `Ano ${anoAtual}`;
  }

  const sections = {
    'DIRETO': { title: 'Custeio Operacional Direto', rows: {} },
    'INDIRETO': { title: 'Custeio Operacional Indireto', rows: {} },
    'RATEADO': { title: 'Despesas Administrativas rateadas', rows: {} }
  };

  const mesesArr = state.tipoCalendario === 'safra' ? getSafraMonths() : getContabilMonths();
  const dolarStats = {};
  for (const m of mesesArr) {
    dolarStats[m] = { 
      pecAba: {brl:0, usd:0}, 
      pecAgp: {brl:0, usd:0}, 
      sojaAgp: {brl:0, usd:0}, 
      consolidado: {brl:0, usd:0} 
    };
  }
  const totalAnoDolarStats = { 
    pecAba: {brl:0, usd:0}, 
    pecAgp: {brl:0, usd:0}, 
    sojaAgp: {brl:0, usd:0}, 
    consolidado: {brl:0, usd:0} 
  };
  
  let totalBrl = 0, totalUsd = 0;
  
  
  for (const r of data) {
    if (!r.ANO_MES) continue;
    
    let secKey = 'DIRETO';
    const tipoRateio = r.TIPO_RATEIO || '';
    if (tipoRateio === 'Rateio Interno') secKey = 'INDIRETO';
    if (tipoRateio === 'Rateio Geral') secKey = 'RATEADO';
    
    const grupo = r.CC_GRUPO || '(sem grupo)';
    
    if (!sections[secKey].rows[grupo]) {
      sections[secKey].rows[grupo] = {};
    }
    
    if (!sections[secKey].rows[grupo][r.ANO_MES]) {
      sections[secKey].rows[grupo][r.ANO_MES] = { pecAba: 0, pecAgp: 0, sojaAgp: 0, consolidado: 0 };
    }
    
    const mData = sections[secKey].rows[grupo][r.ANO_MES];
    if (mData) {
      const valBrl = Number(r.VLR_BRL || 0);
      const valUsd = Number(r.VLR_USD || 0);
      const val = state.moeda === 'USD' ? valUsd : valBrl;
      
      
      let col = null;
      if (r.FILIAL === '028501' && r.NEGOCIO === 'PECUARIA') col = 'pecAba';
      if (r.FILIAL === '028503' && r.NEGOCIO === 'PECUARIA') col = 'pecAgp';
      if (r.FILIAL === '028503' && r.NEGOCIO === 'AGRICULTURA') col = 'sojaAgp';
      
      if (dolarStats[r.ANO_MES]) {
        if (col) {
          dolarStats[r.ANO_MES][col].brl += valBrl;
          dolarStats[r.ANO_MES][col].usd += valUsd;
          totalAnoDolarStats[col].brl += valBrl;
          totalAnoDolarStats[col].usd += valUsd;
        }
        dolarStats[r.ANO_MES].consolidado.brl += valBrl;
        dolarStats[r.ANO_MES].consolidado.usd += valUsd;
        totalAnoDolarStats.consolidado.brl += valBrl;
        totalAnoDolarStats.consolidado.usd += valUsd;
      }
      totalBrl += valBrl;
      totalUsd += valUsd;
      
      if (col) {
        mData[col] += val;
      }
      mData.consolidado += val;
    }
  }
  const formatMes = (anoMes) => {
    if (!anoMes || anoMes.length !== 6) return anoMes;
    const y = anoMes.substring(0,4);
    const m = parseInt(anoMes.substring(4,6), 10);
    const nomesMes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    return `${nomesMes[m-1]}/${y.substring(2)}`;
  };

  // Build thead
  let theadHtml = `<tr><th rowspan="2" class="sticky-col" style="min-width: 200px;">Grupo de Custo</th>`;
  for (const m of mesesArr) {
    theadHtml += `<th colspan="4">${formatMes(m)}</th>`;
  }
  theadHtml += `<th colspan="4">Total Ano</th></tr><tr>`;
  
  for (const m of [...mesesArr, 'TOTAL']) {
    theadHtml += `
      <th style="font-size: 11px; font-weight: normal;">Pecuaria Aba</th>
      <th style="font-size: 11px; font-weight: normal;">Pecuaria AGP</th>
      <th style="font-size: 11px; font-weight: normal;">Soja AGP</th>
      <th style="font-size: 11px; font-weight: bold;" class="col-consolidado">Consolidado</th>
    `;
  }
  theadHtml += `</tr>`;
  thead.innerHTML = theadHtml;

  // Build tbody
  const fmt = state.moeda === 'USD' ? fmtMoedaUsd : fmtMoedaBrl;
  let tbodyHtml = '';

  const secKeys = ['DIRETO', 'INDIRETO', 'RATEADO'];
  
  for (const sk of secKeys) {
    const sec = sections[sk];
    
    // Section Header row (Subtotal)
    tbodyHtml += `<tr class="section-total-row">`;
    tbodyHtml += `<td class="sticky-col" style="background-color: #334155; color: #f8fafc; font-weight: bold;">${sec.title}</td>`;
    
    // Aggregate totals for the section header
    const secTotals = {};
    const grupos = Object.keys(sec.rows).sort((a, b) => a.localeCompare(b));
    
    for (const m of mesesArr) {
      secTotals[m] = { pecAba: 0, pecAgp: 0, sojaAgp: 0, consolidado: 0 };
    }
    secTotals['TOTAL'] = { pecAba: 0, pecAgp: 0, sojaAgp: 0, consolidado: 0 };

    for (const g of grupos) {
      const gRow = sec.rows[g];
      for (const m of mesesArr) {
        if (gRow[m]) {
          secTotals[m].pecAba += gRow[m].pecAba;
          secTotals[m].pecAgp += gRow[m].pecAgp;
          secTotals[m].sojaAgp += gRow[m].sojaAgp;
          secTotals[m].consolidado += gRow[m].consolidado;
          
          secTotals['TOTAL'].pecAba += gRow[m].pecAba;
          secTotals['TOTAL'].pecAgp += gRow[m].pecAgp;
          secTotals['TOTAL'].sojaAgp += gRow[m].sojaAgp;
          secTotals['TOTAL'].consolidado += gRow[m].consolidado;
        }
      }
    }
    
    for (const m of [...mesesArr, 'TOTAL']) {
      const t = secTotals[m];
      tbodyHtml += `
        <td style="background-color: #334155; color: #f8fafc; font-weight: bold;">${fmt(t.pecAba)}</td>
        <td style="background-color: #334155; color: #f8fafc; font-weight: bold;">${fmt(t.pecAgp)}</td>
        <td style="background-color: #334155; color: #f8fafc; font-weight: bold;">${fmt(t.sojaAgp)}</td>
        <td style="background-color: #334155; color: #f8fafc; font-weight: 900;" class="col-consolidado">${fmt(t.consolidado)}</td>
      `;
    }
    tbodyHtml += `</tr>`;
    
    // Group rows
    for (const g of grupos) {
      tbodyHtml += `<tr>`;
      tbodyHtml += `<td class="sticky-col" style="padding-left: 20px;">${escHtml(g)}</td>`;
      const gRow = sec.rows[g];
      
      const gTot = { pecAba: 0, pecAgp: 0, sojaAgp: 0, consolidado: 0 };
      for (const m of mesesArr) {
        const d = gRow[m] || { pecAba: 0, pecAgp: 0, sojaAgp: 0, consolidado: 0 };
        gTot.pecAba += d.pecAba;
        gTot.pecAgp += d.pecAgp;
        gTot.sojaAgp += d.sojaAgp;
        gTot.consolidado += d.consolidado;
        
        tbodyHtml += `
          <td>${fmt(d.pecAba)}</td>
          <td>${fmt(d.pecAgp)}</td>
          <td>${fmt(d.sojaAgp)}</td>
          <td class="col-consolidado">${fmt(d.consolidado)}</td>
        `;
      }
      
      tbodyHtml += `
        <td>${fmt(gTot.pecAba)}</td>
        <td>${fmt(gTot.pecAgp)}</td>
        <td>${fmt(gTot.sojaAgp)}</td>
        <td class="col-consolidado">${fmt(gTot.consolidado)}</td>
      </tr>`;
    }
    
    // Spacing between sections
    tbodyHtml += `<tr><td colspan="${(mesesArr.length + 1) * 4 + 1}" style="height: 20px; border: none; background: transparent;"></td></tr>`;
  }

  // Valor Dólar row
  tbodyHtml += `
    <tr style="border-top: 2px solid rgba(255,255,255,0.1);">
      <td class="sticky-col" style="font-weight:bold;"><i class="fa-solid fa-brazilian-real-sign" style="color:#22c55e;"></i> Valor Dólar</td>
  `;
  const calcTx = (st) => st.usd ? (st.brl / st.usd) : 0;
  const fmtTx = (val) => val ? val.toLocaleString('pt-BR', {minimumFractionDigits:4, maximumFractionDigits:4}) : '—';

  for (const m of mesesArr) {
     const dStat = dolarStats[m];
     tbodyHtml += `
       <td class="text-center" style="font-weight:bold; color:var(--text-muted);">${fmtTx(calcTx(dStat.pecAba))}</td>
       <td class="text-center" style="font-weight:bold; color:var(--text-muted);">${fmtTx(calcTx(dStat.pecAgp))}</td>
       <td class="text-center" style="font-weight:bold; color:var(--text-muted);">${fmtTx(calcTx(dStat.sojaAgp))}</td>
       <td class="text-center col-consolidado" style="font-weight:bold; color:var(--text-muted);">${fmtTx(calcTx(dStat.consolidado))}</td>
     `;
  }
  
  tbodyHtml += `
       <td class="text-center" style="font-weight:bold; color:var(--text-white);">${fmtTx(calcTx(totalAnoDolarStats.pecAba))}</td>
       <td class="text-center" style="font-weight:bold; color:var(--text-white);">${fmtTx(calcTx(totalAnoDolarStats.pecAgp))}</td>
       <td class="text-center" style="font-weight:bold; color:var(--text-white);">${fmtTx(calcTx(totalAnoDolarStats.sojaAgp))}</td>
       <td class="text-center col-consolidado" style="font-weight:bold; color:var(--text-white);">${fmtTx(calcTx(totalAnoDolarStats.consolidado))}</td>
    </tr>
  `;

  tbody.innerHTML = tbodyHtml;

  // Status and Action Rows
  const dataHoje = new Date();
  const currAnoMes = `${dataHoje.getFullYear()}${String(dataHoje.getMonth() + 1).padStart(2,'0')}`;
  
  const statusRowHtml = [];
  const actionRowHtml = [];
  statusRowHtml.push(`<tr style="background: rgba(0,0,0,0.2);"><td class="sticky-col" style="font-weight:bold; color:var(--text-muted);">Status</td>`);
  actionRowHtml.push(`<tr style="background: rgba(0,0,0,0.2);"><td class="sticky-col" style="font-weight:bold; color:var(--text-muted);">Ação</td>`);
  
  for (const m of mesesArr) {
     const fechado = state.mesesFechados && state.mesesFechados.has(`${m.substring(0,4)}_${parseInt(m.substring(4,6), 10)}`);
     
     let statusHtml = '';
     let actionHtml = '';
     
     if (fechado) {
        statusHtml = `<span style="color:#22c55e;"><i class="fa-solid fa-check"></i> Fechado</span>`;
        actionHtml = `<span style="color:#22c55e;"><i class="fa-solid fa-check"></i> Fechado</span>`;
     } else {
        if (m < currAnoMes) {
           statusHtml = `<span style="color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> Pendente</span>`;
           actionHtml = `<button class="btn btn-sm" style="background:#059669;color:#fff;font-size:11px;padding:4px 8px;border:none;border-radius:4px;cursor:pointer;" onclick="fecharMesFinanceiro('${m}')"><i class="fa-solid fa-lock"></i> Fechar Mês</button>`;
        } else if (m === currAnoMes) {
           statusHtml = `<span style="color:#3b82f6;"><i class="fa-solid fa-hourglass-half"></i> Em Curso</span>`;
           actionHtml = `—`;
        } else {
           statusHtml = `—`;
           actionHtml = `—`;
        }
     }
     statusRowHtml.push(`<td colspan="4" class="text-center">${statusHtml}</td>`);
     actionRowHtml.push(`<td colspan="4" class="text-center">${actionHtml}</td>`);
  }
  
  statusRowHtml.push(`<td colspan="4"></td></tr>`);
  actionRowHtml.push(`<td colspan="4"></td></tr>`);
  
  tbodyHtml += `<tr class="section-row"><td class="sticky-col" style="background:rgba(255,255,255,0.05); font-weight:bold; padding: 8px 10px; font-size:11px; letter-spacing:1px;">STATUS DE FECHAMENTO</td><td colspan="${(mesesArr.length + 1) * 4}" style="background:rgba(255,255,255,0.05);"></td></tr>`;
  tbodyHtml += statusRowHtml.join('');
  tbodyHtml += actionRowHtml.join('');

  tbody.innerHTML = tbodyHtml;
}

window.fecharMesFinanceiro = async function(anoMes) {
  if (!confirm(`Deseja fechar o mês ${anoMes.substring(4,6)}/${anoMes.substring(0,4)}?`)) return;
  
  const mData = state.allData.filter(d => d.ANO_MES === anoMes && !d.isFechado);
  
  if (mData.length === 0) {
     alert('Nenhum dado aberto encontrado para o fechamento deste mês.');
     return;
  }
  
  const payloadDados = mData.map(d => ({
    empresa: d.FILIAL,
    negocio: d.NEGOCIO,
    grupo: d.CC_GRUPO,
    subgrupo: d.CC_SUBGRUPO,
    tipoRateio: d.TIPO_RATEIO,
    vlrBrl: d.VLR_BRL,
    ptax: d.PTAX
  }));
  
  const body = {
    ano: anoMes.substring(0,4),
    mes: parseInt(anoMes.substring(4,6), 10),
    dados: payloadDados
  };
  
  try {
    const res = await fetch('/api/financeiro/fechar-mes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
    
    if (res.success) {
      alert('Mês fechado com sucesso!');
      loadAll();
    } else {
      alert('Erro: ' + res.error);
    }
  } catch (e) {
    alert('Erro ao fechar mês: ' + e.message);
  }
};

// ==========================================
// MODAL DE AJUSTES MANUAIS (CRUD)
// ==========================================
let allFechamentosModal = [];

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

['filter-modal-periodo', 'filter-modal-filial', 'filter-modal-negocio'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', renderFechamentosList);
});

function closeEditFechamentoModal() {
  document.getElementById('modal-edit-fechamento').classList.remove('open');
  document.getElementById('edit-fechamento-form-view').style.display = 'none';
  document.getElementById('edit-fechamento-list-view').style.display = 'block';
  loadAll(); // Recarrega os dados da tela principal ao fechar
}

async function loadClosedFechamentos() {
  try {
    const res = await fetch('/api/financeiro/fechados');
    const json = await res.json();
    if (json.success) {
      allFechamentosModal = json.data || [];
      renderFechamentosList();
    } else {
      console.error(json.error);
    }
  } catch(e) {
    console.error(e);
  }
}

function renderFechamentosList() {
  const tbody = document.getElementById('edit-fechamento-list-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const fPeriodo = document.getElementById('filter-modal-periodo')?.value.replace('-', ''); // YYYYMM
  const fFilial = document.getElementById('filter-modal-filial')?.value;
  const fNegocio = document.getElementById('filter-modal-negocio')?.value;

  const filtered = allFechamentosModal.filter(r => {
    const rm = `${r.FF_ANO}${String(r.FF_MES).padStart(2,'0')}`;
    if (fPeriodo && rm !== fPeriodo) return false;
    if (fFilial && r.FF_EMPRESA !== fFilial) return false;
    if (fNegocio && r.FF_NEGOCIO !== fNegocio) return false;
    return true;
  });

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${String(r.FF_MES).padStart(2,'0')}/${r.FF_ANO}</td>
      <td>${r.FF_EMPRESA || ''}</td>
      <td>${r.FF_NEGOCIO || ''}</td>
      <td>${r.FF_CC_GRUPO || ''}</td>
      <td>${r.FF_CC_SUBGRUPO || ''}</td>
      <td>${r.FF_TIPO_RATEIO || ''}</td>
      <td class="text-right">${fmtMoedaBrl(r.FF_VALOR_BRL || 0)}</td>
      <td class="text-right">${Number(r.FF_PTAX || 1).toFixed(4)}</td>
      <td>
        <button class="btn btn-sm" style="color:var(--text-color);background:rgba(255,255,255,0.1)" onclick="editFechamento('${r.ID}')" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm" style="color:#ef4444;background:rgba(239,68,68,0.1)" onclick="deleteFechamento('${r.ID}')" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openNewFechamentoForm = function() {
  document.getElementById('edit-fi-id').value = '';
  document.getElementById('edit-fi-periodo').value = '';
  document.getElementById('edit-fi-filial').value = '028501';
  document.getElementById('edit-fi-negocio').value = 'PECUARIA';
  document.getElementById('edit-fi-grupo').value = '';
  document.getElementById('edit-fi-subgrupo').value = '';
  document.getElementById('edit-fi-tiporateio').value = '';
  document.getElementById('edit-fi-custo-brl').value = '';
  document.getElementById('edit-fi-ptax').value = '5.0000';
  document.getElementById('edit-fi-obs').value = '';

  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
};

window.editFechamento = function(id) {
  const r = allFechamentosModal.find(x => x.ID === id);
  if (!r) return;

  document.getElementById('edit-fi-id').value = r.ID;
  document.getElementById('edit-fi-periodo').value = `${r.FF_ANO}-${String(r.FF_MES).padStart(2,'0')}`;
  document.getElementById('edit-fi-filial').value = r.FF_EMPRESA;
  document.getElementById('edit-fi-negocio').value = r.FF_NEGOCIO;
  document.getElementById('edit-fi-grupo').value = r.FF_CC_GRUPO || '';
  document.getElementById('edit-fi-subgrupo').value = r.FF_CC_SUBGRUPO || '';
  document.getElementById('edit-fi-tiporateio').value = r.FF_TIPO_RATEIO || '';
  document.getElementById('edit-fi-custo-brl').value = r.FF_VALOR_BRL || 0;
  document.getElementById('edit-fi-ptax').value = r.FF_PTAX || 1;
  document.getElementById('edit-fi-obs').value = ''; // OBS não tem no banco para essa tabela, apenas front visual

  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
};

async function saveFechamentoForm() {
  const id = document.getElementById('edit-fi-id').value;
  const periodo = document.getElementById('edit-fi-periodo').value; // YYYY-MM
  if (!periodo) {
    alert('Informe o período.');
    return;
  }
  
  const payload = {
    ano: periodo.split('-')[0],
    mes: parseInt(periodo.split('-')[1], 10),
    filial: document.getElementById('edit-fi-filial').value,
    negocio: document.getElementById('edit-fi-negocio').value,
    grupo: document.getElementById('edit-fi-grupo').value,
    subgrupo: document.getElementById('edit-fi-subgrupo').value,
    tiporateio: document.getElementById('edit-fi-tiporateio').value,
    vlrBrl: parseFloat(document.getElementById('edit-fi-custo-brl').value || 0),
    ptax: parseFloat(document.getElementById('edit-fi-ptax').value || 1)
  };

  try {
    const url = id ? `/api/financeiro/ajuste/${id}` : '/api/financeiro/ajuste';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      document.getElementById('edit-fechamento-form-view').style.display = 'none';
      document.getElementById('edit-fechamento-list-view').style.display = 'block';
      loadClosedFechamentos();
    } else {
      alert('Erro: ' + json.error);
    }
  } catch(e) {
    alert('Erro ao salvar: ' + e.message);
  }
}

window.deleteFechamento = async function(id) {
  if (!confirm('Excluir este lançamento manual permanentemente?')) return;
  try {
    const res = await fetch(`/api/financeiro/ajuste/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      loadClosedFechamentos();
    } else {
      alert('Erro: ' + json.error);
    }
  } catch(e) {
    alert('Erro: ' + e.message);
  }
};
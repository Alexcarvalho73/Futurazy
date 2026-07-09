
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
  
  document.querySelectorAll('.moeda-btn[data-moeda]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.moeda-btn[data-moeda]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.moeda = btn.dataset.moeda;
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
      renderCube(filtered);
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

  document.getElementById('f-empresa')?.addEventListener('change', () => {
    const filtered = applyFilters(state.allData);
    updateKpis(filtered);
    renderCube(filtered);
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
    const resDados = await fetch(`/api/financeiro/dados?data_de=${dataDe}&data_ate=${dataAte}`).then(r => r.json());

    if (resDados.success) {
      // Process Rateio
      const processed = [];
      for (const r of resDados.data || []) {
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
      
      state.allData = processed;
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
      renderCube(filtered);
      renderAnual(state.allData); // Using allData to show all columns
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
    if (empresa && empresa !== 'todas' && r.NEGOCIO !== empresa) return false;
    return true;
  });
}

function getTipoConfig(tipoName) {
  const t = (tipoName || '').toUpperCase();
  if (t.includes('PECUARIA')) return { badge: 'badge-pec', cor: '#f59e0b', icon: '🐄' };
  if (t.includes('AGRICULTURA')) return { badge: 'badge-agr', cor: '#10b981', icon: '🌾' };
  return { badge: 'badge-out',  cor: '#94a3b8', icon: '📦' };
}

function updateKpis(data) {
  const hoje = new Date();
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAtual    = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

  const periodo = state.kpiPeriodo === 'anterior' ? mesAnterior : mesAtual;

  const filtered = data.filter(r => {
    return Number(r.ANO) === periodo.ano && Number(r.MES) === periodo.mes;
  });

  let custoTotal = 0, custoUsd = 0;
  const porNegocio  = {};

  for (const r of filtered) {
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

  // Hierarquia: TIPO_RATEIO -> FILIAL -> CC_GRUPO -> CC_SUBGRUPO -> TIPO_GERENCIAL -> Detalhes
  const tree = {}; 

  let grandBrl = 0, grandUsd = 0;

  for (const r of data) {
    const tpRat = r.TIPO_RATEIO || 'Sem Tipo Rateio';
    const filial = r.FILIAL || 'Sem Filial';
    const grupo = r.CC_GRUPO || '(sem grupo)';
    const subgrp = r.CC_SUBGRUPO || '(sem subgrupo)';
    const tpGer = r.TIPO_GERENCIAL || 'Sem Classificação';

    if (!tree[tpRat]) tree[tpRat] = { _brl: 0, _usd: 0, filiais: {} };
    const TR = tree[tpRat];

    if (!TR.filiais[filial]) TR.filiais[filial] = { _brl: 0, _usd: 0, grupos: {} };
    const F = TR.filiais[filial];

    if (!F.grupos[grupo]) F.grupos[grupo] = { _brl: 0, _usd: 0, subgrupos: {} };
    const G = F.grupos[grupo];

    if (!G.subgrupos[subgrp]) G.subgrupos[subgrp] = { _brl: 0, _usd: 0, tpGers: {} };
    const SG = G.subgrupos[subgrp];
    
    if (!SG.tpGers[tpGer]) SG.tpGers[tpGer] = { _brl: 0, _usd: 0, rows: [] };
    const TG = SG.tpGers[tpGer];

    const brl  = Number(r.VLR_BRL || 0);
    const usd  = Number(r.VLR_USD || 0);

    TR._brl += brl; TR._usd += usd;
    F._brl += brl; F._usd += usd;
    G._brl += brl; G._usd += usd;
    SG._brl += brl; SG._usd += usd;
    TG._brl += brl; TG._usd += usd;
    TG.rows.push(r);
    grandBrl += brl; grandUsd += usd;
  }

  const rowsHtml = [];
  let uid = 0;

  const trsOrdem = Object.keys(tree).sort((a, b) => a.localeCompare(b));
  for (const tpRat of trsOrdem) {
    const TR = tree[tpRat];
    const trId = `tr_${uid++}`;
    
    rowsHtml.push(`
      <tr class="lvl-0" data-id="${trId}">
        <td><span class="toggle-btn" onclick="toggleRows('${trId}')">▶</span><strong>${escHtml(tpRat)}</strong></td>
        <td>—</td><td>—</td>
        <td class="text-right">${fmtMoedaUsd(TR._usd)}</td><td class="text-right">${fmtMoedaBrl(TR._brl)}</td>
        <td class="text-right">—</td><td class="text-right">—</td>
      </tr>
    `);

    const fOrdem = Object.keys(TR.filiais).sort((a, b) => a.localeCompare(b));
    let fUid = 0;
    for (const filial of fOrdem) {
      const F = TR.filiais[filial];
      const fId = `f_${trId}_${fUid++}`;

      rowsHtml.push(`
        <tr class="lvl-1 row-hidden" data-parent="${trId}" data-id="${fId}">
          <td><span class="toggle-btn" onclick="toggleRows('${fId}')">▶</span>${escHtml(filial)}</td>
          <td>—</td><td>—</td>
          <td class="text-right">${fmtMoedaUsd(F._usd)}</td><td class="text-right">${fmtMoedaBrl(F._brl)}</td>
          <td class="text-right">—</td><td class="text-right">—</td>
        </tr>
      `);

      const gOrdem = Object.keys(F.grupos).sort((a, b) => a.localeCompare(b));
      let gUid = 0;
      for (const grupo of gOrdem) {
        const G = F.grupos[grupo];
        const gId = `g_${fId}_${gUid++}`;
        
        rowsHtml.push(`
          <tr class="lvl-2 row-hidden" data-parent="${fId}" data-id="${gId}">
            <td style="padding-left: 52px;"><span class="toggle-btn" onclick="toggleRows('${gId}')">▶</span>${escHtml(grupo)}</td>
            <td>—</td><td>—</td>
            <td class="text-right">${fmtMoedaUsd(G._usd)}</td><td class="text-right">${fmtMoedaBrl(G._brl)}</td>
            <td class="text-right">—</td><td class="text-right">—</td>
          </tr>
        `);

        const sgOrdem = Object.keys(G.subgrupos).sort((a, b) => a.localeCompare(b));
        let sgUid = 0;
        for (const subgrp of sgOrdem) {
          const SG = G.subgrupos[subgrp];
          const sgId = `sg_${gId}_${sgUid++}`;

          rowsHtml.push(`
            <tr class="lvl-3 row-hidden" data-parent="${gId}" data-id="${sgId}">
              <td style="padding-left: 76px;"><span class="toggle-btn" onclick="toggleRows('${sgId}')">▶</span>${escHtml(subgrp)}</td>
              <td>—</td><td>—</td>
              <td class="text-right">${fmtMoedaUsd(SG._usd)}</td><td class="text-right">${fmtMoedaBrl(SG._brl)}</td>
              <td class="text-right">—</td><td class="text-right">—</td>
            </tr>
          `);

          const tgsOrdem = Object.keys(SG.tpGers).sort((a, b) => a.localeCompare(b));
          let tgUid = 0;
          for (const tpGer of tgsOrdem) {
            const TG = SG.tpGers[tpGer];
            const tgId = `tg_${sgId}_${tgUid++}`;

            rowsHtml.push(`
              <tr class="lvl-3 row-hidden" data-parent="${sgId}" data-id="${tgId}">
                <td style="padding-left: 100px; font-style: italic;"><span class="toggle-btn" onclick="toggleRows('${tgId}')">▶</span>${escHtml(tpGer)}</td>
                <td>—</td><td>—</td>
                <td class="text-right">${fmtMoedaUsd(TG._usd)}</td><td class="text-right">${fmtMoedaBrl(TG._brl)}</td>
                <td class="text-right">—</td><td class="text-right">—</td>
              </tr>
            `);
            
            for (const detail of TG.rows) {
              const d = detail.DATA_PAGAMENTO ? new Date(detail.DATA_PAGAMENTO).toLocaleDateString('pt-BR') : '—';
              const titulo = `${detail.PREFIXO || ''} ${detail.NUMERO || ''} ${detail.PARCELA || ''}`.trim();
              rowsHtml.push(`
                <tr class="lvl-3 row-hidden" data-parent="${tgId}">
                  <td style="padding-left: 124px; color: #475569;">${escHtml(titulo || 'Sem Título')} - ${escHtml(detail.NATUREZA)} - ${escHtml(detail.HISTORICO_BAIXA)}</td>
                  <td>${d}</td>
                  <td>${escHtml(detail.BENEF || detail.CLI_FOR)}</td>
                  <td class="text-right">${fmtMoedaUsd(detail.VLR_USD)}</td>
                  <td class="text-right">${fmtMoedaBrl(detail.VLR_BRL)}</td>
                  <td class="text-right">${escHtml(detail.NEGOCIO)}</td>
                  <td class="text-right"><span class="badge" style="background:#eee;color:#333;font-size:10px;">${detail.FILIAL}</span></td>
                </tr>
              `);
            }
          }
        }
      }
    }
  }

  body.innerHTML = rowsHtml.join('');

  const tfoot = document.querySelector('#cube-table tfoot');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <th colspan="3">Total Geral</th>
        <th class="text-right">${fmtMoedaUsd(grandUsd)}</th>
        <th class="text-right">${fmtMoedaBrl(grandBrl)}</th>
        <th colspan="2"></th>
      </tr>
    `;
  }
}

function renderAnual(data) {
  const thead = document.getElementById('anual-thead');
  const tbody = document.getElementById('anual-tbody');
  if (!thead || !tbody) return;

  const sections = {
    'DIRETO': { title: 'Custeio Operacional Direto', rows: {} },
    'INDIRETO': { title: 'Custeio Operacional Indireto', rows: {} },
    'RATEADO': { title: 'Despesas Administrativas rateadas', rows: {} }
  };

  const mesesSet = new Set();
  
  for (const r of data) {
    if (!r.ANO_MES) continue;
    mesesSet.add(r.ANO_MES);
    
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
    const val = state.moeda === 'USD' ? Number(r.VLR_USD || 0) : Number(r.VLR_BRL || 0);
    
    let col = null;
    if (r.FILIAL === '028501' && r.NEGOCIO === 'PECUARIA') col = 'pecAba';
    if (r.FILIAL === '028503' && r.NEGOCIO === 'PECUARIA') col = 'pecAgp';
    if (r.FILIAL === '028503' && r.NEGOCIO === 'AGRICULTURA') col = 'sojaAgp';
    
    if (col) {
      mData[col] += val;
    }
    mData.consolidado += val;
  }

  const mesesArr = Array.from(mesesSet).sort();
  const formatMes = (anoMes) => {
    if (!anoMes || anoMes.length !== 6) return anoMes;
    const y = anoMes.substring(0,4);
    const m = parseInt(anoMes.substring(4,6), 10);
    const nomesMes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    return `${nomesMes[m-1]}/${y.substring(2)}`;
  };

  // Build thead
  let theadHtml = `<tr><th rowspan="2" style="min-width: 200px;">Grupo de Custo</th>`;
  for (const m of mesesArr) {
    theadHtml += `<th colspan="4">${formatMes(m)}</th>`;
  }
  theadHtml += `<th colspan="4">Total Ano</th></tr><tr>`;
  
  for (const m of [...mesesArr, 'TOTAL']) {
    theadHtml += `
      <th style="font-size: 11px; font-weight: normal;">Pecuaria Aba</th>
      <th style="font-size: 11px; font-weight: normal;">Pecuaria AGP</th>
      <th style="font-size: 11px; font-weight: normal;">Soja AGP</th>
      <th style="font-size: 11px; font-weight: bold;">Consolidado</th>
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
    
    // Section Header row
    tbodyHtml += `<tr class="grand-total-row" style="background-color: #fde047; color: #1e293b; font-weight: bold;">`;
    tbodyHtml += `<td>${sec.title}</td>`;
    
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
        <td style="color: #1e293b;">${fmt(t.pecAba)}</td>
        <td style="color: #1e293b;">${fmt(t.pecAgp)}</td>
        <td style="color: #1e293b;">${fmt(t.sojaAgp)}</td>
        <td style="color: #1e293b; font-weight: bold;">${fmt(t.consolidado)}</td>
      `;
    }
    tbodyHtml += `</tr>`;
    
    // Group rows
    for (const g of grupos) {
      tbodyHtml += `<tr>`;
      tbodyHtml += `<td style="padding-left: 20px;">${escHtml(g)}</td>`;
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
          <td style="font-weight: bold;">${fmt(d.consolidado)}</td>
        `;
      }
      
      tbodyHtml += `
        <td>${fmt(gTot.pecAba)}</td>
        <td>${fmt(gTot.pecAgp)}</td>
        <td>${fmt(gTot.sojaAgp)}</td>
        <td style="font-weight: bold;">${fmt(gTot.consolidado)}</td>
      </tr>`;
    }
    
    // Spacing between sections
    tbodyHtml += `<tr><td colspan="${(mesesArr.length + 1) * 4 + 1}" style="height: 20px; border: none; background: transparent;"></td></tr>`;
  }

  tbody.innerHTML = tbodyHtml;
}
const fs = require('fs');
const path = require('path');

const dstJs = path.join(__dirname, '../public/app_financeiro.js');

const jsContent = `
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
  return \`\${y}-\${m}-\${day}\`;
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
    
    const [y, m] = mesAno.split('-');
    const key = y + '_' + m;
    
    if (!state.params.financeiro) state.params.financeiro = {};
    if (!state.params.financeiro[filial]) state.params.financeiro[filial] = {};
    
    state.params.financeiro[filial][key] = {
      pecuaria: pctPec,
      agricultura: pctAgr
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
    document.getElementById('params-mes-ano').value = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
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
}

function getRateioParams(filial, ano, mes) {
  const key = ano + '_' + String(mes).padStart(2, '0');
  const fin = state.params.financeiro || {};
  const fObj = fin[filial] || {};
  return fObj[key] || { pecuaria: 50, agricultura: 50 };
}

async function loadAll() {
  const hoje = new Date();
  
  // Buscar mês anterior e atual
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const dataDe = dateToStr(prevDate);
  const dataAte = dateToStr(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));

  try {
    const resDados = await fetch(\`/api/financeiro/dados?data_de=\${dataDe}&data_ate=\${dataAte}\`).then(r => r.json());

    if (resDados.success) {
      // Process Rateio
      const processed = [];
      for (const r of resDados.data || []) {
        const c_custo = r.C_CUSTO || '';
        const vlrBrl = Number(r.VALOR_R$ || 0);
        const ptax = Number(r.PTAX || 1) || 1;
        const vlrUsd = vlrBrl / ptax;
        
        let negocio = 'ND';
        let isRateio = false;
        let pPec = 0;
        let pAgr = 0;
        
        if (c_custo === '01') {
          negocio = 'AGRICULTURA';
        } else if (c_custo === '02') {
          negocio = 'PECUARIA';
        } else {
          isRateio = true;
          const rateio = getRateioParams(r.FILIAL, r.ANO, r.MES);
          pPec = rateio.pecuaria / 100;
          pAgr = rateio.agricultura / 100;
        }

        if (!isRateio) {
          processed.push({ ...r, NEGOCIO: negocio, VLR_BRL: vlrBrl, VLR_USD: vlrUsd });
        } else {
          // Splitting the row conceptually into Pecuária and Agricultura
          if (pPec > 0) {
            processed.push({ ...r, NEGOCIO: 'PECUARIA', VLR_BRL: vlrBrl * pPec, VLR_USD: vlrUsd * pPec });
          }
          if (pAgr > 0) {
            processed.push({ ...r, NEGOCIO: 'AGRICULTURA', VLR_BRL: vlrBrl * pAgr, VLR_USD: vlrUsd * pAgr });
          }
        }
      }
      
      state.allData = processed;
      const filtered = applyFilters(state.allData);
      updateKpis(filtered);
      renderCube(filtered);
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
  const periodoLabel = \`\${nomesMes[periodo.mes-1]}/\${periodo.ano}\`;

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
      html += \`
        <div class="kpi-card">
          <div class="kpi-icon" style="background:\${cfg.cor}1a;color:\${cfg.cor};font-size:1.5rem;">
            \${cfg.icon}
          </div>
          <div class="kpi-data">
            <h3>\${escHtml(tipo)}</h3>
            <h2>\${fmtMoeda(val)}</h2>
            <span class="kpi-sub">\${escHtml(periodoLabel)}</span>
          </div>
        </div>
      \`;
    }
    dynKpis.innerHTML = html;
  }
}

function toggleRows(parentId) {
  const rows = document.querySelectorAll(\`tr[data-parent="\${parentId}"]\`);
  rows.forEach(r => {
    r.classList.toggle('row-hidden');
    // Se estou escondendo, escondo tb os filhos
    if (r.classList.contains('row-hidden')) {
      const id = r.getAttribute('data-id');
      if (id) {
        document.querySelectorAll(\`tr[data-parent="\${id}"]\`).forEach(c => c.classList.add('row-hidden'));
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

  // Hierarquia: TIPO_GERENCIAL -> CC_GRUPO -> CC_SUBGRUPO -> Detalhes
  const tree = {}; 

  let grandBrl = 0, grandUsd = 0;

  for (const r of data) {
    const tpGer = r.TIPO_GERENCIAL || 'Sem Classificação';
    const grupo = r.CC_GRUPO || '(sem grupo)';
    const subgrp = r.CC_SUBGRUPO || '(sem subgrupo)';

    if (!tree[tpGer]) tree[tpGer] = { _brl: 0, _usd: 0, grupos: {} };
    const TG = tree[tpGer];

    if (!TG.grupos[grupo]) TG.grupos[grupo] = { _brl: 0, _usd: 0, subgrupos: {} };
    const G = TG.grupos[grupo];
    
    if (!G.subgrupos[subgrp]) G.subgrupos[subgrp] = { _brl: 0, _usd: 0, rows: [] };
    const SG = G.subgrupos[subgrp];

    const brl  = Number(r.VLR_BRL || 0);
    const usd  = Number(r.VLR_USD || 0);

    TG._brl += brl; TG._usd += usd;
    G._brl  += brl; G._usd  += usd;
    SG._brl += brl; SG._usd += usd;
    SG.rows.push(r);
    grandBrl += brl; grandUsd += usd;
  }

  const rowsHtml = [];
  let uid = 0;

  const tgsOrdem = Object.keys(tree).sort((a, b) => a.localeCompare(b));

  for (const tpGer of tgsOrdem) {
    const TG = tree[tpGer];
    const tgId = \`tg_\${uid++}\`;
    
    rowsHtml.push(\`
      <tr class="lvl-0" data-id="\${tgId}">
        <td>
          <span class="toggle-btn" onclick="toggleRows('\${tgId}')">▶</span>
          <strong>\${escHtml(tpGer)}</strong>
        </td>
        <td>—</td>
        <td>—</td>
        <td class="text-right">\${fmtMoedaUsd(TG._usd)}</td>
        <td class="text-right">\${fmtMoedaBrl(TG._brl)}</td>
        <td>—</td>
        <td>—</td>
      </tr>
    \`);

    const gruposOrdem = Object.keys(TG.grupos).sort((a, b) => a.localeCompare(b));
    
    let gUid = 0;
    for (const grupo of gruposOrdem) {
      const G = TG.grupos[grupo];
      const gId = \`g_\${tgId}_\${gUid++}\`;

      rowsHtml.push(\`
        <tr class="lvl-1 row-hidden" data-parent="\${tgId}" data-id="\${gId}">
          <td><span class="toggle-btn" onclick="toggleRows('\${gId}')">▶</span>\${escHtml(grupo)}</td>
          <td>—</td>
          <td>—</td>
          <td class="text-right">\${fmtMoedaUsd(G._usd)}</td>
          <td class="text-right">\${fmtMoedaBrl(G._brl)}</td>
          <td>—</td>
          <td>—</td>
        </tr>
      \`);

      const sgOrdem = Object.keys(G.subgrupos).sort((a, b) => a.localeCompare(b));
      let sgUid = 0;
      for (const subgrp of sgOrdem) {
        const SG = G.subgrupos[subgrp];
        const sgId = \`sg_\${gId}_\${sgUid++}\`;

        rowsHtml.push(\`
          <tr class="lvl-2 row-hidden" data-parent="\${gId}" data-id="\${sgId}">
            <td><span class="toggle-btn" onclick="toggleRows('\${sgId}')">▶</span>\${escHtml(subgrp)}</td>
            <td>—</td>
            <td>—</td>
            <td class="text-right">\${fmtMoedaUsd(SG._usd)}</td>
            <td class="text-right">\${fmtMoedaBrl(SG._brl)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
        \`);
        
        for (const detail of SG.rows) {
          const d = detail.DATA_PAGAMENTO ? new Date(detail.DATA_PAGAMENTO).toLocaleDateString('pt-BR') : '—';
          const titulo = \`\${detail.PREFIXO || ''} \${detail.NUMERO || ''} \${detail.PARCELA || ''}\`.trim();
          rowsHtml.push(\`
            <tr class="lvl-3 row-hidden" data-parent="\${sgId}">
              <td>\${escHtml(titulo || 'Sem Título')} - \${escHtml(detail.NATUREZA)} - \${escHtml(detail.HISTORICO_BAIXA)}</td>
              <td>\${d}</td>
              <td>\${escHtml(detail.BENEF || detail.CLI_FOR)}</td>
              <td class="text-right">\${fmtMoedaUsd(detail.VLR_USD)}</td>
              <td class="text-right">\${fmtMoedaBrl(detail.VLR_BRL)}</td>
              <td class="text-right">\${escHtml(detail.NEGOCIO)}</td>
              <td class="text-right"><span class="badge" style="background:#eee;color:#333;font-size:10px;">\${detail.FILIAL}</span></td>
            </tr>
          \`);
        }
      }
    }
  }

  body.innerHTML = rowsHtml.join('');

  const tfoot = document.querySelector('#cube-table tfoot');
  if (tfoot) {
    tfoot.innerHTML = \`
      <tr>
        <th colspan="3">Total Geral</th>
        <th class="text-right">\${fmtMoedaUsd(grandUsd)}</th>
        <th class="text-right">\${fmtMoedaBrl(grandBrl)}</th>
        <th colspan="2"></th>
      </tr>
    \`;
  }
}
`;

fs.writeFileSync(dstJs, jsContent, 'utf8');
console.log('Script gerado');

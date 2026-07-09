const fs = require('fs');
const path = require('path');

const srcHtml = path.join(__dirname, '../public/fechamento_insumos.html');
const dstHtml = path.join(__dirname, '../public/fechamento_financeiro.html');
const srcJs = path.join(__dirname, '../public/app_insumos.js');
const dstJs = path.join(__dirname, '../public/app_financeiro.js');

let htmlContent = fs.readFileSync(srcHtml, 'utf8');

// Replacements for HTML
htmlContent = htmlContent.replace(/Custos com Insumos/g, 'Custos Financeiros e Administrativos');
htmlContent = htmlContent.replace(/Defensivos · Fertilizantes · Sementes/g, 'Despesas Administrativas Rateadas e Custos Operacionais Indiretos');
htmlContent = htmlContent.replace(/app_insumos\.js/g, 'app_financeiro.js');
htmlContent = htmlContent.replace(/FECHAMENTO_INSUMOS/g, 'FECHAMENTO_FINANCEIRO');

// Replace the params panel at the bottom (which was originally for Safra params in Insumos)
const paramsPanelHtml = `
      <!-- Painel de Parâmetros Manuais (Rateio) -->
      <section class="params-panel" id="params-panel-rateio" style="margin-top:20px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding: 0;">
        <div class="params-panel-header" id="params-toggle" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; transition:background .2s;">
          <h3><i class="fa-solid fa-sliders" style="color:#8b5cf6;"></i> Parâmetros de Rateio (%) <span style="font-size:11px;color:var(--text-muted);font-weight:400;">— salvos no servidor, afetam C_CUSTO diferente de 01 e 02</span></h3>
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="params-save-status" style="font-size:11px;color:var(--text-muted);"></span>
            <button class="btn btn-secondary" id="btn-save-params" style="font-size:12px;padding:7px 14px;" onclick="event.stopPropagation()">
              <i class="fa-solid fa-floppy-disk"></i> Salvar
            </button>
            <i class="fa-solid fa-chevron-down toggle-icon" id="params-chevron" style="transform: rotate(-90deg);"></i>
          </div>
        </div>
        <div class="params-panel-body" id="params-body" style="display:none; padding:20px; border-top:1px solid var(--border-color);">
          <div class="params-row" style="display:flex; gap:20px; margin-bottom:20px;">
            <div class="params-group" style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:11px; color:var(--text-muted);">Filial</label>
              <select id="params-filial" class="form-control" style="width: 200px;">
                <option value="028501">028501 — Futurazy Agrícola</option>
                <option value="028503">028503 — Futurazy Pecuária</option>
              </select>
            </div>
            <div class="params-group" style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:11px; color:var(--text-muted);">Mês / Ano</label>
              <input type="month" id="params-mes-ano" class="form-control" style="width: 150px;">
            </div>
          </div>
          <div class="params-row" style="display:flex; gap:20px;">
            <div class="params-group" style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:11px; color:var(--text-muted);">% Pecuária</label>
              <input type="number" id="p-rateio-pecuaria" placeholder="Ex: 40" step="1" min="0" max="100" class="form-control" style="width: 120px;">
            </div>
            <div class="params-group" style="display:flex; flex-direction:column; gap:6px;">
              <label style="font-size:11px; color:var(--text-muted);">% Agricultura</label>
              <input type="number" id="p-rateio-agricultura" placeholder="Ex: 60" step="1" min="0" max="100" class="form-control" style="width: 120px;">
            </div>
          </div>
        </div>
      </section>
`;

// Insert the new params panel after the cube-section or kpi section
// Wait, in fechamento_insumos.html, the params panel was a single line at the top. Let's just append it before the cube section.
htmlContent = htmlContent.replace('<section class="cube-section"', paramsPanelHtml + '\n      <section class="cube-section"');

// Replace the Tipo de Insumo filter with a display:none or just remove it
htmlContent = htmlContent.replace(/<div class="filter-group">\s*<label for="f-tipo-insumo">[\s\S]*?<\/select>\s*<\/div>/g, '');

fs.writeFileSync(dstHtml, htmlContent, 'utf8');
console.log('Criado fechamento_financeiro.html');

const jsSkeleton = `
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
  params:         {} // Params for rateio
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

function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return \`\${y}-\${m}-\${day}\`;
}

function getSafraYear(hoje = new Date()) {
  return hoje.getMonth() + 1 >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadParams();
  loadAll();
});

function setupEventListeners() {
  document.getElementById('btn-refresh')?.addEventListener('click', loadAll);
  
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
    // Set default month
    const d = new Date();
    document.getElementById('params-mes-ano').value = \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\`;
    updateParamsUI();
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
  // Mock function for now, to be implemented
  console.log("loadAll called");
  // Fetch from /api/financeiro/dados
}
`;

fs.writeFileSync(dstJs, jsSkeleton, 'utf8');
console.log('Criado app_financeiro.js (esqueleto)');


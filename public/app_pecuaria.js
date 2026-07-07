/**
 * app_pecuaria.js — Módulo de Fechamento de Custos Pecuária
 * Gerencia: grid anual A-R, parâmetros manuais, drill-downs, fechamento de mês
 */

'use strict';

// ─── Estado Global ────────────────────────────────────────────
const state = {
  tipoCalendario: 'safra',       // 'safra' | 'calendario'
  empresaFiltro: 'TOTAL',        // 'TOTAL' | '028501' | '028503'
  moeda: 'BRL',                  // 'BRL' | 'USD'
  kpiPeriodo: 'anterior',        // 'anterior' | 'atual'
  resumoAnual: null,             // dados do /api/pecuaria/resumo-anual
  params: null,                  // dados do /api/pecuaria/params
  fecharPending: null,           // { mes, ano, empresa }
  excluirPendingId: null,        // ID do FP_ID a excluir
};

const MESES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Formatadores ─────────────────────────────────────────────
function fmtNum(v, decimais = 0) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
}
function fmtR$(v)     { return 'R$ ' + fmtNum(v, 0); }
function fmtR$M(v)    { const m = v / 1e6; return m >= 0.1 ? `R$ ${fmtNum(m, 2)}M` : `R$ ${fmtNum(v, 0)}`; }
function fmtCab(v)    { return fmtNum(v, 0) + ' cab'; }
function fmtDate(d) {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return '—';
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
}
function fmtDateStr(d) { // 'YYYY-MM-DD' from Date
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function getSafraYear(hoje = new Date()) {
  return hoje.getMonth() + 1 >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}

// ─── Toast ───────────────────────────────────────────────────
function showToast(msg, tipo = 'info', duracao = 3500) {
  const t = document.getElementById('toast-pec');
  const colors = { success:'#10b981', error:'#f87171', info:'var(--pec-amber)', warning:'#fbbf24' };
  const icons  = { success:'fa-check-circle', error:'fa-circle-xmark', info:'fa-circle-info', warning:'fa-triangle-exclamation' };
  t.innerHTML = `<i class="fa-solid ${icons[tipo]}" style="color:${colors[tipo]};margin-right:8px;"></i>${msg}`;
  t.style.borderLeftColor = colors[tipo];
  t.style.display = 'flex';
  t.style.alignItems = 'center';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.style.display='none',300); }, duracao);
}

// ─── Modals ──────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── Parâmetros manuais — Load / Save ─────────────────────────
async function loadParams() {
  try {
    const r = await fetch('/api/pecuaria/params');
    const j = await r.json();
    if (j.success) state.params = j.data;
  } catch(e) { console.warn('Erro ao carregar params pecuária:', e); }
  populateParamsForm();
}

function getParamsKey() {
  const filial  = document.getElementById('params-filial').value;
  const mesAno  = document.getElementById('params-mes-ano').value; // 'YYYY-MM'
  if (!mesAno) return { filial, ano: null, mes: null, key: null };
  const [ano, mes] = mesAno.split('-');
  return { filial, ano: parseInt(ano), mes: parseInt(mes), key: `${ano}_${String(mes).padStart(2, '0')}` };
}

function populateParamsForm() {
  if (!state.params) return;
  const { filial, ano, mes, key } = getParamsKey();
  const fp = state.params[filial] || {};
  document.getElementById('p-estoque-ini-qtd').value = fp.estoque_ini_safra_qtd || '';
  document.getElementById('p-estoque-ini-vlr').value = fp.estoque_ini_safra_vlr || '';
  if (key && fp.meses && fp.meses[key]) {
    const m = fp.meses[key];
    document.getElementById('p-nascimentos').value     = m.nascimentos   ?? '';
    document.getElementById('p-mortes-perda').value    = m.mortes_perda  ?? '';
    document.getElementById('p-mortes-consumo').value  = m.mortes_consumo?? '';
    document.getElementById('p-estoque-fazenda').value = m.estoque_fazenda?? '';
    document.getElementById('p-ajuste-inv').value      = m.ajuste_inv    ?? '';
    document.getElementById('p-pasto').value           = m.pasto         ?? '';
  } else {
    ['p-nascimentos','p-mortes-perda','p-mortes-consumo','p-estoque-fazenda','p-ajuste-inv','p-pasto']
      .forEach(id => document.getElementById(id).value = '');
  }
}

async function saveParams() {
  const { filial, ano, mes, key } = getParamsKey();
  if (!state.params) state.params = { '028501': { meses:{} }, '028503': { meses:{} } };
  if (!state.params[filial]) state.params[filial] = { meses: {} };

  state.params[filial].estoque_ini_safra_qtd = parseFloat(document.getElementById('p-estoque-ini-qtd').value) || 0;
  state.params[filial].estoque_ini_safra_vlr = parseFloat(document.getElementById('p-estoque-ini-vlr').value) || 0;

  if (key) {
    if (!state.params[filial].meses) state.params[filial].meses = {};
    state.params[filial].meses[key] = {
      nascimentos:    parseFloat(document.getElementById('p-nascimentos').value)     || 0,
      mortes_perda:   parseFloat(document.getElementById('p-mortes-perda').value)    || 0,
      mortes_consumo: parseFloat(document.getElementById('p-mortes-consumo').value)  || 0,
      estoque_fazenda:parseFloat(document.getElementById('p-estoque-fazenda').value) || 0,
      ajuste_inv:     parseFloat(document.getElementById('p-ajuste-inv').value)      || 0,
      pasto:          parseFloat(document.getElementById('p-pasto').value)           || 0,
    };
  }

  try {
    const r = await fetch('/api/pecuaria/params', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.params)
    });
    const j = await r.json();
    if (j.success) {
      document.getElementById('params-save-status').textContent = '✓ Salvo ' + new Date().toLocaleTimeString('pt-BR');
      showToast('Parâmetros salvos com sucesso!', 'success');
      await loadResumoAnual(); // atualizar o grid com os novos valores
    } else {
      showToast('Erro ao salvar: ' + j.error, 'error');
    }
  } catch(e) { showToast('Erro de comunicação.', 'error'); }
}

// ─── Resumo Anual ─────────────────────────────────────────────
async function loadResumoAnual() {
  document.getElementById('anual-loading').style.display = 'flex';
  try {
    const hoje = new Date();
    const safra = getSafraYear(hoje);
    let url = `/api/pecuaria/resumo-anual?tipo=${state.tipoCalendario}&ano_safra=${safra}&ano=${hoje.getFullYear()}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.success) {
      state.resumoAnual = j;
      renderAnualGrid();
      updateKPIs();
      document.getElementById('txt-safra').textContent = state.tipoCalendario === 'safra' ? `${safra-1}/${String(safra).slice(-2)}` : hoje.getFullYear();
      document.getElementById('anual-safra-lbl').textContent = document.getElementById('txt-safra').textContent;
    } else {
      showToast('Erro ao carregar resumo anual: ' + j.error, 'error');
    }
  } catch(e) { showToast('Erro de comunicação com servidor.', 'error'); }
  finally { document.getElementById('anual-loading').style.display = 'none'; }
}

// ─── Renderização do Grid Anual ───────────────────────────────
function renderAnualGrid() {
  const { meses } = state.resumoAnual;
  const empresa = state.empresaFiltro;
  const hoje = new Date();
  const mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

  // ── Cabeçalho ──
  let thHtml = `<tr><th class="col-label">Descrição</th>`;
  meses.forEach(m => {
    let cls = '';
    if (m.ano === mesAtual.ano && m.mes === mesAtual.mes)         cls = 'th-mes-atual';
    else if (m.ano === mesAnterior.ano && m.mes === mesAnterior.mes) cls = 'th-mes-anterior';
    else if (m.status === 'fechado')                               cls = 'th-fechado';
    const lbl = `${MESES_NOMES[m.mes-1]}/${String(m.ano).slice(-2)}`;
    thHtml += `<th class="${cls}">${lbl}</th>`;
  });
  thHtml += '</tr>';
  document.getElementById('anual-thead').innerHTML = thHtml;

  // ── Função auxiliar para montar célula ──
  function td(val, clsMes) { return `<td class="${clsMes}">${val}</td>`; }
  function tdNum(v, fn, clsMes) { return `<td class="${clsMes}" style="text-align:right;">${v !== undefined && v !== null ? fn(v) : '—'}</td>`; }

  function getMesClass(m) {
    if (m.ano === mesAtual.ano && m.mes === mesAtual.mes)    return 'col-mes-atual';
    if (m.ano === mesAnterior.ano && m.mes === mesAnterior.mes) return 'col-mes-anterior';
    if (m.status === 'fechado') return 'col-fechado';
    return '';
  }
  function getD(m) { return m.porEmpresa?.[empresa] || {}; }

  // Status row helper
  function statusPill(st) {
    const map = {
      fechado: ['pill-fechado','✓ FECHADO'],
      dinamico_anterior: ['pill-din-ant','● MÊS ANT.'],
      dinamico_atual: ['pill-din-atu','● MÊS ATUAL'],
      aguardando: ['pill-aguardando','AGUARDANDO'],
      futuro: ['pill-futuro','—'],
    };
    const [cls, lbl] = map[st] || ['pill-aguardando','?'];
    return `<span class="pill-status ${cls}">${lbl}</span>`;
  }

  // Definição das linhas
  const rows = [
    // Status + ações
    { id: 'row-status', cls: '', label: '', render: (m) => {
      const mc = getMesClass(m);
      const d = getD(m);
      const isDin = d.status === 'dinamico_anterior' || d.status === 'dinamico_atual';
      const isFechado = d.status === 'fechado';
      const canClose = isDin;
      let inner = statusPill(d.status || m.status);
      if (canClose) inner += `<br><button class="btn-fechar-mes" onclick="openFecharMes(${m.mes},${m.ano})">Fechar Mês</button>`;
      if (isFechado) inner += `<br><button class="btn-fechar-mes" style="color:#f87171;border-color:rgba(248,113,113,.3);" onclick="openExcluirFechamento(${m.mes},${m.ano})">Excluir</button>`;
      return `<td class="${mc}" style="text-align:center;vertical-align:middle;">${inner}</td>`;
    }},

    // ── SEÇÃO QUANTIDADE ──
    { id: 'row-sec-qtd', cls: 'row-section-header', label: '── QUANTIDADE (cab) ──', render: (m) => `<td class="${getMesClass(m)}"></td>` },
    { label: 'A — Estoque Inicial', cls: '', key: 'A_qtd', fn: v => fmtNum(v,0) },
    { label: 'B — (+) Compras (SQL1)', cls: '', key: 'B_qtd', fn: v => fmtNum(v,0) },
    { label: 'C — (+) Transf. Entrada (SQL2)', cls: '', key: 'C_qtd', fn: v => fmtNum(v,0) },
    { label: 'D — (−) Transf. Saída (SQL3)', cls: '', key: 'D_qtd', fn: v => `(${fmtNum(v,0)})` },
    { label: 'E — (+) Nascimentos', cls: '', key: 'E', fn: v => fmtNum(v,0) },
    { label: 'F — (−) Mortes Perda', cls: 'row-cam', key: 'F_perda', fn: v => `(${fmtNum(v,0)})` },
    { label: 'F — (−) Mortes Consumo', cls: 'row-cam', key: 'F_consumo', fn: v => `(${fmtNum(v,0)})` },
    { label: 'G — (−) Vendas / Abates (SQL4)', cls: '', key: 'G_qtd', fn: v => `(${fmtNum(v,0)})` },
    { label: 'H — (+/−) Ajuste Inventário', cls: '', key: 'H', fn: v => fmtNum(v,0) },
    { label: 'I — (=) Estoque Final Contábil', cls: 'row-calculated', key: 'I', fn: v => fmtNum(v,0) },

    // ── ESTOQUE FAZENDA ──
    { id: 'row-sec-esfaz', cls: 'row-section-header', label: '── ESTOQUE FAZENDA ──', render: (m) => `<td class="${getMesClass(m)}"></td>` },
    { label: 'Estoque Fazenda SBC (cab)', cls: '', key: 'estoque_fazenda', fn: v => fmtNum(v,0) },
    { label: 'Dif. Estoque (Contábil − SBC)', cls: '', key: 'dif_estoque', fn: v => {
      const cls = v < 0 ? 'color:#f87171;' : v > 0 ? 'color:#10b981;' : '';
      return `<span style="${cls}">${v >= 0 ? '+' : ''}${fmtNum(v,0)}</span>`;
    }},

    // ── SEÇÃO VALOR ──
    { id: 'row-sec-vlr', cls: 'row-section-header', label: '── VALOR (R$) ──', render: (m) => `<td class="${getMesClass(m)}"></td>` },
    { label: 'J — Estoque Inicial (R$)', cls: '', key: 'J_vlr', fn: v => fmtR$(v) },
    { label: 'K — (+) Compras (R$)', cls: '', key: 'K_vlr', fn: v => fmtR$(v) },
    { label: 'L — (+) Transf. Entrada (R$)', cls: '', key: 'L_vlr', fn: v => fmtR$(v) },
    { label: 'M — (=) Cabeças Disponíveis', cls: 'row-calculated', key: 'M_val', fn: v => fmtR$(v) },
    { label: 'N — (+) Nutrição Animal (SQL5 × CAV/U ant.)', cls: '', key: 'N', fn: v => fmtR$(v) },
    { label: 'O — (+) Pasto / Capim (R$)', cls: '', key: 'O', fn: v => fmtR$(v) },
    { label: 'P — (=) Valor Disponível', cls: 'row-calculated', key: 'P', fn: v => fmtR$(v) },
    { label: 'Q — (=) CAV/U (R$/cab)', cls: 'row-kpi', key: 'Q_cavu', fn: v => `R$ ${fmtNum(v,2)}` },
    { label: 'R — (=) CAV = Q × (D+G)', cls: 'row-kpi', key: 'R_cav', fn: v => fmtR$(v) },
    { id: 'row-sec-cam', cls: 'row-section-header', label: '── CAM ──', render: (m) => `<td class="${getMesClass(m)}"></td>` },
    { label: 'CAM (Perdas) = Mortes Perda × CAV/U', cls: 'row-cam', key: 'cam_perdas', fn: v => fmtR$(v) },
    { label: 'CAM (Consumo Interno) = Mortes Cons. × CAV/U', cls: 'row-cam', key: 'cam_consumo', fn: v => fmtR$(v) },
    { label: '(+) Estoque Final (R$) = P − CAV − CAM', cls: 'row-estoque-final', key: 'vl_estoque_fin', fn: v => fmtR$(v) },
  ];

  // ── Renderizar linhas ──
  let tbody = '';
  rows.forEach(row => {
    // Linha de seção especial (sem key)
    if (row.render) {
      let rowHtml = `<tr class="${row.cls || ''}"><td class="col-label">${row.label}</td>`;
      meses.forEach(m => { rowHtml += row.render(m); });
      rowHtml += '</tr>';
      tbody += rowHtml;
      return;
    }
    // Linha de dados
    let rowHtml = `<tr class="${row.cls || ''}"><td class="col-label">${row.label}</td>`;
    meses.forEach(m => {
      const mc = getMesClass(m);
      const d = getD(m);
      const isFuturo = d.status === 'futuro';
      const v = d[row.key];
      if (isFuturo || v === undefined) {
        rowHtml += `<td class="${mc}" style="text-align:right;color:#1e293b;">—</td>`;
      } else {
        const rendered = row.fn ? row.fn(v) : fmtNum(v, 2);
        rowHtml += `<td class="${mc}" style="text-align:right;">${rendered}</td>`;
      }
    });
    rowHtml += '</tr>';
    tbody += rowHtml;
  });

  document.getElementById('anual-tbody').innerHTML = tbody;
}

// ─── KPIs ─────────────────────────────────────────────────────
function updateKPIs() {
  if (!state.resumoAnual) return;
  const { meses } = state.resumoAnual;
  const hoje = new Date();
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const target = state.kpiPeriodo === 'anterior'
    ? { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 }
    : { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };

  const m = meses.find(x => x.ano === target.ano && x.mes === target.mes);
  if (!m) return;
  const d = m.porEmpresa?.[state.empresaFiltro] || {};

  const mesLabel = `${MESES_NOMES[target.mes-1]}/${target.ano}`;
  document.getElementById('kpi-cavu').textContent     = d.Q_cavu ? `R$ ${fmtNum(d.Q_cavu, 2)}` : '—';
  document.getElementById('kpi-cavu-sub').textContent = `Custo médio/cabeça — ${mesLabel}`;
  document.getElementById('kpi-cav').textContent      = d.R_cav  ? fmtR$M(d.R_cav) : '—';
  document.getElementById('kpi-cav-sub').textContent  = `CAV: abates + transf. saída — ${mesLabel}`;
  document.getElementById('kpi-ef-qtd').textContent   = d.I !== undefined ? fmtCab(d.I) : '—';
  document.getElementById('kpi-ef-sub').textContent   = d.estoque_fazenda ? `Fazenda SBC: ${fmtNum(d.estoque_fazenda,0)} cab` : 'Fazenda SBC: —';
  document.getElementById('kpi-vd').textContent       = d.P ? fmtR$M(d.P) : '—';
  const dif = d.dif_estoque || 0;
  document.getElementById('kpi-dif').textContent      = d.I !== undefined ? (dif >= 0 ? '+' : '') + fmtNum(dif, 0) : '—';
  document.getElementById('kpi-dif').style.color      = dif < 0 ? '#f87171' : dif > 0 ? '#10b981' : 'var(--pec-amber)';
}

// ─── Fechar Mês ───────────────────────────────────────────────
function openFecharMes(mes, ano) {
  state.fecharPending = { mes, ano, empresa: state.empresaFiltro === 'TOTAL' ? 'TODAS' : state.empresaFiltro };
  const { meses } = state.resumoAnual;
  const m = meses.find(x => x.mes === mes && x.ano === ano);
  const empresa = state.fecharPending.empresa;
  const d = m?.porEmpresa?.[state.empresaFiltro] || {};

  document.getElementById('modal-fechar-detalhe').innerHTML = `
    <div class="modal-detail-row"><span class="label">Mês/Ano</span><span class="value">${MESES_NOMES[mes-1]}/${ano}</span></div>
    <div class="modal-detail-row"><span class="label">Empresa</span><span class="value">${empresa}</span></div>
    <div class="modal-detail-row"><span class="label">Estoque Inicial (cab)</span><span class="value">${fmtNum(d.A_qtd,0)}</span></div>
    <div class="modal-detail-row"><span class="label">Compras + Transf. Entrada (cab)</span><span class="value">${fmtNum((d.B_qtd||0)+(d.C_qtd||0),0)}</span></div>
    <div class="modal-detail-row"><span class="label">Vendas + Transf. Saída (cab)</span><span class="value">${fmtNum((d.G_qtd||0)+(d.D_qtd||0),0)}</span></div>
    <div class="modal-detail-row"><span class="label">Estoque Final Contábil (cab)</span><span class="value" style="color:#10b981;">${fmtNum(d.I,0)}</span></div>
    <div class="modal-detail-row"><span class="label">CAV/U calculado</span><span class="value" style="color:var(--pec-amber);">R$ ${fmtNum(d.Q_cavu||0,2)}</span></div>
    <div class="modal-detail-row"><span class="label">CAV calculado (R$)</span><span class="value" style="color:var(--pec-amber);">${fmtR$(d.R_cav||0)}</span></div>
    <div class="modal-detail-row"><span class="label">Valor Disponível P (R$)</span><span class="value">${fmtR$(d.P||0)}</span></div>
  `;
  openModal('modal-fechar');
}

async function confirmarFechamento() {
  const { mes, ano, empresa } = state.fecharPending;
  const btn = document.getElementById('btn-confirmar-fechamento');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Fechando…';
  try {
    const r = await fetch('/api/pecuaria/fechar-mes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa, mes, ano })
    });
    const j = await r.json();
    if (j.success) {
      showToast(j.mensagem, 'success');
      closeModal('modal-fechar');
      await loadResumoAnual();
    } else {
      showToast('Erro: ' + j.error, 'error', 6000);
    }
  } catch(e) { showToast('Erro de comunicação.', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Fechamento'; }
}

// ─── Excluir Fechamento ───────────────────────────────────────
function openExcluirFechamento(mes, ano) {
  // Encontrar o FP_ID exato (precisamos listar da API para isso)
  state.excluirPendingMes  = mes;
  state.excluirPendingAno  = ano;
  state.excluirPendingFilial = state.empresaFiltro === 'TOTAL' ? '028501' : state.empresaFiltro;
  document.getElementById('modal-excluir-detalhe').innerHTML = `
    <div class="modal-detail-row"><span class="label">Mês/Ano</span><span class="value">${MESES_NOMES[mes-1]}/${ano}</span></div>
    <div class="modal-detail-row"><span class="label">Empresa</span><span class="value">${state.excluirPendingFilial}</span></div>
  `;
  openModal('modal-excluir');
}

async function confirmarExclusao() {
  const { excluirPendingMes: mes, excluirPendingAno: ano, excluirPendingFilial: filial } = state;
  const btn = document.getElementById('btn-confirmar-exclusao');
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner spin"></i> Excluindo…';
  try {
    // Buscar ID primeiro
    const r1 = await fetch(`/api/pecuaria/fechamentos?ano=${ano}&mes=${mes}&filial=${filial}`);
    const j1 = await r1.json();
    const ids = j1.data?.map(x => x.FP_ID);
    if (!ids || ids.length === 0) { showToast('Fechamento não encontrado.', 'error'); return; }
    for (const id of ids) {
      await fetch(`/api/pecuaria/fechamento/${id}`, { method: 'DELETE' });
    }
    showToast('Fechamento excluído com sucesso.', 'success');
    closeModal('modal-excluir');
    await loadResumoAnual();
  } catch(e) { showToast('Erro ao excluir.', 'error'); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir'; }
}

// ─── Toggle Drill-Down ────────────────────────────────────────
function toggleDrill(id) {
  const body = document.getElementById(id + '-body');
  const header = document.querySelector(`#${id} .drill-header`);
  body.classList.toggle('open');
  header.classList.toggle('collapsed');
}

// ─── Drill-Down Data ──────────────────────────────────────────
const DRILL_COLS = {
  1: [['EMPRESA','Empresa'],['NF','NF'],['NOME','Cliente/Forn.'],['CFOP','CFOP'],['PRODUTO','Produto'],['QUANT','Qtd',true],['TOTAL','Total (R$)',true]],
  2: [['EMPRESA','Empresa'],['NF','NF'],['NOME','Fornecedor'],['CFOP','CFOP'],['PRODUTO','Produto'],['QUANT','Qtd',true],['TOTAL','Total (R$)',true]],
  3: [['EMPRESA','Empresa'],['NF','NF'],['NOME','Destino'],['CFOP','CFOP'],['PRODUTO','Produto'],['QUANT','Qtd',true],['TOTAL','Total (R$)',true]],
  4: [['EMPRESA','Empresa'],['NF','NF'],['NOME','Cliente'],['CFOP','CFOP'],['PRODUTO','Produto'],['QUANT','Qtd',true],['TOTAL','Total (R$)',true]],
  5: [['EMPRESA','Filial'],['NJH_DATA','Data'],['NOMENT','Entidade'],['PLACA','Placa'],['HORA_INI','H.Ini'],['HORA_FIM','H.Fim'],['PESO_SUBTOTAL','Peso Sub.',true]],
};

function defaultDates() {
  const hoje = new Date();
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const currLast = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { de: fmtDateStr(prevDate), ate: fmtDateStr(currLast) };
}

async function loadDrill(n) {
  const de  = document.getElementById(`d${n}-de`).value  || defaultDates().de;
  const ate = document.getElementById(`d${n}-ate`).value || defaultDates().ate;
  const filial = state.empresaFiltro || 'TOTAL';
  const endpoint = `/api/pecuaria/sql${n}?data_de=${de}&data_ate=${ate}&filial=${filial}`;

  try {
    const r = await fetch(endpoint);
    const j = await r.json();
    if (!j.success) { showToast('Erro SQL'+n+': ' + j.error, 'error', 7000); return; }
    const rows = j.data || [];
    document.getElementById(`d${n}-count`).textContent = `${rows.length} registros`;
    renderDrillTable(n, rows);
  } catch(e) { showToast('Erro ao consultar SQL'+n, 'error'); }
}

function renderDrillTable(n, rows) {
  const cols = DRILL_COLS[n];
  const empty  = document.getElementById(`d${n}-empty`);
  const table  = document.getElementById(`d${n}-table`);
  const thead  = document.getElementById(`d${n}-thead`);
  const tbody  = document.getElementById(`d${n}-tbody`);
  const tfoot  = document.getElementById(`d${n}-tfoot`);

  if (rows.length === 0) {
    empty.style.display = 'block'; table.style.display = 'none';
    empty.textContent = 'Nenhum registro encontrado para o período.';
    // hide footer bar if present
    const footerBar = document.getElementById(`d${n}-footer`);
    if (footerBar) footerBar.style.display = 'none';
    return;
  }
  empty.style.display = 'none'; table.style.display = 'table';

  // Show footer bar with count if it exists (SQL1)
  const footerBar = document.getElementById(`d${n}-footer`);
  const totalCount = document.getElementById(`d${n}-total-count`);
  if (footerBar) { footerBar.style.display = 'flex'; }
  if (totalCount) { totalCount.textContent = rows.length.toLocaleString('pt-BR'); }

  // Header
  thead.innerHTML = '<tr>' + cols.map(([k,lbl,isNum]) => `<th${isNum?' class="text-right"':''}>${lbl}</th>`).join('') + '</tr>';

  // Totais
  const totais = {};
  cols.forEach(([k,,isNum]) => { if(isNum) totais[k] = 0; });

  // Rows
  let tbodyHtml = '';
  rows.forEach(row => {
    tbodyHtml += '<tr>';
    cols.forEach(([k,,isNum]) => {
      const v = row[k];
      if (isNum) {
        const n = Number(v || 0);
        totais[k] = (totais[k] || 0) + n;
        tbodyHtml += `<td class="text-right">${fmtNum(n, k === 'PESO_SUBTOTAL' ? 2 : 0)}</td>`;
      } else {
        // Date handling
        let val = v;
        if (v instanceof Date || (typeof v === 'string' && v.includes('T'))) val = fmtDate(v);
        tbodyHtml += `<td>${val ?? '—'}</td>`;
      }
    });
    tbodyHtml += '</tr>';
  });
  tbody.innerHTML = tbodyHtml;

  // Footer totais
  let firstText = true;
  const tfootCells = cols.map(([k,,isNum]) => {
    if (isNum) return `<td class="text-right" style="color:var(--pec-amber);font-weight:700;">${fmtNum(totais[k], k==='PESO_SUBTOTAL'?2:0)}</td>`;
    if (firstText) { firstText = false; return `<td style="color:var(--text-muted);font-weight:600;font-style:italic;">TOTAIS (${rows.length.toLocaleString('pt-BR')} reg.)</td>`; }
    return `<td></td>`;
  });
  tfoot.innerHTML = '<tr class="drill-total-row">' + tfootCells.join('') + '</tr>';
}

// ─── CRUD Ajustes Manuais ─────────────────────────────────────
let fechamentosCRUDList = [];

async function loadFechamentosCRUD() {
  const periodo = document.getElementById('filter-modal-periodo').value; // 'YYYY-MM'
  const filial = document.getElementById('filter-modal-filial').value;

  let url = '/api/pecuaria/fechamentos?';
  if (periodo) {
    const [ano, mes] = periodo.split('-');
    url += `ano=${ano}&mes=${mes}&`;
  }
  if (filial) {
    url += `filial=${filial}&`;
  }

  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j.success) {
      fechamentosCRUDList = j.data || [];
      renderFechamentosCRUDList();
    }
  } catch(e) {
    showToast('Erro ao carregar fechamentos.', 'error');
  }
}

function renderFechamentosCRUDList() {
  const tbody = document.getElementById('edit-fechamento-list-body');
  if (fechamentosCRUDList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">Nenhum fechamento encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = fechamentosCRUDList.map(f => {
    const periodoStr = `${String(f.FP_MES).padStart(2,'0')}/${f.FP_ANO}`;
    return `
      <tr>
        <td>${periodoStr}</td>
        <td>${f.FP_EMPRESA}</td>
        <td class="text-right">${fmtNum(f.FP_ESTOQUE_INI,0)}</td>
        <td class="text-right">${fmtNum(f.FP_ESTOQUE_FIN,0)}</td>
        <td class="text-right">R$ ${fmtNum(f.FP_CAV_U,2)}</td>
        <td class="text-right">R$ ${fmtNum(f.FP_CAV,0)}</td>
        <td>${fmtDate(f.FP_DT_FECHAMENTO)}</td>
        <td>
          <button class="btn-fechar-mes" style="padding: 2px 6px; font-size:11px;" onclick="openEditFechamentoForm(${f.FP_ID})">Editar</button>
          <button class="btn-fechar-mes" style="padding: 2px 6px; font-size:11px; color:#f87171; border-color:rgba(248,113,113,.3);" onclick="deleteFechamento(${f.FP_ID})">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openNewFechamentoForm() {
  document.getElementById('edit-fp-id').value = '';
  document.getElementById('edit-fp-periodo').value = '';
  document.getElementById('edit-fp-filial').value = '028501';
  document.getElementById('edit-fp-filial').disabled = false;
  document.getElementById('edit-fp-periodo').disabled = false;

  ['edit-fp-est-ini','edit-fp-compras-qtd','edit-fp-transf-ent-qtd','edit-fp-transf-sai-qtd',
   'edit-fp-nascimentos','edit-fp-mortes-perda','edit-fp-mortes-consumo','edit-fp-vendas-qtd',
   'edit-fp-ajuste-inv','edit-fp-est-fin','edit-fp-est-fazenda','edit-fp-vl-est-ini',
   'edit-fp-vl-compras','edit-fp-vl-transf-ent','edit-fp-vl-nutricao','edit-fp-vl-pasto',
   'edit-fp-cavu','edit-fp-cav','edit-fp-cam-perdas','edit-fp-cam-consumo','edit-fp-vl-est-fin','edit-fp-obs']
    .forEach(id => document.getElementById(id).value = '');

  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
}

function openEditFechamentoForm(id) {
  const f = fechamentosCRUDList.find(x => x.FP_ID === id);
  if (!f) return;

  document.getElementById('edit-fp-id').value = f.FP_ID;
  document.getElementById('edit-fp-periodo').value = `${f.FP_ANO}-${String(f.FP_MES).padStart(2,'0')}`;
  document.getElementById('edit-fp-filial').value = f.FP_EMPRESA;
  document.getElementById('edit-fp-filial').disabled = true;
  document.getElementById('edit-fp-periodo').disabled = true;

  document.getElementById('edit-fp-est-ini').value = f.FP_ESTOQUE_INI;
  document.getElementById('edit-fp-compras-qtd').value = f.FP_COMPRAS_QTD;
  document.getElementById('edit-fp-transf-ent-qtd').value = f.FP_TRANSF_ENT_QTD;
  document.getElementById('edit-fp-transf-sai-qtd').value = f.FP_TRANSF_SAI_QTD;
  document.getElementById('edit-fp-nascimentos').value = f.FP_NASCIMENTOS;
  document.getElementById('edit-fp-mortes-perda').value = f.FP_MORTES_PERDA;
  document.getElementById('edit-fp-mortes-consumo').value = f.FP_MORTES_CONSUMO;
  document.getElementById('edit-fp-vendas-qtd').value = f.FP_VENDAS_QTD;
  document.getElementById('edit-fp-ajuste-inv').value = f.FP_AJUSTE_INV;
  document.getElementById('edit-fp-est-fin').value = f.FP_ESTOQUE_FIN;
  document.getElementById('edit-fp-est-fazenda').value = f.FP_ESTOQUE_FAZENDA;
  document.getElementById('edit-fp-vl-est-ini').value = f.FP_VL_ESTOQUE_INI;
  document.getElementById('edit-fp-vl-compras').value = f.FP_VL_COMPRAS;
  document.getElementById('edit-fp-vl-transf-ent').value = f.FP_VL_TRANSF_ENT;
  document.getElementById('edit-fp-vl-nutricao').value = f.FP_VL_NUTRICAO;
  document.getElementById('edit-fp-vl-pasto').value = f.FP_VL_PASTO;
  document.getElementById('edit-fp-cavu').value = f.FP_CAV_U;
  document.getElementById('edit-fp-cav').value = f.FP_CAV;
  document.getElementById('edit-fp-cam-perdas').value = f.FP_CAM_PERDAS;
  document.getElementById('edit-fp-cam-consumo').value = f.FP_CAM_CONSUMO;
  document.getElementById('edit-fp-vl-est-fin').value = f.FP_VL_ESTOQUE_FIN;
  document.getElementById('edit-fp-obs').value = f.FP_OBS || '';

  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
}

function closeFechamentoForm() {
  document.getElementById('edit-fechamento-form-view').style.display = 'none';
  document.getElementById('edit-fechamento-list-view').style.display = 'block';
}

async function deleteFechamento(id) {
  if (!confirm('Confirma a exclusão deste fechamento?')) return;
  try {
    const r = await fetch(`/api/pecuaria/fechamento/${id}`, { method: 'DELETE' });
    const j = await r.json();
    if (j.success) {
      showToast('Fechamento excluído.', 'success');
      await loadFechamentosCRUD();
      await loadResumoAnual();
    }
  } catch(e) {
    showToast('Erro ao excluir.', 'error');
  }
}

async function saveFechamentoForm() {
  const id = document.getElementById('edit-fp-id').value;
  const periodo = document.getElementById('edit-fp-periodo').value;
  const filial = document.getElementById('edit-fp-filial').value;

  if (!periodo || !filial) {
    showToast('Período e Filial são obrigatórios.', 'warning');
    return;
  }

  const payload = {
    periodo,
    filial,
    estoqueIni: parseFloat(document.getElementById('edit-fp-est-ini').value) || 0,
    comprasQtd: parseFloat(document.getElementById('edit-fp-compras-qtd').value) || 0,
    transfEntQtd: parseFloat(document.getElementById('edit-fp-transf-ent-qtd').value) || 0,
    transfSaiQtd: parseFloat(document.getElementById('edit-fp-transf-sai-qtd').value) || 0,
    nascimentos: parseInt(document.getElementById('edit-fp-nascimentos').value) || 0,
    mortesPerda: parseInt(document.getElementById('edit-fp-mortes-perda').value) || 0,
    mortesConsumo: parseInt(document.getElementById('edit-fp-mortes-consumo').value) || 0,
    vendasQtd: parseFloat(document.getElementById('edit-fp-vendas-qtd').value) || 0,
    ajusteInv: parseFloat(document.getElementById('edit-fp-ajuste-inv').value) || 0,
    estoqueFin: parseFloat(document.getElementById('edit-fp-est-fin').value) || 0,
    estoqueFazenda: parseFloat(document.getElementById('edit-fp-est-fazenda').value) || 0,
    vlEstoqueIni: parseFloat(document.getElementById('edit-fp-vl-est-ini').value) || 0,
    vlCompras: parseFloat(document.getElementById('edit-fp-vl-compras').value) || 0,
    vlTransfEnt: parseFloat(document.getElementById('edit-fp-vl-transf-ent').value) || 0,
    vlNutricao: parseFloat(document.getElementById('edit-fp-vl-nutricao').value) || 0,
    vlPasto: parseFloat(document.getElementById('edit-fp-vl-pasto').value) || 0,
    cavu: parseFloat(document.getElementById('edit-fp-cavu').value) || 0,
    cav: parseFloat(document.getElementById('edit-fp-cav').value) || 0,
    camPerdas: parseFloat(document.getElementById('edit-fp-cam-perdas').value) || 0,
    camConsumo: parseFloat(document.getElementById('edit-fp-cam-consumo').value) || 0,
    vlEstoqueFin: parseFloat(document.getElementById('edit-fp-vl-est-fin').value) || 0,
    obs: document.getElementById('edit-fp-obs').value
  };

  const isEdit = !!id;
  const url = isEdit ? `/api/pecuaria/fechamento/${id}` : '/api/pecuaria/fechamento';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (j.success) {
      showToast(isEdit ? 'Ajuste atualizado.' : 'Fechamento inserido.', 'success');
      closeFechamentoForm();
      await loadFechamentosCRUD();
      await loadResumoAnual();
    } else {
      showToast('Erro: ' + j.error, 'error');
    }
  } catch(e) {
    showToast('Erro de rede.', 'error');
  }
}

// ─── Inicialização de datas nos filtros ───────────────────────
function initDrillDates() {
  const { de, ate } = defaultDates();
  for (let i = 1; i <= 5; i++) {
    const dEl = document.getElementById(`d${i}-de`);
    const aEl = document.getElementById(`d${i}-ate`);
    if (dEl && !dEl.value) dEl.value = de;
    if (aEl && !aEl.value) aEl.value = ate;
  }
}

// ─── Setup de Event Listeners ─────────────────────────────────
function setupEvents() {
  // Params panel toggle
  document.getElementById('params-toggle').addEventListener('click', () => {
    const body = document.getElementById('params-body');
    const chev = document.getElementById('params-chevron');
    const isClosed = body.style.display === 'none';
    body.style.display = isClosed ? 'block' : 'none';
    chev.style.transform = isClosed ? 'rotate(0deg)' : 'rotate(-90deg)';
  });

  // Params save
  document.getElementById('btn-save-params').addEventListener('click', saveParams);

  // Params form changes → repopulate when filial/mesano changes
  document.getElementById('params-filial').addEventListener('change', populateParamsForm);
  document.getElementById('params-mes-ano').addEventListener('change', populateParamsForm);

  // KPI período
  document.querySelectorAll('[data-periodo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-periodo]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kpiPeriodo = btn.dataset.periodo;
      updateKPIs();
    });
  });

  document.querySelectorAll('[data-kpi-periodo]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kpi-periodo]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kpiPeriodo = btn.dataset.kpiPeriodo;
      updateKPIs();
    });
  });

  // Moeda
  document.querySelectorAll('[data-moeda]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-moeda]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.moeda = btn.dataset.moeda;
    });
  });

  // Empresa
  document.querySelectorAll('[data-empresa]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-empresa]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.empresaFiltro = btn.dataset.empresa;
      renderAnualGrid();
      updateKPIs();
    });
  });

  // Safra / Calendário toggle
  const btnCal = document.getElementById('btn-toggle-cal');
  btnCal.addEventListener('click', () => {
    state.tipoCalendario = state.tipoCalendario === 'safra' ? 'calendario' : 'safra';
    btnCal.innerHTML = state.tipoCalendario === 'safra'
      ? '<i class="fa-solid fa-seedling"></i> Safra Agrícola'
      : '<i class="fa-solid fa-calendar"></i> Ano Calendário';
    loadResumoAnual();
  });

  // Reload/Refresh
  document.getElementById('btn-refresh').addEventListener('click', () => loadResumoAnual());

  // Modal fechar — confirmar
  document.getElementById('btn-confirmar-fechamento').addEventListener('click', confirmarFechamento);

  // Modal excluir — confirmar
  document.getElementById('btn-confirmar-exclusao').addEventListener('click', confirmarExclusao);

  // Botões Ajustes Manuais
  document.getElementById('btn-open-edit-fechamento').addEventListener('click', () => {
    openModal('modal-edit-fechamento');
    loadFechamentosCRUD();
  });

  document.getElementById('filter-modal-periodo').addEventListener('change', loadFechamentosCRUD);
  document.getElementById('filter-modal-filial').addEventListener('change', loadFechamentosCRUD);
  document.getElementById('btn-save-edit-form').addEventListener('click', saveFechamentoForm);

  // Fechar modal ao clicar fora
  document.querySelectorAll('.modal-overlay').forEach(mo => {
    mo.addEventListener('click', (e) => { if (e.target === mo) mo.classList.remove('open'); });
  });

  // Params mes-ano: default ao mês anterior
  const hoje = new Date();
  const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  document.getElementById('params-mes-ano').value =
    `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
}

// Expor funções chamadas por onclick inline do HTML ao escopo global (window)
window.toggleDrill = toggleDrill;
window.loadDrill = loadDrill;
window.openNewFechamentoForm = openNewFechamentoForm;
window.openEditFechamentoForm = openEditFechamentoForm;
window.closeFechamentoForm = closeFechamentoForm;
window.deleteFechamento = deleteFechamento;
window.openFecharMes = openFecharMes;
window.openExcluirFechamento = openExcluirFechamento;
window.closeModal = closeModal;

// ─── Init ─────────────────────────────────────────────────────
async function init() {
  setupEvents();
  initDrillDates();
  await Promise.all([loadParams(), loadResumoAnual()]);
}

document.addEventListener('DOMContentLoaded', init);


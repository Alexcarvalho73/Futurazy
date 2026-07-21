/**
 * app_fluxo_caixa.js — Painel Fluxo de Caixa
 * FuturazyBI
 */

// ────────────────────────────────────────────────────────────
// Estado global
// ────────────────────────────────────────────────────────────
const state = {
  tipoCalendario: 'safra',   // 'safra' | 'contabil'
  moeda:          'BRL',     // 'BRL' | 'USD'
  taxaDolar:      1,         // Taxa do input
  ptaxHoje:       1,         // Taxa do dia carregada
  dolarEditado:   false,
  grupo:          'Futurazy',
  filial:         'TODAS',
  allData:        [],
  saldoInicial:   0,
  colsExpanded:   true,      // exibir R/V/P individuais ou só Total
  expandedPLs:    new Set()  // Conta P&Ls expandidos
};

// ────────────────────────────────────────────────────────────
// Formatação
// ────────────────────────────────────────────────────────────
const fmtBrl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUsd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtVal(v) {
  if (v == null || isNaN(Number(v))) return '—';
  const n = Number(v);
  return state.moeda === 'USD' ? fmtUsd.format(n) : fmtBrl.format(n);
}

function valClass(v) {
  const n = Number(v);
  if (!v || n === 0) return 'val-zero';
  return n > 0 ? 'val-pos' : 'val-neg';
}

function cellVal(v) {
  const n = Number(v) || 0;
  const cls = valClass(n);
  return `<span class="${cls}">${fmtVal(n)}</span>`;
}

function calcAH(atual, anterior) {
  if (!anterior || anterior === 0) return null;
  return ((atual / anterior) - 1) * 100;
}

function renderAH(ah) {
  if (ah === null || ah === undefined) return '<span class="ah-zero">—</span>';
  const n = Number(ah);
  if (isNaN(n)) return '<span class="ah-zero">—</span>';
  const icon = n > 0 ? '▲' : n < 0 ? '▼' : '=';
  const cls  = n > 0 ? 'ah-pos' : n < 0 ? 'ah-neg' : 'ah-zero';
  return `<span class="${cls}">${icon} ${Math.abs(n).toFixed(0)}%</span>`;
}

// ────────────────────────────────────────────────────────────
// Calendário — período da grid
// ────────────────────────────────────────────────────────────
function getMeses() {
  const hoje = new Date();
  const meses = [];

  if (state.tipoCalendario === 'safra') {
    // Setembro do ano anterior até Agosto do próximo
    const safraAno = hoje.getMonth() + 1 >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
    for (let m = 9; m <= 12; m++) {
      meses.push(`${safraAno - 1}${String(m).padStart(2,'0')}`);
    }
    for (let m = 1; m <= 8; m++) {
      meses.push(`${safraAno}${String(m).padStart(2,'0')}`);
    }
  } else {
    // Janeiro a Dezembro do ano atual
    const ano = hoje.getFullYear();
    for (let m = 1; m <= 12; m++) {
      meses.push(`${ano}${String(m).padStart(2,'0')}`);
    }
  }

  return meses;
}

function formatMesLabel(ym) {
  // YYYYMM → MMM/YY
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const y = ym.slice(0,4);
  const m = parseInt(ym.slice(4,6), 10);
  return `${meses[m-1]}/${y.slice(2)}`;
}

// ────────────────────────────────────────────────────────────
// Lógica de Safra do Registro
// ────────────────────────────────────────────────────────────
function safraCorrenteDeData(dataVenc) {
  if (!dataVenc) return null;
  const d = new Date(dataVenc);
  const mes = d.getMonth() + 1; // 1-12
  const ano = d.getFullYear();
  return mes >= 9 ? ano : (ano - 1);
}

const TPGER_PROXIMA_SAFRA = new Set(['ADUB','CALC','DEF','SEM']);

function getContaPL(row) {
  // Regra de reclassificação para "Adiantamento para Próxima Safra"
  const tpGer = (row.TP_GER || '').trim().toUpperCase();
  if (TPGER_PROXIMA_SAFRA.has(tpGer)) {
    const safraStr = (row.SAFRA || '').toString().trim();
    const safraRegistro = parseInt(safraStr.substring(0, 4), 10);
    if (!isNaN(safraRegistro)) {
      const safraCorrente = safraCorrenteDeData(row.DATA_VENCIMENTO);
      if (safraCorrente !== null && safraRegistro > safraCorrente) {
        return { contaPL: 'ADIANTAMENTO PROXIMA SAFRA', nivel: '1.3' };
      }
    }
  }
  return {
    contaPL: row.FP_CONTA_PL || 'SEM CLASSIFICACAO',
    nivel:   row.FP_NIVEL    || '9.9'
  };
}

// ────────────────────────────────────────────────────────────
// Construção do Pivot
// ────────────────────────────────────────────────────────────
function buildPivot(data, meses) {
  // Estrutura: Map<nivel_contaPL, { contaPL, nivel, subItems: Map<tpGer, { desc, meses: Map<anoMes, {R,V,P}> }> }>
  const plMap = new Map(); // chave: `${nivel}|${contaPL}`

  data.forEach(row => {
    const isRealizado = (row.STATUS === 'PAGO' || row.STATUS === 'RECEBIDO');
    let vlrBrl = Number(row.VALOR_BRL) || 0;
    let vlrUsd = Number(row.VALOR_USD) || 0;
    let mo = Number(row.MO) || 1;
    let ptaxRec = Number(row.PTAX) || 0;

    // Regra Moeda 2
    if (mo === 2) {
      if (isRealizado && ptaxRec > 0) {
        vlrBrl = vlrUsd * ptaxRec;
      } else {
        vlrBrl = vlrUsd * state.taxaDolar;
      }
    }

    // Regra Visão USD
    let valToShow = 0;
    if (state.moeda === 'USD') {
      if (mo === 2) {
        valToShow = vlrUsd; // já em dólar
      } else {
        if (isRealizado && ptaxRec > 0) {
          valToShow = vlrBrl / ptaxRec;
        } else {
          valToShow = vlrBrl / state.taxaDolar;
        }
      }
    } else {
      valToShow = vlrBrl;
    }

    const valor = valToShow || 0;
    if (valor === 0) return; // ignorar zeros

    const { contaPL, nivel } = getContaPL(row);
    const plKey = `${nivel}|${contaPL}`;

    const tpGer   = (row.TP_GER || '').trim();
    const descTpGer = (row.DESC_TP_GER || tpGer).trim();
    const anoMes  = (row.ANO_MES || '').toString().trim();
    const coluna  = row.COLUNA; // 'REALIZADO', 'PROVISAO', 'PROJECAO'

    if (!plMap.has(plKey)) {
      plMap.set(plKey, { contaPL, nivel, subItems: new Map() });
    }
    const plEntry = plMap.get(plKey);

    if (!plEntry.subItems.has(tpGer)) {
      plEntry.subItems.set(tpGer, { tpGer, descTpGer, meses: new Map() });
    }
    const tgEntry = plEntry.subItems.get(tpGer);

    if (!tgEntry.meses.has(anoMes)) {
      tgEntry.meses.set(anoMes, { R: 0, V: 0, P: 0 });
    }
    const mesEntry = tgEntry.meses.get(anoMes);
    if (coluna === 'REALIZADO') mesEntry.R += valor;
    else if (coluna === 'PROVISAO') mesEntry.V += valor;
    else if (coluna === 'PROJECAO') mesEntry.P += valor;
  });

  // Ordenar por nível
  const sorted = [...plMap.values()].sort((a, b) => {
    const na = parseFloat(a.nivel) || 99;
    const nb = parseFloat(b.nivel) || 99;
    return na - nb;
  });

  return sorted;
}

// Agrupa PLs em grupos de variação (VARIAÇÃO CX X)
const GRUPOS_VARIACAO = [
  { label: 'VARIAÇÃO CX OPERACIONAL',          nivelPrefix: '1' },
  { label: 'VARIAÇÃO CX INVESTIMENTOS',        nivelPrefix: '2' },
  { label: 'VARIAÇÃO CX FINANCIAMENTOS',       nivelPrefix: '3' },
  { label: 'VARIAÇÃO CX APLICAÇÕES E OUTROS',  nivelPrefix: '4' },
];

// Soma de R+V+P por mês de um array de PLs
function somarMeses(plItems, meses) {
  const totais = {}; // anoMes -> {R,V,P,T}
  meses.forEach(m => totais[m] = {R:0, V:0, P:0});

  plItems.forEach(pl => {
    pl.subItems.forEach(tg => {
      meses.forEach(m => {
        const mv = tg.meses.get(m);
        if (mv) {
          totais[m].R += mv.R;
          totais[m].V += mv.V;
          totais[m].P += mv.P;
        }
      });
    });
  });
  meses.forEach(m => { totais[m].T = totais[m].R + totais[m].V + totais[m].P; });
  return totais;
}

// ────────────────────────────────────────────────────────────
// Render — Cabeçalho da tabela
// ────────────────────────────────────────────────────────────
function renderHeader(meses) {
  const colToggleBtn = `<button class="btn-expand-cols" id="btn-toggle-cols" title="Expandir/recolher colunas">${state.colsExpanded ? '◀' : '▶'}</button>`;

  // Linha 1: grupos de mês
  let row1 = `<tr>
    <th rowspan="2" style="text-align:left;min-width:230px;vertical-align:middle;background:var(--bg-card);position:sticky;left:0;z-index:20;">Mês/Ano</th>`;

  meses.forEach((m, i) => {
    const detail = state.colsExpanded ? 'colspan="5"' : 'colspan="2"';
    const sep = i === 0 ? '' : ' th-mes-separator';
    row1 += `<th ${detail} class="th-mes-grupo${sep}">${formatMesLabel(m)} ${colToggleBtn}</th>`;
    // só mostrar o botão uma vez
    if (i === 0) { /* already done */ }
  });

  // Coluna Acumulado
  const accDetail = state.colsExpanded ? 'colspan="5"' : 'colspan="2"';
  row1 += `<th ${accDetail} class="th-mes-grupo th-mes-separator th-acumulado">Acumulado</th>`;
  row1 += '</tr>';

  // Linha 2: sub-cabeçalhos
  let row2 = '<tr>';
  meses.forEach((_, i) => {
    const sep = i === 0 ? '' : 'th-mes-separator ';
    if (state.colsExpanded) {
      row2 += `<th class="${sep}th-col-header col-detail">Realizado</th>`;
      row2 += `<th class="th-col-header col-detail">Provisão</th>`;
      row2 += `<th class="th-col-header col-detail">Projeção</th>`;
    }
    row2 += `<th class="${sep}th-col-header th-total">Total</th>`;
    row2 += `<th class="th-col-header th-ah">AH%</th>`;
  });
  // Acumulado sub-cabeçalhos
  if (state.colsExpanded) {
    row2 += `<th class="th-mes-separator th-col-header col-detail th-acumulado">Realizado</th>`;
    row2 += `<th class="th-col-header col-detail th-acumulado">Provisão</th>`;
    row2 += `<th class="th-col-header col-detail th-acumulado">Projeção</th>`;
  }
  row2 += `<th class="th-mes-separator th-col-header th-total th-acumulado">Total</th>`;
  row2 += `<th class="th-col-header th-ah th-acumulado">AH%</th>`;
  row2 += '</tr>';

  return row1 + row2;
}

// ────────────────────────────────────────────────────────────
// Render — Células de valores por mês
// ────────────────────────────────────────────────────────────
function renderMesCells(totaisMes, meses, prevTotaisMes, drillCtx = null) {
  let html = '';
  // Acumulado
  let accR = 0, accV = 0, accP = 0;

  meses.forEach((m, i) => {
    const mv = totaisMes[m] || {R:0,V:0,P:0,T:0};
    const prevMes = i > 0 ? meses[i-1] : null;
    const prevMv  = prevMes ? (totaisMes[prevMes] || {T:0}) : null;
    const ah = prevMv ? calcAH(mv.T, prevMv.T) : null;

    const sep = i === 0 ? '' : 'td-separator ';
    const detClass = 'col-detail' + (state.colsExpanded ? '' : ' hidden');

    let dblClickR = '', dblClickV = '', dblClickP = '', classClick = '';
    if (drillCtx) {
       const argsR = `abrirDrillDown('${m}', '${drillCtx.tpGer || ''}', '${drillCtx.contaPL || ''}', 'REALIZADO')`;
       const argsV = `abrirDrillDown('${m}', '${drillCtx.tpGer || ''}', '${drillCtx.contaPL || ''}', 'PROVISAO')`;
       const argsP = `abrirDrillDown('${m}', '${drillCtx.tpGer || ''}', '${drillCtx.contaPL || ''}', 'PROJECAO')`;
       dblClickR = `ondblclick="${argsR}"`;
       dblClickV = `ondblclick="${argsV}"`;
       dblClickP = `ondblclick="${argsP}"`;
       classClick = ' clickable-cell';
    }

    if (state.colsExpanded) {
      html += `<td class="${sep}${detClass}${mv.R !== 0 ? classClick : ''}" ${mv.R !== 0 ? dblClickR : ''}>${cellVal(mv.R)}</td>`;
      html += `<td class="${detClass}${mv.V !== 0 ? classClick : ''}" ${mv.V !== 0 ? dblClickV : ''}>${cellVal(mv.V)}</td>`;
      html += `<td class="${detClass}${mv.P !== 0 ? classClick : ''}" ${mv.P !== 0 ? dblClickP : ''}>${cellVal(mv.P)}</td>`;
    }
    html += `<td class="${sep}">${cellVal(mv.T)}</td>`;
    html += `<td>${renderAH(ah)}</td>`;

    accR += mv.R; accV += mv.V; accP += mv.P;
  });

  // Acumulado
  const accT = accR + accV + accP;
  const detClass = 'col-detail' + (state.colsExpanded ? '' : ' hidden');
  if (state.colsExpanded) {
    html += `<td class="td-separator td-acumulado ${detClass}">${cellVal(accR)}</td>`;
    html += `<td class="td-acumulado ${detClass}">${cellVal(accV)}</td>`;
    html += `<td class="td-acumulado ${detClass}">${cellVal(accP)}</td>`;
  }
  html += `<td class="td-separator td-acumulado">${cellVal(accT)}</td>`;
  html += `<td class="td-acumulado">—</td>`;

  return html;
}

// ────────────────────────────────────────────────────────────
// Render — Grid completo
// ────────────────────────────────────────────────────────────
function renderGrid(pivot, meses, saldoInicial) {
  let html = '';

  // Calcular totais por grupo de variação
  const variacoes = GRUPOS_VARIACAO.map(gv => {
    const pls = pivot.filter(pl => pl.nivel.startsWith(gv.nivelPrefix + '.'));
    const totais = somarMeses(pls, meses);
    return { ...gv, pls, totais };
  });

  // Variação total caixa
  const varTotalMes = {};
  meses.forEach(m => {
    varTotalMes[m] = {R:0, V:0, P:0, T:0};
    variacoes.forEach(gv => {
      varTotalMes[m].R += gv.totais[m]?.R || 0;
      varTotalMes[m].V += gv.totais[m]?.V || 0;
      varTotalMes[m].P += gv.totais[m]?.P || 0;
      varTotalMes[m].T += gv.totais[m]?.T || 0;
    });
  });

  // Saldos por mês
  const saldos = {};
  meses.forEach((m, i) => {
    const ini = i === 0 ? saldoInicial : (saldos[meses[i-1]]?.final || 0);
    const variacao = varTotalMes[m]?.T || 0;
    saldos[m] = { inicial: ini, variacao, final: ini + variacao };
  });

  // Renderizar grupo a grupo
  variacoes.forEach((gv) => {
    // PLs deste grupo
    gv.pls.forEach(pl => {
      const plKey = `pl_${pl.nivel}_${pl.contaPL}`.replace(/[^a-zA-Z0-9_]/g,'_');
      const isExpanded = state.expandedPLs.has(plKey);
      const toggleIcon = isExpanded ? '▼' : '▶';

      // Calcular totais de ContaPL (soma dos TipoGerencial)
      const plTotais = {};
      meses.forEach(m => plTotais[m] = {R:0,V:0,P:0,T:0});
      pl.subItems.forEach(tg => {
        meses.forEach(m => {
          const mv = tg.meses.get(m) || {R:0,V:0,P:0};
          plTotais[m].R += mv.R;
          plTotais[m].V += mv.V;
          plTotais[m].P += mv.P;
          plTotais[m].T += mv.R + mv.V + mv.P;
        });
      });

      // Linha nível 0 — Conta P&L
      html += `<tr class="lvl-0" data-pl="${plKey}">
        <td>
          <span class="toggle-btn" onclick="togglePL('${plKey}')">${toggleIcon}</span>
          ${pl.contaPL}
        </td>
        ${renderMesCells(plTotais, meses, null, { contaPL: pl.contaPL })}
      </tr>`;

      // Linhas nível 1 — Tipo Gerencial
      const subItemsSorted = Array.from(pl.subItems.values()).sort((a, b) => {
        const nameA = (a.descTpGer || a.tpGer || '').trim().toUpperCase();
        const nameB = (b.descTpGer || b.tpGer || '').trim().toUpperCase();
        return nameA.localeCompare(nameB);
      });

      subItemsSorted.forEach(tg => {
        const tgTotais = {};
        meses.forEach(m => {
          const mv = tg.meses.get(m) || {R:0,V:0,P:0};
          tgTotais[m] = { R: mv.R, V: mv.V, P: mv.P, T: mv.R + mv.V + mv.P };
        });

        html += `<tr class="lvl-1 child-of-${plKey}${isExpanded ? '' : ' row-hidden'}">
          <td style="padding-left:30px;">${tg.descTpGer || tg.tpGer}</td>
          ${renderMesCells(tgTotais, meses, null, { tpGer: tg.tpGer, contaPL: pl.contaPL })}
        </tr>`;
      });
    });

    // Linha de Variação do grupo
    html += `<tr class="row-variacao">
      <td>${gv.label}</td>
      ${renderMesCells(gv.totais, meses, null)}
    </tr>`;

    // Espaçador visual
    html += `<tr style="height:4px;"><td colspan="999" style="padding:0;border:none;background:transparent;"></td></tr>`;
  });

  // ── Rodapé ────────────────────────────────────────────────
  // VARIAÇÃO TOTAL CAIXA
  html += `<tr class="row-variacao-total">
    <td>VARIAÇÃO TOTAL CAIXA</td>
    ${renderMesCells(varTotalMes, meses, null)}
  </tr>`;

  // SALDO INICIAL DO PERÍODO
  const saldoIniMes = {};
  const saldoFimMes = {};
  meses.forEach(m => {
    saldoIniMes[m] = { R:0, V:0, P:0, T: saldos[m].inicial };
    saldoFimMes[m] = { R:0, V:0, P:0, T: saldos[m].final };
  });

  html += `<tr class="row-saldo">
    <td>SALDO INICIAL DO PERÍODO</td>
    ${renderMesCells(saldoIniMes, meses, null)}
  </tr>`;

  html += `<tr class="row-saldo row-saldo-final">
    <td>SALDO FINAL DO PERÍODO</td>
    ${renderMesCells(saldoFimMes, meses, null)}
  </tr>`;

  return html;
}

// ────────────────────────────────────────────────────────────
// Toggle expand/collapse de Conta P&L
// ────────────────────────────────────────────────────────────
window.togglePL = function(plKey) {
  const isExpanded = state.expandedPLs.has(plKey);
  const children = document.querySelectorAll(`.child-of-${plKey}`);
  const parentRow = document.querySelector(`tr[data-pl="${plKey}"]`);
  const btn = parentRow?.querySelector('.toggle-btn');

  if (isExpanded) {
    state.expandedPLs.delete(plKey);
    children.forEach(r => r.classList.add('row-hidden'));
    if (btn) btn.textContent = '▶';
  } else {
    state.expandedPLs.add(plKey);
    children.forEach(r => r.classList.remove('row-hidden'));
    if (btn) btn.textContent = '▼';
  }
};

// ────────────────────────────────────────────────────────────
// Renderização completa
// ────────────────────────────────────────────────────────────
function renderAll() {
  const meses = getMeses();
  const pivot = buildPivot(state.allData, meses);

  const thead = document.getElementById('fc-thead');
  const tbody = document.getElementById('fc-tbody');

  if (thead) thead.innerHTML = renderHeader(meses);
  if (tbody) tbody.innerHTML = renderGrid(pivot, meses, state.saldoInicial);

  // Rebind toggle de colunas
  document.getElementById('btn-toggle-cols')?.addEventListener('click', toggleColunas);
}

function toggleColunas() {
  state.colsExpanded = !state.colsExpanded;
  renderAll();
}

// ────────────────────────────────────────────────────────────
// Carregamento de dados
// ────────────────────────────────────────────────────────────
async function loadAll() {
  const meses = getMeses();
  const inicio = meses[0];
  const fim = meses[meses.length - 1];

  // Mostrar loading
  const status = document.getElementById('fc-status');
  const tbody  = document.getElementById('fc-tbody');
  if (status) { status.style.display = 'block'; status.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Carregando dados...'; }
  if (tbody)  tbody.innerHTML = '<tr class="loading-row"><td colspan="99"><i class="fa-solid fa-circle-notch fa-spin"></i> Aguardando dados...</td></tr>';

  try {
    const params = new URLSearchParams({
      anoMesInicio: inicio,
      anoMesFim:    fim,
      grupo:        state.grupo,
      filial:       state.filial
    });

    const [resData, resSaldo] = await Promise.all([
      fetch(`/api/fluxo-caixa?${params}`).then(r => r.json()),
      fetch(`/api/fluxo-caixa/saldo-inicial?anoMesInicio=${inicio}&grupo=${state.grupo}&filial=${state.filial}`).then(r => r.json())
    ]);

    if (!resData.success) throw new Error(resData.error || 'Erro ao carregar dados');

    state.allData     = resData.data || [];
    state.saldoInicial = resSaldo.success ? (Number(resSaldo.saldo) || 0) : 0;

    if (resData.ptaxHoje) {
      state.ptaxHoje = parseFloat(resData.ptaxHoje) || 1;
      if (!state.dolarEditado) {
        state.taxaDolar = state.ptaxHoje;
        const ipt = document.getElementById('input-dolar');
        if (ipt) ipt.value = state.taxaDolar.toFixed(4).replace('.', ',');
        const btnReset = document.getElementById('btn-reset-dolar');
        if (btnReset) btnReset.style.display = 'none';
      }
    }

    if (status) status.style.display = 'none';
    renderAll();

  } catch (err) {
    console.error('[fluxo-caixa]', err);
    if (status) { status.style.display = 'block'; status.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#f87171;"></i> Erro: ${err.message}`; }
    if (tbody)  tbody.innerHTML = `<tr class="empty-row"><td colspan="99"><i class="fa-solid fa-triangle-exclamation" style="color:#f87171;"></i> Erro ao carregar dados</td></tr>`;
  }
}

// ────────────────────────────────────────────────────────────
// Carrega filiais disponíveis (para o select)
// ────────────────────────────────────────────────────────────
async function loadFiliais() {
  // Gerar lista estática das filiais conhecidas (pode ser expandida com uma rota futura)
  const filiaisConhecidas = [
    { value: '028501', label: '028501 — Futurazy Principal' },
    { value: '028503', label: '028503 — Futurazy Filial'   },
  ];
  const sel = document.getElementById('f-filial');
  if (!sel) return;
  filiaisConhecidas.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.value;
    opt.textContent = f.label;
    sel.appendChild(opt);
  });
}

// ────────────────────────────────────────────────────────────
// Event listeners
// ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFiliais();

  // Toggle Safra/Contábil
  document.getElementById('btn-toggle-cal')?.addEventListener('click', () => {
    state.tipoCalendario = state.tipoCalendario === 'safra' ? 'contabil' : 'safra';
    const btn = document.getElementById('btn-toggle-cal');
    const lbl = document.getElementById('label-cal');
    if (state.tipoCalendario === 'safra') {
      btn.classList.remove('cal-contabil');
      lbl.textContent = 'Safra Agrícola';
    } else {
      btn.classList.add('cal-contabil');
      lbl.textContent = 'Calendário Contábil';
    }
    loadAll();
  });

  // Toggle moeda
  document.querySelectorAll('.moeda-btn[data-moeda]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.moeda-btn[data-moeda]').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#7a85a0';
      });
      btn.style.background = 'var(--color-primary)';
      btn.style.color = 'white';
      state.moeda = btn.dataset.moeda;
      renderAll(); // Só re-renderiza, dados já carregados
    });
  });

  // Filtro grupo
  document.getElementById('f-grupo')?.addEventListener('change', e => {
    state.grupo = e.target.value;
    // Resetar filial ao mudar grupo
    document.getElementById('f-filial').value = 'TODAS';
    state.filial = 'TODAS';
    loadAll();
  });

  // Filtro filial
  document.getElementById('f-filial')?.addEventListener('change', e => {
    state.filial = e.target.value;
    loadAll();
  });

  // Input Dólar
  const iptDolar = document.getElementById('input-dolar');
  if (iptDolar) {
    iptDolar.addEventListener('change', (e) => {
      let val = e.target.value.replace(',', '.');
      val = parseFloat(val);
      if (!isNaN(val) && val > 0) {
        state.taxaDolar = val;
        state.dolarEditado = true;
        e.target.value = val.toFixed(4).replace('.', ',');
        const btnReset = document.getElementById('btn-reset-dolar');
        if (btnReset) btnReset.style.display = (state.taxaDolar !== state.ptaxHoje) ? 'block' : 'none';
        renderAll(); // Recalcula instantaneamente sem ir ao banco
      }
    });
    iptDolar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') iptDolar.blur();
    });
  }

  const btnResetDolar = document.getElementById('btn-reset-dolar');
  if (btnResetDolar) {
    btnResetDolar.addEventListener('click', () => {
      state.taxaDolar = state.ptaxHoje;
      state.dolarEditado = false;
      if (iptDolar) iptDolar.value = state.taxaDolar.toFixed(4).replace('.', ',');
      btnResetDolar.style.display = 'none';
      renderAll();
    });
  }

  // Atualizar
  document.getElementById('btn-refresh')?.addEventListener('click', loadAll);

  // Expandir / Recolher todas as linhas
  document.getElementById('btn-expand-all')?.addEventListener('click', () => {
    document.querySelectorAll('#fc-tbody .lvl-0').forEach(row => {
      const plKey = row.dataset.pl;
      if (plKey) {
        state.expandedPLs.add(plKey);
        const children = document.querySelectorAll(`.child-of-${plKey}`);
        children.forEach(r => r.classList.remove('row-hidden'));
        row.querySelector('.toggle-btn').textContent = '▼';
      }
    });
  });

  document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
    document.querySelectorAll('#fc-tbody .lvl-0').forEach(row => {
      const plKey = row.dataset.pl;
      if (plKey) {
        state.expandedPLs.delete(plKey);
        const children = document.querySelectorAll(`.child-of-${plKey}`);
        children.forEach(r => r.classList.add('row-hidden'));
        row.querySelector('.toggle-btn').textContent = '▶';
      }
    });
  });

  // Modal de Drilldown eventos fechamento
  const modalDrill = document.getElementById('drilldown-modal');
  const btnCloseDrill = document.getElementById('btn-close-modal');
  if (btnCloseDrill) {
    btnCloseDrill.addEventListener('click', () => modalDrill.classList.remove('active'));
  }
  window.addEventListener('click', (e) => {
    if (e.target === modalDrill) {
      modalDrill.classList.remove('active');
    }
  });

  // Carga inicial
  loadAll();
});

// ────────────────────────────────────────────────────────────
// Modal Drill-down
// ────────────────────────────────────────────────────────────
async function abrirDrillDown(anoMes, tpGer, contaPL, coluna) {
  const modal = document.getElementById('drilldown-modal');
  const tbody = document.getElementById('drilldown-tbody');
  const status = document.getElementById('drilldown-status');
  const table = document.getElementById('drilldown-table');
  const title = document.getElementById('drilldown-title');

  modal.classList.add('active');
  table.style.display = 'none';
  status.style.display = 'block';
  tbody.innerHTML = '';
  const tituloDesc = tpGer ? tpGer : (contaPL ? contaPL : '');
  title.innerHTML = `<i class="fa-solid fa-list" style="color:#4f9cf9;"></i> Lançamentos - ${tituloDesc} (${coluna})`;

  try {
    const params = new URLSearchParams({
      anoMes,
      tpGer,
      contaPL,
      coluna,
      grupo: state.grupo,
      filial: state.filial
    });

    const res = await fetch(`/api/fluxo-caixa/drilldown?${params}`).then(r => r.json());
    if (!res.success) throw new Error(res.error || 'Erro ao carregar detalhes');

    const data = res.data || [];
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;">Nenhum lançamento encontrado.</td></tr>';
      const tfoot = document.getElementById('drilldown-tfoot');
      if (tfoot) tfoot.innerHTML = '';
    } else {
      let rowsHtml = '';
      let sumBrl = 0;
      let sumUsd = 0;
      
      const formatDt = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr; // fallback case
        return d.toLocaleDateString('pt-BR', {timeZone: 'UTC'});
      };

      data.forEach(r => {
        // formatar data
        const em = formatDt(r.DATA_EMISSAO);
        const vn = formatDt(r.DATA_VENCIMENTO);
        
        // Aplicar regra no modal
        const isRealizado = (r.STATUS === 'PAGO' || r.STATUS === 'RECEBIDO');
        let vlrBrl = Number(r.VALOR_BRL) || 0;
        let vlrUsd = Number(r.VALOR_USD) || 0;
        let mo = Number(r.MO) || 1;
        let ptaxRec = Number(r.PTAX) || 0;

        if (mo === 2) {
          if (isRealizado && ptaxRec > 0) {
            vlrBrl = vlrUsd * ptaxRec;
          } else {
            vlrBrl = vlrUsd * state.taxaDolar;
          }
        } else {
          // Se for moeda 1, calcular o USD (provisão ou realizado)
          vlrUsd = (isRealizado && ptaxRec > 0) ? (vlrBrl / ptaxRec) : (vlrBrl / state.taxaDolar);
        }

        sumBrl += vlrBrl;
        sumUsd += vlrUsd;

        const vBrlFmt = fmtBrl.format(vlrBrl);
        const vUsdFmt = fmtUsd.format(vlrUsd);
        const moedaStr = mo === 2 ? 'US$' : 'R$';
        const safraStr = r.SAFRA || '—';

        rowsHtml += `<tr>
          <td>${r.FILIAL || ''}</td>
          <td>${r.DOCUMENTO || ''}</td>
          <td>${r.TIPO || ''}</td>
          <td>${safraStr}</td>
          <td>${r.STATUS || ''}</td>
          <td>${em}</td>
          <td>${vn}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.CLIENTE_FORNECEDOR}">${r.CLIENTE_FORNECEDOR || ''}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.HISTORICO}">${r.HISTORICO || ''}</td>
          <td style="text-align:center;">${moedaStr}</td>
          <td class="text-right ${vlrBrl < 0 ? 'val-neg' : 'val-pos'}">${vBrlFmt}</td>
          <td class="text-right ${vlrUsd < 0 ? 'val-neg' : 'val-pos'}">${vUsdFmt}</td>
        </tr>`;
      });
      tbody.innerHTML = rowsHtml;

      const tfoot = document.getElementById('drilldown-tfoot');
      if (tfoot) {
        tfoot.innerHTML = `<tr>
          <td colspan="10" style="text-align:right; font-weight:bold; font-size:13px; color:var(--text-white);">TOTAIS:</td>
          <td class="text-right ${sumBrl < 0 ? 'val-neg' : 'val-pos'}" style="font-weight:bold; font-size:13px;">${fmtBrl.format(sumBrl)}</td>
          <td class="text-right ${sumUsd < 0 ? 'val-neg' : 'val-pos'}" style="font-weight:bold; font-size:13px;">${fmtUsd.format(sumUsd)}</td>
        </tr>`;
      }
    }

    status.style.display = 'none';
    table.style.display = 'table';
  } catch(err) {
    status.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#f87171;"></i> Erro: ${err.message}`;
  }
}


// =====================================
// HIERARQUIA FIXA DE ORDENAÇÃO E COMBOS
// =====================================
const hierarquiaCombos = {
  'RESULTADO FINANCEIRO': {
    'RECEITAS FINANCEIRAS': [
      '1 - Rendimentos sobre Aplicações',
      '2 - Variação Cambial Positiva'
    ],
    'DESPESAS FINANCEIRAS': [
      '1 - Juros e Taxas Financeiras',
      '2 - Variação Cambial Negativa',
      '3 - Despesas Bancárias',
      '4 - Outras Despesas Financeiras'
    ]
  },
  'OPERAÇÕES DE IMOBILIZADO': {
    'VENDA DE IMOBILIZADO': [
      '1 - Receita com Venda de Imobilizado',
      '2 - Indenizações Recebidas (Seguros)',
      '3 - Receitas com Vendas Diversas'
    ],
    'DEPRECIAÇÕES': [
      '1 - Depreciação de benfeitorias/instalações',
      '2 - Depreciação de Maquinas/Imp e Veiculos',
      '3 - Demais Depreciações'
    ]
  }
};

let currentDataDe = '';
let currentDataAte = '';
let state = {
  tipoCalendario: 'safra',
  isAnterior: false
};

document.addEventListener('DOMContentLoaded', () => {
  // Garantir que os botões abram as modais via JS (evita problemas de cache no HTML)
  const btnEdit = document.getElementById('btn-open-edit-fechamento');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      if (typeof window.openModalFechamento === 'function') window.openModalFechamento();
    });
  }
  const btnParams = document.getElementById('btn-open-params-modal');
  if (btnParams) {
    btnParams.addEventListener('click', () => {
      const modal = document.getElementById('modal-params');
      if (modal) modal.classList.add('open');
    });
  }

  const btnAtualizar = document.getElementById('btn-atualizar');
  if(btnAtualizar) btnAtualizar.addEventListener('click', loadData);
  
  const btnToggleCal = document.getElementById('btn-toggle-cal');
  if(btnToggleCal) {
    btnToggleCal.addEventListener('click', () => {
      const label = document.getElementById('label-cal');
      const icon = btnToggleCal.querySelector('i');
      if (state.tipoCalendario === 'safra') {
        state.tipoCalendario = 'contabil';
        if(label) label.textContent = 'Ano Contábil';
        if(icon) { icon.classList.remove('fa-seedling'); icon.classList.add('fa-calendar'); }
      } else {
        state.tipoCalendario = 'safra';
        if(label) label.textContent = 'Safra Agrícola';
        if(icon) { icon.classList.remove('fa-calendar'); icon.classList.add('fa-seedling'); }
      }
      loadData();
    });
  }

  const btnKpiAtual = document.getElementById('btn-kpi-atual');
  const btnKpiAnterior = document.getElementById('btn-kpi-anterior');

  if (btnKpiAtual && btnKpiAnterior) {
    const handlePeriodoClick = (isAnterior) => {
      btnKpiAtual.classList.remove('active');
      btnKpiAnterior.classList.remove('active');
      if (isAnterior) {
        btnKpiAnterior.classList.add('active');
      } else {
        btnKpiAtual.classList.add('active');
      }
      state.isAnterior = isAnterior;
      loadData();
    };

    btnKpiAtual.addEventListener('click', () => handlePeriodoClick(false));
    btnKpiAnterior.addEventListener('click', () => handlePeriodoClick(true));
  }

  loadData();

  const btnExpand = document.getElementById('btn-expand-all');
  if(btnExpand) btnExpand.addEventListener('click', () => toggleAll(true));
  const btnCollapse = document.getElementById('btn-collapse-all');
  if(btnCollapse) btnCollapse.addEventListener('click', () => toggleAll(false));

  const anualToggle = document.getElementById('anual-toggle-header');
  if(anualToggle) {
    anualToggle.addEventListener('click', () => {
      const b = document.getElementById('anual-body');
      const icon = document.getElementById('anual-chevron');
      if(b.style.display === 'none') {
        b.style.display = 'block';
        if(icon) icon.style.transform = 'rotate(0deg)';
      } else {
        b.style.display = 'none';
        if(icon) icon.style.transform = 'rotate(-90deg)';
      }
    });
  }
});

function getFiltroDatas() {
  const fAno = document.getElementById('f-ano')?.value;
  const fMes = document.getElementById('f-mes')?.value;
  
  const hoje = new Date();
  
  let defaultAno = hoje.getFullYear();
  let defaultMes = hoje.getMonth() + 1;
  
  if (state.isAnterior) {
    defaultMes -= 1;
    if (defaultMes === 0) {
      defaultMes = 12;
      defaultAno -= 1;
    }
  }
  
  let ano = fAno ? parseInt(fAno) : defaultAno;
  let mes = fMes && fMes !== 'todos' ? parseInt(fMes) : defaultMes;
  
  let safraAnoEnd = (mes >= 9) ? ano + 1 : ano;
  
  if (fMes === 'todos') {
    return { dataDe: `${ano}-01-01`, dataAte: `${ano}-12-31`, isAnual: true, anoReq: ano, safraAnoEnd };
  } else {
    const dIni = new Date(ano, mes - 1, 1);
    const dFim = new Date(ano, mes, 0);
    const mStr = (dIni.getMonth() + 1).toString().padStart(2, '0');
    return {
      dataDe: `${ano}-${mStr}-01`,
      dataAte: `${ano}-${mStr}-${dFim.getDate().toString().padStart(2, '0')}`,
      isAnual: false,
      anoReq: ano,
      safraAnoEnd
    };
  }
}

async function loadData() {
  const btn = document.getElementById('btn-atualizar');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  }

  const loadingCube = document.getElementById('loading-cube');
  if(loadingCube) loadingCube.style.display = 'flex';
  
  const loadingAnual = document.getElementById('loading-anual');
  if(loadingAnual) loadingAnual.style.display = 'flex';

  try {
    const { dataDe, dataAte, anoReq, safraAnoEnd } = getFiltroDatas();
    currentDataDe = dataDe;
    currentDataAte = dataAte;
    const isSafra = state.tipoCalendario === 'safra';

    const [resDados, resAnual, resFechados] = await Promise.all([
      fetch(`/api/fechamento/resultado?data_de=${dataDe}&data_ate=${dataAte}`).then(r => r.json()),
      fetch(`/api/fechamento/resultado/anual?ano=${anoReq}&safraAnoEnd=${safraAnoEnd}&isSafra=${isSafra}`).then(r => r.json()),
      fetch(`/api/fechamento/resultado/fechados`).then(r => r.json())
    ]);

    if (resFechados && resFechados.success) {
      state.mesesFechados = new Set(resFechados.data.map(f => `${f.FR_ANO}_${f.FR_MES}`));
    } else {
      state.mesesFechados = new Set();
    }

    if (resDados.success) {
      renderCube(resDados.data);
      updateTopCards(resDados.data);
    } else {
      console.error('Erro /api/fechamento/resultado:', resDados.error);
    }

    if (resAnual.success) {
      renderAnual(resAnual.data);
    } else {
      console.error('Erro /api/fechamento/resultado/anual:', resAnual.error);
    }
  } catch (err) {
    console.error('Erro geral ao carregar dados:', err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Atualizar Painel';
    }
    const loading = document.getElementById('loading-cube');
    if (loading) loading.style.display = 'none';
  }
}

function renderCube(data) {
  const body = document.getElementById('cube-body');
  if (!body) return;

  const tree = {}; 
  const grandTotal = { brl: 0, usd: 0 };

  const createNode = () => ({ brl: 0, usd: 0, children: {} });

  const addValue = (node, brl, usd) => {
    node.brl += brl; node.usd += usd;
  };

  for (const r of data) {
    const grupo = r.GRUPO || '(sem grupo)';
    const subgrp = r.SUBGRUPO || '(sem subgrupo)';
    const item = r.ITEM || '(sem item)';
    const det = r.DETALHE || '(sem detalhe)';
    
    if (!tree[grupo]) tree[grupo] = createNode();
    const G = tree[grupo];

    if (!G.children[subgrp]) G.children[subgrp] = createNode();
    const SG = G.children[subgrp];
    
    if (!SG.children[item]) SG.children[item] = createNode();
    const IT = SG.children[item];

    if (!IT.children[det]) IT.children[det] = createNode();
    const DT = IT.children[det];

    const brl = Number(r.VALOR_BRL || 0);
    const usd = Number(r.VALOR_USD || 0);

    addValue(DT, brl, usd);
    addValue(IT, brl, usd);
    addValue(SG, brl, usd);
    addValue(G, brl, usd);
    addValue(grandTotal, brl, usd);
  }

  const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const fmtUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  let html = '';
  let gId = 0;

  const groupOrder = Object.keys(hierarquiaCombos);
  const sortedGroups = Object.keys(tree).sort((a, b) => {
    const idxA = groupOrder.indexOf(a);
    const idxB = groupOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const gName of sortedGroups) {
    const G = tree[gName];
    gId++;
    html += `
      <tr class="level-1 row-group" data-target=".child-g${gId}" onclick="toggleRow(this)">
        <td style="cursor: pointer;">
          <i class="fa-solid fa-chevron-right toggle-icon" style="color:var(--primary); margin-right:5px;"></i>
          <strong>${gName}</strong>
        </td>
        <td>-</td>
        <td>Consolidado</td>
        <td class="text-right"><strong>${fmtBRL(G.brl)}</strong></td>
        <td class="text-right"><strong>${fmtUSD(G.usd)}</strong></td>
      </tr>
    `;

    let sgId = 0;
    const subOrder = hierarquiaCombos[gName] ? Object.keys(hierarquiaCombos[gName]) : [];
    const sortedSubgroups = Object.keys(G.children).sort((a, b) => {
      const idxA = subOrder.indexOf(a);
      const idxB = subOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    
    for (const sgName of sortedSubgroups) {
      const SG = G.children[sgName];
      sgId++;
      html += `
        <tr class="level-2 child-g${gId} row-group" data-target=".child-sg${gId}-${sgId}" onclick="toggleRow(this)" style="display:none;">
          <td style="cursor: pointer;">
            <i class="fa-solid fa-chevron-right toggle-icon" style="color:var(--text-muted); margin-left: 20px; margin-right:5px;"></i>
            ${sgName}
          </td>
          <td>-</td>
          <td>Consolidado</td>
          <td class="text-right">${fmtBRL(SG.brl)}</td>
          <td class="text-right">${fmtUSD(SG.usd)}</td>
        </tr>
      `;

      let itId = 0;
      const itemOrder = (hierarquiaCombos[gName] && hierarquiaCombos[gName][sgName]) ? hierarquiaCombos[gName][sgName] : [];
      const sortedItems = Object.keys(SG.children).sort((a, b) => {
        const idxA = itemOrder.indexOf(a);
        const idxB = itemOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

      for (const itName of sortedItems) {
        const IT = SG.children[itName];
        itId++;
        html += `
          <tr class="level-3 child-sg${gId}-${sgId} row-group" data-target=".child-it${gId}-${sgId}-${itId}" onclick="toggleRow(this)" style="display:none;">
            <td style="cursor: pointer;">
              <i class="fa-solid fa-chevron-right toggle-icon" style="color:var(--text-muted); font-size: 11px; margin-left: 40px; margin-right: 5px;"></i>
              ${itName}
            </td>
            <td>-</td>
            <td>Consolidado</td>
            <td class="text-right">${fmtBRL(IT.brl)}</td>
            <td class="text-right">${fmtUSD(IT.usd)}</td>
          </tr>
        `;

        const sortedDetails = Object.keys(IT.children).sort((a, b) => a.localeCompare(b));

        for (const dtName of sortedDetails) {
          const DT = IT.children[dtName];
          html += `
            <tr class="level-4 child-it${gId}-${sgId}-${itId}" style="display:none; font-size: 13px;">
              <td style="color: var(--text-muted);">
                <i class="fa-regular fa-file-lines" style="color:#4b5563; margin-left: 60px; margin-right: 5px;"></i>
                ${dtName}
              </td>
              <td style="color: var(--text-muted);">-</td>
              <td style="color: var(--text-muted);">Consolidado</td>
              <td class="text-right" style="color: var(--text-muted);">${fmtBRL(DT.brl)}</td>
              <td class="text-right" style="color: var(--text-muted);">${fmtUSD(DT.usd)}</td>
            </tr>
          `;
        }
      }
    }
  }

  html += `
    <tr class="total-row" style="background-color: rgba(255,255,255,0.03);">
      <td colspan="3"><strong>TOTAL GERAL</strong></td>
      <td class="text-right" style="color:var(--text-white);"><strong>${fmtBRL(grandTotal.brl)}</strong></td>
      <td class="text-right" style="color:var(--text-white);"><strong>${fmtUSD(grandTotal.usd)}</strong></td>
    </tr>
  `;

  body.innerHTML = html;
}

function updateTopCards(data) {
  let totalBrl = 0;
  let totalUsd = 0;
  data.forEach(r => {
    totalBrl += Number(r.VALOR_BRL || 0);
    totalUsd += Number(r.VALOR_USD || 0);
  });
  const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const fmtUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  
  const elBrl = document.getElementById('kpi-custo-total');
  const elUsd = document.getElementById('kpi-custo-usd');
  if(elBrl) elBrl.textContent = fmtBRL(totalBrl);
  if(elUsd) elUsd.textContent = fmtUSD(totalUsd);
}

function getContabilMonths() {
  const fAno = document.getElementById('f-ano')?.value;
  const hoje = new Date();
  let defaultAno = hoje.getFullYear();
  
  if (state.isAnterior) {
    let m = hoje.getMonth() + 1;
    if (m - 1 === 0) defaultAno -= 1;
  }

  const y = fAno ? parseInt(fAno) : defaultAno;
  const arr = [];
  for (let i = 1; i <= 12; i++) {
    arr.push(`${y}${String(i).padStart(2,'0')}`);
  }
  return arr;
}

const getSafraMonths = () => {
  const hoje = new Date();
  const fAno = document.getElementById('f-ano')?.value;
  const fMes = document.getElementById('f-mes')?.value;
  
  let defaultAno = hoje.getFullYear();
  let defaultMes = hoje.getMonth() + 1;
  
  if (state.isAnterior) {
    defaultMes -= 1;
    if (defaultMes === 0) {
      defaultMes = 12;
      defaultAno -= 1;
    }
  }

  const y = fAno ? parseInt(fAno) : defaultAno;
  const m = fMes && fMes !== 'todos' ? parseInt(fMes) : defaultMes;

  let safraAnoEnd;
  // Safra is September to August
  if (m >= 9) {
    safraAnoEnd = y + 1; // Nov 2025 -> ends in Aug 2026
  } else {
    safraAnoEnd = y;     // Feb 2026 -> ends in Aug 2026
  }

  const arr = [];
  for (let i = 9; i <= 12; i++) {
    arr.push(`${safraAnoEnd - 1}${String(i).padStart(2,'0')}`);
  }
  for (let i = 1; i <= 8; i++) {
    arr.push(`${safraAnoEnd}${String(i).padStart(2,'0')}`);
  }
  return arr;
}

function renderAnual(data) {
  const thead = document.getElementById('anual-thead');
  const tbody = document.getElementById('anual-tbody');
  if (!thead || !tbody) return;
  const fmtBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val);
  const fmtUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val);

  // We group by GRUPO -> SUBGRUPO
  const mesesArr = state.tipoCalendario === 'safra' ? getSafraMonths() : getContabilMonths();
  
  const tree = {
    'RESULTADO FINANCEIRO': {
      rows: {
        'RECEITAS FINANCEIRAS': { 
          totalAnoBrl: 0, totalAnoUsd: 0, meses: {},
          items: {
            '1 - Rendimentos sobre Aplicações': { totalAnoBrl: 0, meses: {} },
            '2 - Variação Cambial Positiva': { totalAnoBrl: 0, meses: {} }
          }
        },
        'DESPESAS FINANCEIRAS': { 
          totalAnoBrl: 0, totalAnoUsd: 0, meses: {},
          items: {
            '1 - Juros e Taxas Financeiras': { totalAnoBrl: 0, meses: {} },
            '2 - Variação Cambial Negativa': { totalAnoBrl: 0, meses: {} }
          }
        }
      },
      totalMeses: {}
    },
    'OPERAÇÕES DE IMOBILIZADO': {
      rows: {
        'VENDA DE IMOBILIZADO': { 
          totalAnoBrl: 0, totalAnoUsd: 0, meses: {},
          items: {
            '1 - Receita com Venda de Imobilizado': { totalAnoBrl: 0, meses: {} },
            '2 - Indenizações Recebidas (Seguros)': { totalAnoBrl: 0, meses: {} },
            '3 - Receitas com Vendas Diversas': { totalAnoBrl: 0, meses: {} }
          }
        },
        'DEPRECIAÇÕES': { 
          totalAnoBrl: 0, totalAnoUsd: 0, meses: {},
          items: {
            '1 - Depreciação de benfeitorias/instalações': { totalAnoBrl: 0, meses: {} },
            '2 - Depreciação de Maquinas/Imp e Veiculos': { totalAnoBrl: 0, meses: {} },
            '3 - Demais Depreciações': { totalAnoBrl: 0, meses: {} }
          }
        }
      },
      totalMeses: {}
    }
  };

  const grandTotal = {};
  for (const m of mesesArr) {
    grandTotal[m] = { brl: 0, usd: 0 };
    for (const gName in tree) {
      tree[gName].totalMeses[m] = { brl: 0, usd: 0 };
      for (const sgName in tree[gName].rows) {
        tree[gName].rows[sgName].meses[m] = { brl: 0, usd: 0 };
        if (tree[gName].rows[sgName].items) {
          for (const itName in tree[gName].rows[sgName].items) {
            tree[gName].rows[sgName].items[itName].meses[m] = { brl: 0 };
          }
        }
      }
    }
  }

  for (const r of data) {
    const grupo = r.GRUPO || '(sem grupo)';
    const subgrp = r.SUBGRUPO || '(sem subgrupo)';
    const itemName = r.ITEM || '(sem item)';
    
    const rm = `${r.ANO}${String(r.MES).padStart(2,'0')}`;

    const isClosed = state.mesesFechados.has(`${r.ANO}_${String(r.MES).padStart(2,'0')}`);
    if (isClosed && r.IS_MANUAL === false) {
      continue; // Ignora Protheus para meses fechados, lê apenas de FECHAMENTO_RESULTADO
    }
    if (!tree[grupo]) {
      tree[grupo] = { rows: {}, totalMeses: {} };
      for (const m of mesesArr) tree[grupo].totalMeses[m] = { brl: 0, usd: 0 };
    }
    const G = tree[grupo];

    if (!G.rows[subgrp]) {
      G.rows[subgrp] = { totalAnoBrl: 0, totalAnoUsd: 0, meses: {}, items: {} };
      for (const m of mesesArr) G.rows[subgrp].meses[m] = { brl: 0, usd: 0 };
    }
    const SG = G.rows[subgrp];
    
    if (!SG.items[itemName]) {
      SG.items[itemName] = { totalAnoBrl: 0, meses: {} };
      for (const m of mesesArr) SG.items[itemName].meses[m] = { brl: 0 };
    }
    const IT = SG.items[itemName];

    let brl = Number(r.VALOR_BRL || 0);
    let usd = Number(r.VALOR_USD || 0);

    // Regra de Negócio: Despesas e Depreciações devem reduzir o resultado (negativas).
    // O ERP (Protheus) já nos envia o valor com sinal negativo para saídas.
    // Porém, em lançamentos manuais, o usuário geralmente informa o "montante" (positivo).
    // Se for manual e for conta devedora (despesa), garantimos que o sinal seja negativo.
    if (r.IS_MANUAL && (subgrp === 'DESPESAS FINANCEIRAS' || subgrp === 'DEPRECIAÇÕES')) {
      if (brl > 0) brl = -brl;
      if (usd > 0) usd = -usd;
    }

    if (SG.meses[rm]) {
      SG.meses[rm].brl += brl;
      SG.meses[rm].usd += usd;
      
      IT.meses[rm].brl += brl;
      
      G.totalMeses[rm].brl += brl;
      G.totalMeses[rm].usd += usd;

      grandTotal[rm].brl += brl;
      grandTotal[rm].usd += usd;
    }
    SG.totalAnoBrl += brl;
    SG.totalAnoUsd += usd;
    IT.totalAnoBrl += brl;
  }

  // Header
  let headHtml = `<tr>
    <th style="min-width: 250px; text-align: left;">Grupo / Subgrupo</th>
    <th>Acumulado (R$)</th>`;
  for (const m of mesesArr) {
    headHtml += `<th>${m.substring(4,6)}/${m.substring(0,4)}</th>`;
  }
  headHtml += `</tr>`;
  thead.innerHTML = headHtml;

  // Status and Action Rows
  const dataHoje = new Date();
  const currAnoMes = `${dataHoje.getFullYear()}${String(dataHoje.getMonth() + 1).padStart(2,'0')}`;
  
  const statusRowHtml = [];
  const actionRowHtml = [];
  statusRowHtml.push(`<tr style="background: rgba(0,0,0,0.2);"><td class="sticky-col" style="font-weight:bold; color:var(--text-muted);">Status</td><td></td>`);
  actionRowHtml.push(`<tr style="background: rgba(0,0,0,0.2);"><td class="sticky-col" style="font-weight:bold; color:var(--text-muted);">Ação</td><td></td>`);

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
           actionHtml = `<button class="btn btn-sm" style="background:#059669;color:#fff;font-size:11px;padding:4px 8px;border:none;border-radius:4px;cursor:pointer;" onclick="fecharMesResultado('${m}')"><i class="fa-solid fa-lock"></i> Gravar</button>`;
        } else if (m === currAnoMes) {
           statusHtml = `<span style="color:#3b82f6;"><i class="fa-solid fa-hourglass-half"></i> Em Curso</span>`;
           actionHtml = `—`;
        } else {
           statusHtml = `—`;
           actionHtml = `—`;
        }
     }
     statusRowHtml.push(`<td class="text-center">${statusHtml}</td>`);
     actionRowHtml.push(`<td class="text-center">${actionHtml}</td>`);
  }
  statusRowHtml.push(`</tr>`);
  actionRowHtml.push(`</tr>`);

  // Body
  let bodyHtml = statusRowHtml.join('') + actionRowHtml.join('');
  for (const [gName, G] of Object.entries(tree)) {
    // group header
    let gAcumBrl = 0;
    for (const m of mesesArr) gAcumBrl += G.totalMeses[m].brl;
    
    bodyHtml += `
      <tr style="background-color: #22c55e !important; color: #000 !important;">
        <td style="font-weight: 800; color: #000 !important;">
          <i class="fa-solid fa-folder-open" style="margin-right: 6px; color: #000;"></i> ${gName}
        </td>
        <td class="text-right" style="font-weight: 800; color: #000 !important;">${fmtBRL(gAcumBrl)}</td>`;
    for (const m of mesesArr) {
      bodyHtml += `<td class="text-right" style="font-weight: 800; color: #000 !important;">${fmtBRL(G.totalMeses[m].brl)}</td>`;
    }
    bodyHtml += `</tr>`;

    // subgrupos
    for (const [sgName, SG] of Object.entries(G.rows)) {
      bodyHtml += `
        <tr style="background-color: #86efac !important; color: #000 !important;">
          <td style="padding-left: 24px; font-weight: 700; color: #000 !important;">
            <i class="fa-solid fa-arrow-turn-up fa-rotate-90" style="margin-right: 6px; color: #000;"></i> ${sgName}
          </td>
          <td class="text-right" style="font-weight: 700; color: #000 !important;">${fmtBRL(SG.totalAnoBrl)}</td>`;
      for (const m of mesesArr) {
         bodyHtml += `<td class="text-right" style="font-weight: 700; color: #000 !important;">${fmtBRL(SG.meses[m].brl)}</td>`;
      }
      bodyHtml += `</tr>`;

      // items
      if (SG.items) {
        for (const [itName, IT] of Object.entries(SG.items)) {
          bodyHtml += `
            <tr style="background-color: transparent;">
              <td style="padding-left: 48px; color: var(--text-muted);">
                ${itName}
              </td>
              <td class="text-right" style="color: var(--text-muted);">${fmtBRL(IT.totalAnoBrl)}</td>`;
          for (const m of mesesArr) {
             bodyHtml += `<td class="text-right" style="color: var(--text-muted);">${fmtBRL(IT.meses[m].brl)}</td>`;
          }
          bodyHtml += `</tr>`;
    }
  }
}
  }

  // Grand Total row (Resultado Líquido)
  let grandTotalBrl = 0;
  for (const m of mesesArr) grandTotalBrl += grandTotal[m].brl;

  bodyHtml += `
    <tr style="background-color: #1e3a8a !important; color: #fff !important; border-top: 2px solid #3b82f6;">
      <td style="color: #fff !important; font-weight: 900; padding: 12px;"><strong>(=) RESULTADO LÍQUIDO</strong></td>
      <td class="text-right" style="color: #fff !important; font-weight: 900;"><strong>${fmtBRL(grandTotalBrl)}</strong></td>`;
  for (const m of mesesArr) {
    bodyHtml += `<td class="text-right" style="color: #fff !important; font-weight: 900;"><strong>${fmtBRL(grandTotal[m].brl)}</strong></td>`;
  }
  bodyHtml += `</tr>`;

  tbody.innerHTML = bodyHtml;
  state.anualTree = tree;
}

// ==========================================
// FUNÇÃO PARA FECHAR MÊS
// ==========================================
window.fecharMesResultado = async function(anoMes) {
  if (!confirm(`Deseja fechar o mês ${anoMes.substring(4,6)}/${anoMes.substring(0,4)}?`)) return;
  
  if (!state.anualTree) {
    alert("Dados não carregados. Atualize o painel primeiro.");
    return;
  }

  const payload = [];
  for (const [gName, G] of Object.entries(state.anualTree)) {
    for (const [sgName, SG] of Object.entries(G.rows)) {
      if (SG.items) {
        for (const [itName, IT] of Object.entries(SG.items)) {
          const valBrl = IT.meses[anoMes]?.brl || 0;
          const valUsd = IT.meses[anoMes]?.usd || 0;
          
          payload.push({
            empresa: 'TOTAL', // Para resultado, gravamos como TOTAL
            grupo: gName,
            subgrupo: sgName,
            item: itName,
            vlrBrl: valBrl,
            vlrUsd: valUsd,
            ptax: 1
          });
        }
      }
    }
  }

  const body = {
    ano: anoMes.substring(0,4),
    mes: parseInt(anoMes.substring(4,6), 10),
    dados: payload
  };
  
  try {
    const res = await fetch('/api/fechamento/resultado/fechar-mes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
    
    if (res.success) {
      alert('Mês fechado com sucesso!');
      loadData();
    } else {
      alert('Erro: ' + res.error);
    }
  } catch (e) {
    alert('Erro ao fechar mês: ' + e.message);
  }
};

window.toggleRow = function(rowEl) {
  const icon = rowEl.querySelector('.toggle-icon');
  let isExpanded = false;
  if (icon) {
    isExpanded = icon.classList.contains('fa-chevron-down');
    if (isExpanded) {
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-right');
    } else {
      icon.classList.remove('fa-chevron-right');
      icon.classList.add('fa-chevron-down');
    }
  }

  const hideRecursive = (el) => {
    el.style.display = 'none';
    if (el.classList.contains('row-group')) {
      const cIcon = el.querySelector('.toggle-icon');
      if (cIcon) {
        cIcon.classList.remove('fa-chevron-down');
        cIcon.classList.add('fa-chevron-right');
      }
      const cTarget = el.getAttribute('data-target');
      if (cTarget) {
        document.querySelectorAll(cTarget).forEach(hideRecursive);
      }
    }
  };

  const targetClass = rowEl.getAttribute('data-target');
  if (targetClass) {
    const children = document.querySelectorAll(targetClass);
    children.forEach(child => {
      if (isExpanded) {
        // Estamos recolhendo, esconde recursivamente todos os descendentes
        hideRecursive(child);
      } else {
        // Estamos expandindo, mostra apenas os filhos diretos
        child.style.display = 'table-row';
      }
    });
  }
};

function toggleAll(expand) {
  const rows = document.querySelectorAll('.cube-table tbody tr');
  rows.forEach(row => {
    if (row.classList.contains('level-1')) {
       // always visible
       const icon = row.querySelector('.toggle-icon');
       if (icon) {
          if (expand) {
             icon.classList.add('fa-chevron-down'); icon.classList.remove('fa-chevron-right');
          } else {
             icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-right');
          }
       }
    } else if (row.classList.contains('level-2') || row.classList.contains('level-3') || row.classList.contains('level-4')) {
       row.style.display = expand ? 'table-row' : 'none';
       if (row.classList.contains('row-group')) {
         const icon = row.querySelector('.toggle-icon');
         if (icon) {
            if (expand) {
               icon.classList.add('fa-chevron-down'); icon.classList.remove('fa-chevron-right');
            } else {
               icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-right');
            }
         }
       }
    }
  });
}

// =====================================
// MODAL AJUSTES MANUAIS
// =====================================
let allFechamentosModal = [];

window.openModalFechamento = async function() {
  const bg = document.getElementById('modal-fechamento-bg');
  if (bg) {
    bg.style.display = 'flex';
    bg.classList.add('open');
  }
  const formView = document.getElementById('edit-fechamento-form-view');
  if (formView) formView.style.display = 'none';
  const listView = document.getElementById('edit-fechamento-list-view');
  if (listView) listView.style.display = 'block';
  await loadClosedFechamentos();
};

window.closeModalFechamento = function() {
  const bg = document.getElementById('modal-fechamento-bg');
  if (bg) {
    bg.classList.remove('open');
    setTimeout(() => {
      bg.style.display = 'none';
    }, 300);
  }
  loadData(); // recarrega a tabela principal
};

window.closeFechamentoForm = function() {
  document.getElementById('edit-fechamento-form-view').style.display = 'none';
  document.getElementById('edit-fechamento-list-view').style.display = 'block';
};

async function loadClosedFechamentos() {
  try {
    const res = await fetch('/api/fechamento/ajustes/resultado');
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

  allFechamentosModal.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${String(r.FR_MES).padStart(2,'0')}/${r.FR_ANO}</td>
      <td>${r.FR_GRUPO || ''}</td>
      <td>${r.FR_SUBGRUPO || ''}</td>
      <td>${r.FR_ITEM || ''}</td>
      <td class="text-right">
        ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.FR_VALOR_BRL || 0)}
      </td>
      <td class="text-right">${Number(r.FR_PTAX || 1).toFixed(4)}</td>
      <td class="text-center">
        <button class="btn btn-sm" style="color:var(--text-color);background:rgba(255,255,255,0.1)" onclick="editFechamento('${r.FR_ID}')" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm" style="color:#ef4444;background:rgba(239,68,68,0.1)" onclick="deleteFechamento('${r.FR_ID}')" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openNewFechamentoForm = function() {
  document.getElementById('form-edit-fechamento').reset();
  document.getElementById('edit-fi-id').value = '';
  if(typeof window.updateSubgrupoOptions === 'function') {
    window.updateSubgrupoOptions();
    window.updateItemOptions();
  }
  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
};

window.editFechamento = function(id) {
  const r = allFechamentosModal.find(x => x.FR_ID == id);
  if (!r) return;

  document.getElementById('edit-fi-id').value = r.FR_ID;
  document.getElementById('edit-fi-periodo').value = `${r.FR_ANO}-${String(r.FR_MES).padStart(2,'0')}`;
  
  const grupoSel = document.getElementById('edit-fi-grupo');
  grupoSel.value = r.FR_GRUPO || '';
  if(typeof window.updateSubgrupoOptions === 'function') window.updateSubgrupoOptions();
  
  const subSel = document.getElementById('edit-fi-subgrupo');
  subSel.value = r.FR_SUBGRUPO || '';
  if(typeof window.updateItemOptions === 'function') window.updateItemOptions();
  
  document.getElementById('edit-fi-item').value = r.FR_ITEM || '';
  document.getElementById('edit-fi-custo-brl').value = r.FR_VALOR_BRL || 0;
  document.getElementById('edit-fi-ptax').value = r.FR_PTAX || 1;
  document.getElementById('edit-fi-obs').value = '';

  document.getElementById('edit-fechamento-list-view').style.display = 'none';
  document.getElementById('edit-fechamento-form-view').style.display = 'block';
};

window.saveParametrosModal = async function() {
  const periodo = document.getElementById('param-periodo').value; // YYYY-MM
  if (!periodo) {
    alert('Por favor, informe o Período (Mês/Ano).');
    return;
  }
  
  const payload = {
    ano: periodo.split('-')[0],
    mes: parseInt(periodo.split('-')[1], 10),
    val1: parseFloat(document.getElementById('param-val1').value || 0),
    val2: parseFloat(document.getElementById('param-val2').value || 0),
    val3: parseFloat(document.getElementById('param-val3').value || 0),
    val4: parseFloat(document.getElementById('param-val4').value || 0)
  };

  try {
    const res = await fetch('/api/fechamento/resultado/parametros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success) {
      document.getElementById('param-save-ok').style.display = 'inline-block';
      setTimeout(() => {
        document.getElementById('param-save-ok').style.display = 'none';
        document.getElementById('modal-params').classList.remove('open');
        document.getElementById('btn-atualizar').click(); // atualiza a grid
      }, 800);
    } else {
      alert('Erro: ' + json.error);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao salvar.');
  }
};

window.loadParametrosModal = async function() {
  const periodo = document.getElementById('param-periodo').value; // YYYY-MM
  if (!periodo) {
    alert('Por favor, informe o Período (Mês/Ano) antes de carregar.');
    return;
  }
  
  const ano = periodo.split('-')[0];
  const mes = parseInt(periodo.split('-')[1], 10);
  
  try {
    const res = await fetch('/api/fechamento/resultado/parametros');
    const json = await res.json();
    if (json.success) {
      // Procurar o parâmetro exato para aquele mês/ano
      const param = json.data.find(p => p.FR_ANO == ano && p.FR_MES == mes);
      if (param) {
        document.getElementById('param-val1').value = param.FR_VAL1 || '';
        document.getElementById('param-val2').value = param.FR_VAL2 || '';
        document.getElementById('param-val3').value = param.FR_VAL3 || '';
        document.getElementById('param-val4').value = param.FR_VAL4 || '';
        alert('Parâmetros carregados com sucesso!');
      } else {
        document.getElementById('param-val1').value = '';
        document.getElementById('param-val2').value = '';
        document.getElementById('param-val3').value = '';
        document.getElementById('param-val4').value = '';
        alert('Nenhum parâmetro salvo encontrado para este período.');
      }
    } else {
      alert('Erro ao carregar parâmetros: ' + json.error);
    }
  } catch (err) {
    console.error(err);
    alert('Erro de conexão ao carregar parâmetros.');
  }
};

window.saveFechamentoForm = async function() {
  const id = document.getElementById('edit-fi-id').value;
  const periodo = document.getElementById('edit-fi-periodo').value; // YYYY-MM
  if (!periodo) {
    alert('Informe o período.');
    return;
  }
  
  const payload = {
    ano: periodo.split('-')[0],
    mes: parseInt(periodo.split('-')[1], 10),
    filial: 'CONSOLIDADO',
    grupo: document.getElementById('edit-fi-grupo').value,
    subgrupo: document.getElementById('edit-fi-subgrupo').value,
    item: document.getElementById('edit-fi-item').value,
    valor_brl: parseFloat(document.getElementById('edit-fi-custo-brl').value || 0),
    ptax: parseFloat(document.getElementById('edit-fi-ptax').value || 1)
  };

  try {
    const url = id ? `/api/fechamento/ajustes/resultado/${id}` : '/api/fechamento/ajustes/resultado';
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
    const res = await fetch(`/api/fechamento/ajustes/resultado/${id}`, { method: 'DELETE' });
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

// =====================================
// COMBOS EM CASCATA (GRUPO -> SUBGRUPO -> ITEM)
// =====================================
// const hierarquiaCombos movido para o topo do arquivo

window.updateSubgrupoOptions = function() {
  const grupoSel = document.getElementById('edit-fi-grupo').value;
  const subgrupoSel = document.getElementById('edit-fi-subgrupo');
  const itemSel = document.getElementById('edit-fi-item');
  
  subgrupoSel.innerHTML = '<option value="">Selecione...</option>';
  itemSel.innerHTML = '<option value="">Selecione o Subgrupo primeiro...</option>';
  
  if (grupoSel && hierarquiaCombos[grupoSel]) {
    for (const sub of Object.keys(hierarquiaCombos[grupoSel])) {
      const opt = document.createElement('option');
      opt.value = sub;
      opt.text = sub;
      subgrupoSel.add(opt);
    }
  }
};

window.updateItemOptions = function() {
  const grupoSel = document.getElementById('edit-fi-grupo').value;
  const subgrupoSel = document.getElementById('edit-fi-subgrupo').value;
  const itemSel = document.getElementById('edit-fi-item');
  
  itemSel.innerHTML = '<option value="">Selecione...</option>';
  
  if (grupoSel && subgrupoSel && hierarquiaCombos[grupoSel][subgrupoSel]) {
    for (const item of hierarquiaCombos[grupoSel][subgrupoSel]) {
      const opt = document.createElement('option');
      opt.value = item;
      opt.text = item;
      itemSel.add(opt);
    }
  }
};
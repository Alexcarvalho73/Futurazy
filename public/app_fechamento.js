/**
 * app_fechamento.js — Lógica do Hub de Fechamento Financeiro
 */

const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function getSafraYear(hoje = new Date()) {
  const mes = hoje.getMonth() + 1;
  return mes >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}

function getMesesSafra(anoSafra) {
  return [
    { ano: anoSafra - 1, mes: 9  }, { ano: anoSafra - 1, mes: 10 },
    { ano: anoSafra - 1, mes: 11 }, { ano: anoSafra - 1, mes: 12 },
    { ano: anoSafra,     mes: 1  }, { ano: anoSafra,     mes: 2  },
    { ano: anoSafra,     mes: 3  }, { ano: anoSafra,     mes: 4  },
    { ano: anoSafra,     mes: 5  }, { ano: anoSafra,     mes: 6  },
    { ano: anoSafra,     mes: 7  }, { ano: anoSafra,     mes: 8  }
  ];
}

async function init() {
  const hoje     = new Date();
  const anoSafra = getSafraYear(hoje);
  const meses    = getMesesSafra(anoSafra);

  // Badge safra
  document.getElementById('txt-safra').textContent =
    `${anoSafra - 1}/${String(anoSafra).slice(2)}`;

  // Mês de referência
  document.getElementById('val-mes-ref').textContent =
    `${NOMES_MES[hoje.getMonth()]}/${hoje.getFullYear()}`;

  // Buscar fechados da API (Receitas)
  let fechadosReceita = [];
  try {
    const resp = await fetch('/api/receita/fechados');
    const json = await resp.json();
    if (json.success) fechadosReceita = json.data;
  } catch(e) {
    console.warn('Não foi possível carregar fechados Receita:', e.message);
  }

  // Conjunto de meses fechados Receita
  const fechadosSetReceita = new Set(fechadosReceita.map(f => `${f.FR_ANO}_${f.FR_MES}`));

  // Buscar fechados da API (Insumos)
  let fechadosInsumos = [];
  try {
    const resp = await fetch('/api/insumos/fechados');
    const json = await resp.json();
    if (json.success) fechadosInsumos = json.data;
  } catch(e) {
    console.warn('Não foi possível carregar fechados Insumos:', e.message);
  }

  // Conjunto de meses fechados Insumos
  const fechadosSetInsumos = new Set(fechadosInsumos.map(f => `${f.FI_ANO}_${f.FI_MES}`));

  const hoje2    = new Date();
  const mesAtual = { ano: hoje2.getFullYear(), mes: hoje2.getMonth() + 1 };
  const prevD    = new Date(hoje2.getFullYear(), hoje2.getMonth() - 1, 1);
  const mesAnt   = { ano: prevD.getFullYear(), mes: prevD.getMonth() + 1 };

  // Variáveis Globais de KPIs
  let totalFechados = 0;
  let totalPendentes = 0;

  // ==========================================
  // Renderizar Receitas
  // ==========================================
  let qtdFechadosReceita = 0, qtdPendentesReceita = 0;
  const pillsHtmlReceita = meses.map(m => {
    const isFuturo  = new Date(m.ano, m.mes - 1, 1) > hoje2;
    const isAtual   = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
    const fechado   = fechadosSetReceita.has(`${m.ano}_${m.mes}`);
    const label     = NOMES_MES[m.mes - 1];

    let cls = 'pill-futuro';
    if (fechado)        { cls = 'pill-fechado';  qtdFechadosReceita++; }
    else if (isAtual)   { cls = 'pill-atual'; }
    else if (!isFuturo) { cls = 'pill-pendente'; qtdPendentesReceita++; }

    return `<div class="mes-pill ${cls}" title="${label}/${m.ano}">${label.substring(0,3)}</div>`;
  }).join('');

  document.getElementById('pills-receitas').innerHTML = pillsHtmlReceita;
  totalFechados += qtdFechadosReceita;
  totalPendentes += qtdPendentesReceita;

  const pctReceita = Math.round((qtdFechadosReceita / 12) * 100);
  document.getElementById('bar-receitas').style.width = pctReceita + '%';
  document.getElementById('pct-receitas').textContent =
    `${qtdFechadosReceita}/12 meses (${pctReceita}%)`;

  // ==========================================
  // Renderizar Insumos
  // ==========================================
  let qtdFechadosInsumos = 0, qtdPendentesInsumos = 0;
  const pillsHtmlInsumos = meses.map(m => {
    const isFuturo  = new Date(m.ano, m.mes - 1, 1) > hoje2;
    const isAtual   = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
    const fechado   = fechadosSetInsumos.has(`${m.ano}_${m.mes}`);
    const label     = NOMES_MES[m.mes - 1];

    let cls = 'pill-futuro';
    if (fechado)        { cls = 'pill-fechado';  qtdFechadosInsumos++; }
    else if (isAtual)   { cls = 'pill-atual'; }
    else if (!isFuturo) { cls = 'pill-pendente'; qtdPendentesInsumos++; }

    return `<div class="mes-pill ${cls}" title="${label}/${m.ano}">${label.substring(0,3)}</div>`;
  }).join('');

  document.getElementById('pills-insumos').innerHTML = pillsHtmlInsumos;
  totalFechados += qtdFechadosInsumos;
  totalPendentes += qtdPendentesInsumos;

  const pctInsumos = Math.round((qtdFechadosInsumos / 12) * 100);
  document.getElementById('bar-insumos').style.width = pctInsumos + '%';
  document.getElementById('pct-insumos').textContent =
    `${qtdFechadosInsumos}/12 meses (${pctInsumos}%)`;

  // ==========================================
  // Renderizar Pecuária
  // ==========================================
  let fechadosPecuaria = [];
  try {
    const resp = await fetch('/api/pecuaria/fechados');
    const json = await resp.json();
    if (json.success) fechadosPecuaria = json.data;
  } catch(e) {
    console.warn('Não foi possível carregar fechados Pecuária:', e.message);
  }

  const fechadosSetPecuaria = new Set(fechadosPecuaria.map(f => `${f.FP_ANO}_${f.FP_MES}`));

  let qtdFechadosPecuaria = 0, qtdPendentesPecuaria = 0;
  const pillsHtmlPecuaria = meses.map(m => {
    const isFuturo  = new Date(m.ano, m.mes - 1, 1) > hoje2;
    const isAtual   = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
    const fechado   = fechadosSetPecuaria.has(`${m.ano}_${m.mes}`);
    const label     = NOMES_MES[m.mes - 1];

    let cls = 'pill-futuro';
    if (fechado)        { cls = 'pill-fechado';  qtdFechadosPecuaria++; }
    else if (isAtual)   { cls = 'pill-atual'; }
    else if (!isFuturo) { cls = 'pill-pendente'; qtdPendentesPecuaria++; }

    return `<div class="mes-pill ${cls}" title="${label}/${m.ano}">${label.substring(0,3)}</div>`;
  }).join('');

  totalFechados += qtdFechadosPecuaria;
  totalPendentes += qtdPendentesPecuaria;

  const pillsPec = document.getElementById('pills-pecuaria');
  const barPec   = document.getElementById('bar-pecuaria');
  const pctPec   = document.getElementById('pct-pecuaria');
  if (pillsPec) pillsPec.innerHTML = pillsHtmlPecuaria;
  const pctPecuaria = Math.round((qtdFechadosPecuaria / 12) * 100);
  if (barPec)  barPec.style.width = pctPecuaria + '%';
  if (pctPec)  pctPec.textContent = `${qtdFechadosPecuaria}/12 meses (${pctPecuaria}%)`;

  // ==========================================
  // Renderizar Financeiro (Custos Administrativos)
  // ==========================================
  let fechadosFinanceiro = [];
  try {
    const resp = await fetch('/api/financeiro/fechados');
    const json = await resp.json();
    if (json.success) fechadosFinanceiro = json.data;
  } catch(e) {
    console.warn('Não foi possível carregar fechados Financeiro:', e.message);
  }

  const fechadosSetFinanceiro = new Set(fechadosFinanceiro.map(f => `${f.FF_ANO}_${f.FF_MES}`));

  let qtdFechadosFinanceiro = 0, qtdPendentesFinanceiro = 0;
  const pillsHtmlFinanceiro = meses.map(m => {
    const isFuturo  = new Date(m.ano, m.mes - 1, 1) > hoje2;
    const isAtual   = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
    const fechado   = fechadosSetFinanceiro.has(`${m.ano}_${m.mes}`);
    const label     = NOMES_MES[m.mes - 1];

    let cls = 'pill-futuro';
    if (fechado)        { cls = 'pill-fechado';  qtdFechadosFinanceiro++; }
    else if (isAtual)   { cls = 'pill-atual'; }
    else if (!isFuturo) { cls = 'pill-pendente'; qtdPendentesFinanceiro++; }

    return `<div class="mes-pill ${cls}" title="${label}/${m.ano}">${label.substring(0,3)}</div>`;
  }).join('');

  totalFechados += qtdFechadosFinanceiro;
  totalPendentes += qtdPendentesFinanceiro;

  const pillsFin = document.getElementById('pills-financeiro');
  const barFin   = document.getElementById('bar-financeiro');
  const pctFin   = document.getElementById('pct-financeiro');
  if (pillsFin) pillsFin.innerHTML = pillsHtmlFinanceiro;
  const pctFinanceiro = Math.round((qtdFechadosFinanceiro / 12) * 100);
  if (barFin)  barFin.style.width = pctFinanceiro + '%';
  if (pctFin)  pctFin.textContent = `${qtdFechadosFinanceiro}/12 meses (${pctFinanceiro}%)`;

  // Atualizar KPIs Globais
  if (document.getElementById('val-fechados')) {
    document.getElementById('val-fechados').textContent = totalFechados;
  }
  if (document.getElementById('val-pendentes')) {
    document.getElementById('val-pendentes').textContent = totalPendentes;
  }
}

// =====================================
// DRE CONSOLIDADO E PROJEÇÃO
// =====================================

let dreProjecao = {};

function formatMoedaDRE(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val || 0);
}
function formatPctDRE(val) {
  return (val || 0).toFixed(0) + '%';
}

async function loadProjecaoLista() {
  const safra = new URLSearchParams(window.location.search).get('safra') || '2526';
  try {
    const res = await fetch('/api/projecao?safra=' + safra);
    const json = await res.json();
    if (json.success) {
      dreProjecao = {};
      json.data.forEach(p => dreProjecao[p.PD_RUBRICA] = Number(p.PD_VALOR));
      renderProjecaoLista(json.data);
    }
  } catch(e) {
    console.error(e);
  }
}

function renderProjecaoLista(lista) {
  const tbody = document.getElementById('proj-lista-body');
  if(!tbody) return;
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhuma projeção configurada.</td></tr>';
    return;
  }
  let html = '';
  lista.forEach(p => {
    html += `
      <tr>
        <td style="padding:6px; border-bottom:1px solid rgba(255,255,255,0.05);">${p.PD_RUBRICA}</td>
        <td style="padding:6px; text-align:right; border-bottom:1px solid rgba(255,255,255,0.05);">${formatMoedaDRE(p.PD_VALOR)}</td>
        <td style="padding:6px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.05);">
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; margin-right:5px;" onclick="editarProjecao('${p.PD_RUBRICA}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px; color:#ef4444;" onclick="excluirProjecao('${p.PD_RUBRICA}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function editarProjecao(rubrica) {
  document.getElementById('proj-rubrica').value = rubrica;
  document.getElementById('proj-valor').value = dreProjecao[rubrica] || 0;
  document.getElementById('proj-valor').focus();
}

async function excluirProjecao(rubrica) {
  if (!confirm(`Tem certeza que deseja excluir a projeção para ${rubrica}?`)) return;
  const safra = new URLSearchParams(window.location.search).get('safra') || '2526';
  try {
    const res = await fetch('/api/projecao/deletar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safra, rubrica })
    });
    const json = await res.json();
    if(json.success) {
      delete dreProjecao[rubrica];
      await loadProjecaoLista();
      loadDRE(); // refresh DRE main screen if loaded
    } else {
      alert('Erro: ' + json.error);
    }
  } catch(e) {
    console.error(e);
  }
}

async function abrirProjecao() {
  const labelSafra = document.getElementById('proj-safra-label');
  if(labelSafra) {
    const txtSafra = document.getElementById('txt-safra');
    labelSafra.textContent = txtSafra ? txtSafra.textContent : (new URLSearchParams(window.location.search).get('safra') || '2526');
  }
  
  document.getElementById('modal-projecao').classList.remove('hidden');
  
  // Limpar form
  const rub = document.getElementById('proj-rubrica').value;
  document.getElementById('proj-valor').value = dreProjecao[rub] || 0;
  
  // Carregar lista completa
  await loadProjecaoLista();
}

function fecharProjecao() {
  document.getElementById('modal-projecao').classList.add('hidden');
}

document.getElementById('proj-rubrica')?.addEventListener('change', (e) => {
  document.getElementById('proj-valor').value = dreProjecao[e.target.value] || 0;
});

async function salvarProjecao() {
  const safra = new URLSearchParams(window.location.search).get('safra') || '2526';
  const rubrica = document.getElementById('proj-rubrica').value;
  const valor = document.getElementById('proj-valor').value;
  try {
    const res = await fetch('/api/projecao/salvar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safra, rubrica, valor })
    });
    const json = await res.json();
    if(json.success) {
      dreProjecao[rubrica] = Number(valor);
      document.getElementById('proj-valor').value = 0;
      await loadProjecaoLista(); // atualiza a grid interna
      loadDRE(); // atualiza a DRE de trás
    } else {
      alert('Erro: ' + json.error);
    }
  } catch(e) {
    console.error(e);
  }
}

async function loadDRE() {
  const safra = new URLSearchParams(window.location.search).get('safra') || '2526';
  const tbody = document.getElementById('dre-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Carregando DRE...</td></tr>';
  
  try {
    const resP = await fetch('/api/projecao?safra=' + safra);
    const jsonP = await resP.json();
    dreProjecao = {};
    if(jsonP.success) {
      jsonP.data.forEach(p => { dreProjecao[p.PD_RUBRICA] = Number(p.PD_VALOR); });
    }

    const resD = await fetch('/api/dre/consolidado');
    const jsonD = await resD.json();
    if(!jsonD.success) return alert('Erro ao carregar DRE');
    
    renderDRE(jsonD.data);
    
  } catch(e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:red;">Erro ao processar DRE.</td></tr>';
  }
}

function renderDRE(data) {
  const thead = document.getElementById('dre-header');
  const tbody = document.getElementById('dre-body');
  
  // 1. Descobrir todos os meses/anos únicos
  const mesesSet = new Set();
  
  (data.receitas || []).forEach(r => { if(r.FR_ANO && r.FR_MES) mesesSet.add(`${r.FR_ANO}-${String(r.FR_MES).padStart(2,'0')}`); });
  (data.insumos || []).forEach(r => { if(r.FI_ANO && r.FI_MES) mesesSet.add(`${r.FI_ANO}-${String(r.FI_MES).padStart(2,'0')}`); });
  (data.pecuaria || []).forEach(r => { if(r.FP_ANO && r.FP_MES) mesesSet.add(`${r.FP_ANO}-${String(r.FP_MES).padStart(2,'0')}`); });
  (data.financeiro || []).forEach(r => { if(r.FF_ANO && r.FF_MES) mesesSet.add(`${r.FF_ANO}-${String(r.FF_MES).padStart(2,'0')}`); });
  
  const mesesArr = Array.from(mesesSet).sort(); // ex: ['2025-07', '2025-08']

  // 2. Refazer o cabeçalho
  let thHtml = `<tr><th style="text-align:left;">Rubrica</th>`;
  mesesArr.forEach(m => {
    const partes = m.split('-'); // 2025, 07
    thHtml += `<th style="text-align:right;">${partes[1]}/${partes[0]}</th>`;
  });
  thHtml += `<th style="text-align:right;">PROJETADO</th>`;
  thHtml += `<th style="text-align:right;">ACUMULADO</th>`;
  thHtml += `<th style="text-align:center;">% Realizado</th></tr>`;
  thead.innerHTML = thHtml;

  // 3. Dicionário de Acumulados (Total e por Mês)
  const ACUM = {}; // ACUM['1. Adubação'] = total
  const ACUM_MES = {}; // ACUM_MES['1. Adubação']['2025-07'] = valor

  const sumData = (list, keyFn, valFn, anoFn, mesFn) => {
    list.forEach(r => {
      const k = keyFn(r);
      const v = valFn(r);
      const ano = anoFn(r);
      const mes = mesFn(r);
      
      ACUM[k] = (ACUM[k] || 0) + v;
      
      if (ano && mes) {
        const mesKey = `${ano}-${String(mes).padStart(2,'0')}`;
        if (!ACUM_MES[k]) ACUM_MES[k] = {};
        ACUM_MES[k][mesKey] = (ACUM_MES[k][mesKey] || 0) + v;
      }
    });
  };

  // Receitas
  sumData(data.receitas || [], () => '1. Vendas a Clientes', r => r.VALOR_CLI, r => r.FR_ANO, r => r.FR_MES);
  sumData(data.receitas || [], () => '2. Vendas Intercompany', r => r.VALOR_INT, r => r.FR_ANO, r => r.FR_MES);
  sumData(data.receitas || [], () => '3. Deduções sobre as vendas', r => r.VALOR_DED, r => r.FR_ANO, r => r.FR_MES);
  
  // Insumos
  sumData(data.insumos || [], r => {
    const t = (r.FI_TIPO_INSUMO || '').toUpperCase();
    if (t.includes('FERTILIZANTE') || t.includes('ADUBA')) return '1. Adubação';
    if (t.includes('CORRETIVO') || t.includes('CALAGEM')) return '2. Calagem';
    if (t.includes('DEFENSIVO')) return '3. Defensivos';
    if (t.includes('SEMENTE')) return '4. Sementes';
    return '5. CAV/CMV';
  }, r => r.VALOR, r => r.FI_ANO, r => r.FI_MES);
  
  // Pecuária (CAV/CMV)
  sumData(data.pecuaria || [], () => '5. CAV/CMV', r => r.VALOR, r => r.FP_ANO, r => r.FP_MES);

  // Financeiro
  sumData(data.financeiro || [], r => {
    if (r.FF_TIPO_RATEIO === 'Rateio Geral') return '1. Administrativo (Rateio)';
    const g = (r.FF_CC_GRUPO || '').toUpperCase();
    if (g.includes('MÃO-DE-OBRA') || g.includes('MÃO DE OBRA') || g.includes('MAO DE OBRA')) return '1. Custo Mão-de-Obra';
    if (g.includes('DIA-A-DIA') || g.includes('DIA A DIA')) return '2. Dia-a-dia';
    if (g.includes('MANUTENÇ') || g.includes('MANUTENC')) return '3. Manutenções';
    if (g.includes('COMBUSTÍVE') || g.includes('COMBUSTIVE')) return '4. Combustíveis';
    if (g.includes('LOGÍSTICA') || g.includes('LOGISTICA')) return '5. Logística Compartilhada';
    if (g.includes('ARRENDAMENTO')) return '6. Arrendamentos';
    return '7. Outros';
  }, r => r.VALOR, r => r.FF_ANO, r => r.FF_MES);

  const getA = (k) => ACUM[k] || 0;
  const getP = (k) => dreProjecao[k] || 0;
  const getM = (k, mesKey) => ACUM_MES[k] ? (ACUM_MES[k][mesKey] || 0) : 0;
  
  // Helpers para as linhas de totais
  const mTotal = (keys, mesKey) => {
    return keys.reduce((acc, k) => acc + getM(k, mesKey), 0);
  };
  const mDedTotal = (keys, mesKey) => {
    return keys.reduce((acc, k) => acc - Math.abs(getM(k, mesKey)), 0);
  };

  const recKeys = ['1. Vendas a Clientes', '2. Vendas Intercompany'];
  const dedKeys = ['3. Deduções sobre as vendas'];
  
  const recLiq = getA('1. Vendas a Clientes') + getA('2. Vendas Intercompany') - Math.abs(getA('3. Deduções sobre as vendas'));
  const recLiqP = getP('1. Vendas a Clientes') + getP('2. Vendas Intercompany') - Math.abs(getP('3. Deduções sobre as vendas'));

  const cDirKeys = ['1. Adubação', '2. Calagem', '3. Defensivos', '4. Sementes', '5. CAV/CMV'];
  const custoDir = cDirKeys.reduce((acc, k) => acc + getA(k), 0);
  const custoDirP = cDirKeys.reduce((acc, k) => acc + getP(k), 0);

  const resBruto = recLiq - custoDir;
  const resBrutoP = recLiqP - custoDirP;

  const cIndKeys = ['1. Custo Mão-de-Obra', '2. Dia-a-dia', '3. Manutenções', '4. Combustíveis', '5. Logística Compartilhada', '6. Arrendamentos', '7. Outros'];
  const custoInd = cIndKeys.reduce((acc, k) => acc + getA(k), 0);
  const custoIndP = cIndKeys.reduce((acc, k) => acc + getP(k), 0);

  const despAdm = getA('1. Administrativo (Rateio)');
  const despAdmP = getP('1. Administrativo (Rateio)');

  const totInd = custoInd + despAdm;
  const totIndP = custoIndP + despAdmP;

  const ebitda = resBruto - totInd;
  const ebitdaP = resBrutoP - totIndP;

  const pct = (a, p) => p === 0 ? '-' : formatPctDRE((a/p)*100);

  // Quantidade de colunas extras no colspan
  const numColspan = mesesArr.length + 4; 

  const buildRow = (label, k, isBold, bgColor) => {
    let tr = `<tr style="background:${bgColor || 'transparent'}; font-weight:${isBold?'bold':'normal'};">`;
    tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05);">${label}</td>`;
    
    mesesArr.forEach(m => {
      tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); text-align:right;">${formatMoedaDRE(getM(k, m))}</td>`;
    });
    
    tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); text-align:right;">${formatMoedaDRE(getP(k))}</td>`;
    tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); text-align:right;">${formatMoedaDRE(getA(k))}</td>`;
    tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); text-align:center;">${pct(getA(k), getP(k))}</td>`;
    tr += `</tr>`;
    return tr;
  };

  const buildTot = (label, a, p, marginA, marginP, bgColor, isDark, calcMesFn) => {
    let tr = `<tr style="background:${bgColor || '#10b981'}; color:${isDark?'#fff':'#1e293b'}; font-weight:bold;">`;
    tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); display:flex; justify-content:space-between;">
             <span>${label}</span>
             ${marginA !== null ? `<span style="opacity:0.8; font-size:12px;">Mg. Projetada: ${marginP}% | Mg. Realizada: ${marginA}%</span>` : ''}
           </td>`;
    
    mesesArr.forEach(m => {
      tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); text-align:right;">${formatMoedaDRE(calcMesFn(m))}</td>`;
    });

    tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); text-align:right;">${formatMoedaDRE(p)}</td>`;
    tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); text-align:right;">${formatMoedaDRE(a)}</td>`;
    tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); text-align:center;">${pct(a, p)}</td>`;
    tr += `</tr>`;
    return tr;
  };

  const mLiqA = recLiq === 0 ? 0 : ((resBruto / recLiq)*100).toFixed(0);
  const mLiqP = recLiqP === 0 ? 0 : ((resBrutoP / recLiqP)*100).toFixed(0);
  
  const mEbA = recLiq === 0 ? 0 : ((ebitda / recLiq)*100).toFixed(0);
  const mEbP = recLiqP === 0 ? 0 : ((ebitdaP / recLiqP)*100).toFixed(0);

  let html = '';
  // Receitas
  html += `<tr><td colspan="${numColspan}" style="background:#86efac; color:#166534; font-weight:bold; padding:4px 12px;">Receitas</td></tr>`;
  html += buildRow('1. Vendas a Clientes', '1. Vendas a Clientes');
  html += buildRow('2. Vendas Intercompany', '2. Vendas Intercompany');
  html += buildRow('3. Deduções sobre as vendas', '3. Deduções sobre as vendas');
  html += buildTot('(=) RECEITA LÍQUIDA', recLiq, recLiqP, null, null, '#22c55e', true, (m) => mTotal(recKeys, m) + mDedTotal(dedKeys, m));

  // Custo Direto
  html += `<tr><td colspan="${numColspan}" style="background:#bbf7d0; color:#166534; font-weight:bold; padding:4px 12px;">Custeio Operacional Direto</td></tr>`;
  html += buildRow('1. Adubação', '1. Adubação');
  html += buildRow('2. Calagem', '2. Calagem');
  html += buildRow('3. Defensivos', '3. Defensivos');
  html += buildRow('4. Sementes', '4. Sementes');
  html += buildRow('5. CAV/CMV', '5. CAV/CMV');
  html += buildTot('(-) Custeio Direto', custoDir, custoDirP, null, null, '#22c55e', true, (m) => mTotal(cDirKeys, m));
  html += buildTot('(=) RESULTADO BRUTO', resBruto, resBrutoP, mLiqA, mLiqP, '#cbd5e1', false, (m) => (mTotal(recKeys, m) + mDedTotal(dedKeys, m)) - mTotal(cDirKeys, m));

  // Custo Indireto
  html += `<tr><td colspan="${numColspan}" style="background:#bbf7d0; color:#166534; font-weight:bold; padding:4px 12px;">Despesas Operacionais Indiretas</td></tr>`;
  html += buildRow('1. Custo Mão-de-Obra', '1. Custo Mão-de-Obra');
  html += buildRow('2. Dia-a-dia', '2. Dia-a-dia');
  html += buildRow('3. Manutenções', '3. Manutenções');
  html += buildRow('4. Combustíveis', '4. Combustíveis');
  html += buildRow('5. Logística Compartilhada', '5. Logística Compartilhada');
  html += buildRow('6. Arrendamentos', '6. Arrendamentos');
  html += buildRow('7. Outros', '7. Outros');

  // Despesas Administrativas Rateadas
  html += `<tr><td colspan="${numColspan}" style="background:#bbf7d0; color:#166534; font-weight:bold; padding:4px 12px;">Despesas Administrativas Rateadas</td></tr>`;
  html += buildRow('1. Administrativo (Rateio)', '1. Administrativo (Rateio)');
  html += buildTot('TOTAL DAS DESPESAS INDIRETAS E DE RATEIO', totInd, totIndP, null, null, 'rgba(255,255,255,0.1)', true, (m) => mTotal(cIndKeys, m) + getM('1. Administrativo (Rateio)', m));

  // EBITDA
  html += buildTot('(=) EBITDA (R$)', ebitda, ebitdaP, mEbA, mEbP, '#10b981', true, (m) => {
    const rL = (mTotal(recKeys, m) + mDedTotal(dedKeys, m));
    const rB = rL - mTotal(cDirKeys, m);
    const totI = mTotal(cIndKeys, m) + getM('1. Administrativo (Rateio)', m);
    return rB - totI;
  });

  tbody.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', init);

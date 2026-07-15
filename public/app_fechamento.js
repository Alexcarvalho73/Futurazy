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

let dreDataCache = null;

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
    
    dreDataCache = jsonD.data;
    renderDRE();
    
  } catch(e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:red;">Erro ao processar DRE.</td></tr>';
  }
}

function renderDRE(data = dreDataCache) {
  if (!data) return;
  const thead = document.getElementById('dre-table').querySelector('thead');
  const tbody = document.getElementById('dre-body');
  
  const chkFilial = document.getElementById('toggle-filial') && document.getElementById('toggle-filial').checked;
  const chkNegocio = document.getElementById('toggle-negocio') && document.getElementById('toggle-negocio').checked;

  const ACUM = {};
  const ACUM_COL = {}; 
  
  const mesesSet = new Set();
  const filiaisMap = {}; 
  const negociosMap = {}; 

  const sumData = (list, keyFn, valFn, anoFn, mesFn, filFn, negFn) => {
    (list || []).forEach(r => {
      const k = keyFn(r);
      const v = valFn(r);
      const ano = anoFn(r);
      const mes = mesFn(r);
      const filial = filFn(r) || 'ND';
      
      let rawNeg = (negFn(r) || 'Outros').toString().trim();
      let upperNeg = rawNeg.toUpperCase();
      let negocio = rawNeg;
      if (upperNeg === 'AGRICULTURA') negocio = 'Agricultura';
      else if (upperNeg === 'PECUARIA' || upperNeg === 'PECUÁRIA') negocio = 'Pecuária';
      
      ACUM[k] = (ACUM[k] || 0) + v;
      if (!ACUM_COL[k]) ACUM_COL[k] = {};
      
      const fKey = chkFilial ? filial : 'ALL';
      const nKey = chkNegocio ? negocio : 'ALL';
      
      if (ano && mes) {
        const mesKey = `${ano}-${String(mes).padStart(2,'0')}`;
        mesesSet.add(mesKey);
        
        if (!filiaisMap[mesKey]) filiaisMap[mesKey] = new Set();
        filiaisMap[mesKey].add(fKey);
        
        const fnKey = `${mesKey}|${fKey}`;
        if (!negociosMap[fnKey]) negociosMap[fnKey] = new Set();
        negociosMap[fnKey].add(nKey);
        
        const colKey = `${mesKey}|${fKey}|${nKey}`;
        ACUM_COL[k][colKey] = (ACUM_COL[k][colKey] || 0) + v;
        
        const totalColKey = `${mesKey}|TOTAL|TOTAL`;
        ACUM_COL[k][totalColKey] = (ACUM_COL[k][totalColKey] || 0) + v;
      }
      
      if (!filiaisMap['Acumulado']) filiaisMap['Acumulado'] = new Set();
      filiaisMap['Acumulado'].add(fKey);
      
      const fnAcumKey = `Acumulado|${fKey}`;
      if (!negociosMap[fnAcumKey]) negociosMap[fnAcumKey] = new Set();
      negociosMap[fnAcumKey].add(nKey);
      
      const acumColKey = `Acumulado|${fKey}|${nKey}`;
      ACUM_COL[k][acumColKey] = (ACUM_COL[k][acumColKey] || 0) + v;
      
      const acumTotalColKey = `Acumulado|TOTAL|TOTAL`;
      ACUM_COL[k][acumTotalColKey] = (ACUM_COL[k][acumTotalColKey] || 0) + v;
    });
  };

  sumData(data.receitas, () => '1. Vendas a Clientes', r => r.VALOR_CLI, r => r.FR_ANO, r => r.FR_MES, r => r.FR_EMPRESA, r => r.FR_NEGOCIO);
  sumData(data.receitas, () => '2. Vendas Intercompany', r => r.VALOR_INT, r => r.FR_ANO, r => r.FR_MES, r => r.FR_EMPRESA, r => r.FR_NEGOCIO);
  sumData(data.receitas, () => '3. Deduções sobre as vendas', r => r.VALOR_DED, r => r.FR_ANO, r => r.FR_MES, r => r.FR_EMPRESA, r => r.FR_NEGOCIO);
  
  sumData(data.insumos, r => {
    const t = (r.FI_TIPO_INSUMO || '').toUpperCase();
    if (t.includes('FERTILIZANTE') || t.includes('ADUBA')) return '1. Adubação';
    if (t.includes('CORRETIVO') || t.includes('CALAGEM')) return '2. Calagem';
    if (t.includes('DEFENSIVO')) return '3. Defensivos';
    if (t.includes('SEMENTE')) return '4. Sementes';
    return '5. CAV/CMV';
  }, r => r.VALOR, r => r.FI_ANO, r => r.FI_MES, r => r.FI_EMPRESA, r => r.FI_NEGOCIO);
  
  sumData(data.pecuaria, () => '5. CAV/CMV', r => r.VALOR, r => r.FP_ANO, r => r.FP_MES, r => r.FP_EMPRESA, r => r.FP_NEGOCIO);

  sumData(data.financeiro, r => {
    if (r.FF_TIPO_RATEIO === 'Rateio Geral') return '1. Administrativo (Rateio)';
    const g = (r.FF_CC_GRUPO || '').toUpperCase();
    if (g.includes('MÃO-DE-OBRA') || g.includes('MÃO DE OBRA') || g.includes('MAO DE OBRA')) return '1. Custo Mão-de-Obra';
    if (g.includes('DIA-A-DIA') || g.includes('DIA A DIA')) return '2. Dia-a-dia';
    if (g.includes('MANUTENÇ') || g.includes('MANUTENC')) return '3. Manutenções';
    if (g.includes('COMBUSTÍVE') || g.includes('COMBUSTIVE')) return '4. Combustíveis';
    if (g.includes('LOGÍSTICA') || g.includes('LOGISTICA')) return '5. Logística Compartilhada';
    if (g.includes('ARRENDAMENTO')) return '6. Arrendamentos';
    return '7. Outros';
  }, r => r.VALOR, r => r.FF_ANO, r => r.FF_MES, r => r.FF_EMPRESA, r => r.FF_NEGOCIO);

  const getP = (k) => dreProjecao[k] || 0;
  const getC = (k, colKey) => ACUM_COL[k] ? (ACUM_COL[k][colKey] || 0) : 0;
  
  const mTotal = (keys, colKey) => keys.reduce((acc, k) => acc + getC(k, colKey), 0);
  const mDedTotal = (keys, colKey) => keys.reduce((acc, k) => acc - Math.abs(getC(k, colKey)), 0);

  const periodos = [...Array.from(mesesSet).sort(), 'Acumulado'];
  const finalCols = [];
  
  const numRows = (chkFilial && chkNegocio) ? 3 : ((chkFilial || chkNegocio) ? 2 : 1);
  let tr1 = `<tr><th style="text-align:left; border-right:1px solid rgba(255,255,255,0.1); background:#0f172a; padding:10px 12px;" rowspan="${numRows}">Rubrica</th>`;
  let tr2 = '<tr>';
  let tr3 = '<tr>';
  
  periodos.forEach(p => {
    const fSet = Array.from(filiaisMap[p] || []).sort();
    let colSpanP = 0;
    
    fSet.forEach(f => {
      const nSet = Array.from(negociosMap[`${p}|${f}`] || []).sort();
      let colSpanF = nSet.length;
      colSpanP += colSpanF;
      
      if (chkFilial) {
         tr2 += `<th colspan="${colSpanF}" style="text-align:center; color:#e2e8f0; border-left:1px solid rgba(255,255,255,0.1); background:#172033; padding:6px;">${f === 'ALL' ? '' : f}</th>`;
      }
      
      nSet.forEach(n => {
         if (chkNegocio && chkFilial) {
            tr3 += `<th style="text-align:right; color:#cbd5e1; border-left:1px solid rgba(255,255,255,0.05); background:#1e293b; padding:6px;">${n === 'ALL' ? '' : n}</th>`;
         } else if (chkNegocio && !chkFilial) {
            tr2 += `<th style="text-align:right; color:#cbd5e1; border-left:1px solid rgba(255,255,255,0.05); background:#172033; padding:6px;">${n === 'ALL' ? '' : n}</th>`;
         }
         finalCols.push(`${p}|${f}|${n}`);
      });
    });
    
    if (chkFilial || chkNegocio) {
       colSpanP += 1;
       finalCols.push(`${p}|TOTAL|TOTAL`);
       if (chkFilial && chkNegocio) {
          tr2 += `<th rowspan="2" style="text-align:center; vertical-align:middle; border-left:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; font-weight:bold; padding:6px;">Total</th>`;
       } else {
          tr2 += `<th style="text-align:center; border-left:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; font-weight:bold; padding:6px;">Total</th>`;
       }
    }
    
    let pLabel = p;
    if (p !== 'Acumulado') {
       const partes = p.split('-');
       pLabel = `${partes[1]}/${partes[0]}`;
    }
    tr1 += `<th colspan="${colSpanP}" style="text-align:center; border-left:1px solid rgba(255,255,255,0.2); background:#0f172a; padding:10px 6px;">${pLabel}</th>`;
  });
  
  tr1 += `<th rowspan="${numRows}" style="text-align:right; border-left:1px solid rgba(255,255,255,0.2); background:#0f172a; padding:10px 12px;">PROJETADO</th>`;
  tr1 += `<th rowspan="${numRows}" style="text-align:center; border-left:1px solid rgba(255,255,255,0.2); background:#0f172a; padding:10px 12px;">% Realizado</th></tr>`;
  tr2 += '</tr>';
  tr3 += '</tr>';

  let theadHtml = tr1;
  if (chkFilial) theadHtml += tr2;
  else if (chkNegocio) theadHtml += tr2;
  if (chkFilial && chkNegocio) theadHtml += tr3;
  
  thead.innerHTML = theadHtml;

  const numColspan = finalCols.length + 3;

  const pct = (a, p) => p === 0 ? '-' : formatPctDRE((a/p)*100);

  const buildRow = (label, k, isBold, bgColor) => {
    let tr = `<tr style="background:${bgColor || '#1e293b'}; font-weight:${isBold?'bold':'normal'}; transition: background 0.2s;">`;
    tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); border-right:1px solid rgba(255,255,255,0.1);">${label}</td>`;
    
    const globalAcumKey = 'Acumulado|TOTAL|TOTAL';
    const globalAcum = getC(k, globalAcumKey);
    
    finalCols.forEach(colKey => {
      const v = getC(k, colKey);
      const isTotal = colKey.includes('|TOTAL|TOTAL');
      const bg = isTotal ? 'background:rgba(255,255,255,0.03);' : '';
      const weight = isTotal ? 'font-weight:bold;' : '';
      tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); border-left:1px solid rgba(255,255,255,0.1); text-align:right; ${bg} ${weight}">${formatMoedaDRE(v)}</td>`;
    });
    
    const p = getP(k);
    tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); border-left:1px solid rgba(255,255,255,0.1); text-align:right;">${formatMoedaDRE(p)}</td>`;
    tr += `<td style="padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05); border-left:1px solid rgba(255,255,255,0.1); text-align:center;">${pct(globalAcum, p)}</td>`;
    tr += `</tr>`;
    return tr;
  };

  const buildTot = (label, keysOrFn, calcProjFn, isDark, bgColor) => {
    let tr = `<tr style="background:${bgColor || '#10b981'}; color:${isDark?'#fff':'#1e293b'}; font-weight:bold;">`;
    tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); border-right:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between;">
             <span>${label}</span>
           </td>`;
    
    const globalAcumKey = 'Acumulado|TOTAL|TOTAL';
    let globalAcum = 0;
    if (typeof keysOrFn === 'function') {
      globalAcum = keysOrFn(globalAcumKey);
    } else {
      globalAcum = mTotal(keysOrFn, globalAcumKey);
    }
    
    finalCols.forEach(colKey => {
      let v = 0;
      if (typeof keysOrFn === 'function') {
        v = keysOrFn(colKey);
      } else {
        v = mTotal(keysOrFn, colKey);
      }
      const isTotal = colKey.includes('|TOTAL|TOTAL');
      const bg = isTotal ? 'background:rgba(255,255,255,0.15);' : '';
      tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); border-left:1px solid rgba(255,255,255,0.2); text-align:right; ${bg}">${formatMoedaDRE(v)}</td>`;
    });

    const p = calcProjFn();
    tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); border-left:1px solid rgba(255,255,255,0.2); text-align:right;">${formatMoedaDRE(p)}</td>`;
    tr += `<td style="padding:8px 12px; border-bottom:2px solid rgba(0,0,0,0.1); border-left:1px solid rgba(255,255,255,0.2); text-align:center;">${pct(globalAcum, p)}</td>`;
    tr += `</tr>`;
    return tr;
  };

  const recKeys = ['1. Vendas a Clientes', '2. Vendas Intercompany'];
  const dedKeys = ['3. Deduções sobre as vendas'];
  const cDirKeys = ['1. Adubação', '2. Calagem', '3. Defensivos', '4. Sementes', '5. CAV/CMV'];
  const cIndKeys = ['1. Custo Mão-de-Obra', '2. Dia-a-dia', '3. Manutenções', '4. Combustíveis', '5. Logística Compartilhada', '6. Arrendamentos', '7. Outros'];

  const getGlobalProj = (k) => getP(k);
  const mTotalProj = (keys) => keys.reduce((acc, k) => acc + getGlobalProj(k), 0);

  const calcReceitaLiqP = () => mTotalProj(recKeys) - Math.abs(mTotalProj(dedKeys));
  const calcResBrutoP = () => calcReceitaLiqP() - mTotalProj(cDirKeys);
  const calcEbitdaP = () => calcResBrutoP() - (mTotalProj(cIndKeys) + getGlobalProj('1. Administrativo (Rateio)'));

  let html = '';
  // Receitas
  html += `<tr><td colspan="${numColspan}" style="background:#86efac; color:#166534; font-weight:bold; padding:4px 12px;">Receitas</td></tr>`;
  html += buildRow('1. Vendas a Clientes', '1. Vendas a Clientes');
  html += buildRow('2. Vendas Intercompany', '2. Vendas Intercompany');
  html += buildRow('3. Deduções sobre as vendas', '3. Deduções sobre as vendas');
  html += buildTot('(=) RECEITA LÍQUIDA', colKey => mTotal(recKeys, colKey) + mDedTotal(dedKeys, colKey), calcReceitaLiqP, true, '#22c55e');

  // Custo Direto
  html += `<tr><td colspan="${numColspan}" style="background:#bbf7d0; color:#166534; font-weight:bold; padding:4px 12px;">Custeio Operacional Direto</td></tr>`;
  html += buildRow('1. Adubação', '1. Adubação');
  html += buildRow('2. Calagem', '2. Calagem');
  html += buildRow('3. Defensivos', '3. Defensivos');
  html += buildRow('4. Sementes', '4. Sementes');
  html += buildRow('5. CAV/CMV', '5. CAV/CMV');
  html += buildTot('(-) Custeio Direto', cDirKeys, () => mTotalProj(cDirKeys), true, '#22c55e');
  html += buildTot('(=) RESULTADO BRUTO', colKey => (mTotal(recKeys, colKey) + mDedTotal(dedKeys, colKey)) - mTotal(cDirKeys, colKey), calcResBrutoP, false, '#cbd5e1');

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
  html += buildTot('TOTAL DAS DESPESAS INDIRETAS E DE RATEIO', colKey => mTotal(cIndKeys, colKey) + getC('1. Administrativo (Rateio)', colKey), () => mTotalProj(cIndKeys) + getGlobalProj('1. Administrativo (Rateio)'), true, 'rgba(255,255,255,0.1)');

  // EBITDA
  html += buildTot('(=) EBITDA (R$)', colKey => {
    const rL = mTotal(recKeys, colKey) + mDedTotal(dedKeys, colKey);
    const rB = rL - mTotal(cDirKeys, colKey);
    const totI = mTotal(cIndKeys, colKey) + getC('1. Administrativo (Rateio)', colKey);
    return rB - totI;
  }, calcEbitdaP, true, '#10b981');

  tbody.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', init);

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
  document.getElementById('val-fechados').textContent  = qtdFechadosReceita;
  document.getElementById('val-pendentes').textContent = qtdPendentesReceita;

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

  let qtdFechadosPecuaria = 0;
  const pillsHtmlPecuaria = meses.map(m => {
    const isFuturo  = new Date(m.ano, m.mes - 1, 1) > hoje2;
    const isAtual   = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
    const fechado   = fechadosSetPecuaria.has(`${m.ano}_${m.mes}`);
    const label     = NOMES_MES[m.mes - 1];

    let cls = 'pill-futuro';
    if (fechado)        { cls = 'pill-fechado';  qtdFechadosPecuaria++; }
    else if (isAtual)   { cls = 'pill-atual'; }
    else if (!isFuturo) { cls = 'pill-pendente'; }

    return `<div class="mes-pill ${cls}" title="${label}/${m.ano}" style="background:${cls==='pill-fechado'?'rgba(245,158,11,.2)':''};color:${cls==='pill-fechado'?'#f59e0b':''}">${label.substring(0,3)}</div>`;
  }).join('');

  const pillsPec = document.getElementById('pills-pecuaria');
  const barPec   = document.getElementById('bar-pecuaria');
  const pctPec   = document.getElementById('pct-pecuaria');
  if (pillsPec) pillsPec.innerHTML = pillsHtmlPecuaria;
  const pctPecuaria = Math.round((qtdFechadosPecuaria / 12) * 100);
  if (barPec)  barPec.style.width = pctPecuaria + '%';
  if (pctPec)  pctPec.textContent = `${qtdFechadosPecuaria}/12 meses (${pctPecuaria}%)`;
}

document.addEventListener('DOMContentLoaded', init);

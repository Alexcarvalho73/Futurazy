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

  // Buscar fechados da API
  let fechados = [];
  try {
    const resp = await fetch('/api/receita/fechados');
    const json = await resp.json();
    if (json.success) fechados = json.data;
  } catch(e) {
    console.warn('Não foi possível carregar fechados:', e.message);
  }

  // Conjunto de meses fechados (qualquer empresa)
  const fechadosSet = new Set(fechados.map(f => `${f.FR_ANO}_${f.FR_MES}`));

  const hoje2    = new Date();
  const mesAtual = { ano: hoje2.getFullYear(), mes: hoje2.getMonth() + 1 };
  const prevD    = new Date(hoje2.getFullYear(), hoje2.getMonth() - 1, 1);
  const mesAnt   = { ano: prevD.getFullYear(), mes: prevD.getMonth() + 1 };

  let qtdFechados = 0, qtdPendentes = 0;
  const pillsHtml = meses.map(m => {
    const isFuturo  = new Date(m.ano, m.mes - 1, 1) > hoje2;
    const isAtual   = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
    const fechado   = fechadosSet.has(`${m.ano}_${m.mes}`);
    const label     = NOMES_MES[m.mes - 1];

    let cls = 'pill-futuro';
    if (fechado)        { cls = 'pill-fechado';  qtdFechados++; }
    else if (isAtual)   { cls = 'pill-atual'; }
    else if (!isFuturo) { cls = 'pill-pendente'; qtdPendentes++; }

    return `<div class="mes-pill ${cls}" title="${label}/${m.ano}">${label.substring(0,3)}</div>`;
  }).join('');

  document.getElementById('pills-receitas').innerHTML = pillsHtml;
  document.getElementById('val-fechados').textContent  = qtdFechados;
  document.getElementById('val-pendentes').textContent = qtdPendentes;

  // Barra de progresso Receitas
  const pct = Math.round((qtdFechados / 12) * 100);
  document.getElementById('bar-receitas').style.width = pct + '%';
  document.getElementById('pct-receitas').textContent =
    `${qtdFechados}/12 meses (${pct}%)`;
}

document.addEventListener('DOMContentLoaded', init);

// =====================================
// DRE CONSOLIDADO
// =====================================

let dreProjecao = {}; // { 'Rubrica': valor }

function formatMoedaDRE(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatPctDRE(val) {
  return (val || 0).toFixed(0) + '%';
}

function abrirProjecao() {
  const labelSafra = document.getElementById('proj-safra-label');
  if(labelSafra) labelSafra.textContent = document.getElementById('btn-safra-text').textContent;
  
  document.getElementById('modal-projecao').style.display = 'flex';
  // carregar o valor atual se existir
  const rub = document.getElementById('proj-rubrica').value;
  document.getElementById('proj-valor').value = dreProjecao[rub] || 0;
}

function fecharProjecao() {
  document.getElementById('modal-projecao').style.display = 'none';
}

document.getElementById('proj-rubrica')?.addEventListener('change', (e) => {
  document.getElementById('proj-valor').value = dreProjecao[e.target.value] || 0;
});

async function salvarProjecao() {
  const safra = '2026'; // Pegar da variavel global de safra
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
      alert('Projeção salva!');
      fecharProjecao();
      loadDRE();
    } else {
      alert('Erro: ' + json.error);
    }
  } catch(e) {
    console.error(e);
  }
}

async function loadDRE() {
  const safra = '2026'; // Pegar da variavel global
  
  try {
    // 1. Load Projections
    const resP = await fetch('/api/projecao?safra=' + safra);
    const jsonP = await resP.json();
    dreProjecao = {};
    if(jsonP.success) {
      jsonP.data.forEach(p => { dreProjecao[p.PD_RUBRICA] = Number(p.PD_VALOR); });
    }

    // 2. Load Consolidated Data
    const resD = await fetch('/api/dre/consolidado');
    const jsonD = await resD.json();
    if(!jsonD.success) return alert('Erro ao carregar DRE');
    
    // Processar os dados
    renderDRE(jsonD.data);
    
  } catch(e) {
    console.error(e);
  }
}

function renderDRE(data) {
  // A lógica de renderização HTML
}

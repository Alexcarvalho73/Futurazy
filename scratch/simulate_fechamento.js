async function run() {
  try {
    // 1. Fechar Abril/2026
    console.log("Fechando Abril/2026 (Consolidado - TODAS)...");
    const respAbr = await fetch('http://localhost:3000/api/receita/fechar-mes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa: 'TODAS', mes: 4, ano: 2026 })
    });
    const jsonAbr = await respAbr.json();
    console.log("Resposta Abril:", jsonAbr);

    // 2. Fechar Maio/2026
    console.log("\nFechando Maio/2026 (Consolidado - TODAS)...");
    const respMai = await fetch('http://localhost:3000/api/receita/fechar-mes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa: 'TODAS', mes: 5, ano: 2026 })
    });
    const jsonMai = await respMai.json();
    console.log("Resposta Maio:", jsonMai);
  } catch(e) {
    console.error("Erro na simulação:", e);
  }
}
run();

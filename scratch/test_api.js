async function run() {
  try {
    const url = 'http://localhost:3000/api/receita/resumo-anual?ano_safra=2026&tipo=safra';
    console.log(`Buscando ${url}...`);
    const resp = await fetch(url);
    const json = await resp.json();
    console.log("Resultado resumo-anual:");
    console.log(JSON.stringify(json, null, 2));
  } catch(e) {
    console.error("Erro ao chamar API:", e);
  }
}
run();

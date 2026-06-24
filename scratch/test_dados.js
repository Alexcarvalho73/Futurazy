async function run() {
  try {
    const url = 'http://localhost:3000/api/receita/dados?ano_safra=2026';
    console.log(`Buscando ${url}...`);
    const resp = await fetch(url);
    const json = await resp.json();
    console.log("Resultado dados:", json.success, "count:", json.count);
    if (!json.success) {
      console.error("Erro retornado:", json.error);
    }
  } catch(e) {
    console.error("Erro ao chamar API:", e);
  }
}
run();

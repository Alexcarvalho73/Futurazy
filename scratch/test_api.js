async function run() {
  try {
    const key = '51260606065588000148560010000112430000112435      ';
    const url = `http://localhost:3000/api/notas/${key}/financeiro`;
    console.log(`Buscando ${url}...`);
    const resp = await fetch(url);
    const json = await resp.json();
    console.log("Resultado Financeiro:");
    console.log(JSON.stringify(json, null, 2));
  } catch(e) {
    console.error("Erro ao chamar API:", e);
  }
}
run();

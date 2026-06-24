const db = require('../db');

async function run() {
  try {
    await db.initialize();
    const rows = await db.execute("SELECT FR_ID, FR_EMPRESA, FR_ANO, FR_MES, FR_RECEITA_TOTAL FROM FECHAMENTO_RECEITA ORDER BY FR_ANO, FR_MES, FR_EMPRESA");
    console.log("Registros em FECHAMENTO_RECEITA:");
    console.log(rows);
  } catch(e) {
    console.error("Erro na consulta:", e);
  } finally {
    await db.close();
  }
}
run();

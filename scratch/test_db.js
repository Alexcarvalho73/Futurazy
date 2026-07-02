const db = require('../db.js');

async function executeAlter() {
  try {
    await db.initialize();
    
    const alterQuery = `
      ALTER TABLE FECHAMENTO_RECEITA 
      DROP (
        FR_AGRO_RECEITA, 
        FR_AGRO_SACAS, 
        FR_PEC_RECEITA, 
        FR_PEC_SACAS, 
        FR_OUTROS_RECEITA, 
        FR_OUTROS_SACAS
      )
    `;
    console.log("Executando:", alterQuery);
    await db.execute(alterQuery, {}, { autoCommit: true });
    console.log("Colunas removidas com sucesso.");
    
  } catch (e) {
    console.error("Erro no drop:", e);
  } finally {
    await db.close();
  }
}

executeAlter();

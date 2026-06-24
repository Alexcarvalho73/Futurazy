const db = require('../db');

async function run() {
  try {
    await db.initialize();
    
    // 1. Verificar colunas atuais
    const cols = await db.execute(`
      SELECT column_name 
      FROM user_tab_columns 
      WHERE table_name = 'FECHAMENTO_RECEITA'
    `);
    
    const colNames = cols.map(c => c.COLUMN_NAME);
    console.log("Colunas atuais na tabela FECHAMENTO_RECEITA:", colNames);
    
    if (!colNames.includes('FR_DOLAR_MEDIO')) {
      console.log("Adicionando coluna FR_DOLAR_MEDIO...");
      await db.execute("ALTER TABLE FECHAMENTO_RECEITA ADD FR_DOLAR_MEDIO NUMBER(18,4)");
      console.log("Coluna FR_DOLAR_MEDIO adicionada com sucesso!");
    } else {
      console.log("A coluna FR_DOLAR_MEDIO já existe.");
    }
  } catch(e) {
    console.error("Erro na migração:", e);
  } finally {
    await db.close();
  }
}
run();

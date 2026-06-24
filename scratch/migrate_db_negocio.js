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
    
    // 2. Adicionar coluna se não existir
    if (!colNames.includes('FR_NEGOCIO')) {
      console.log("Adicionando coluna FR_NEGOCIO...");
      await db.execute("ALTER TABLE FECHAMENTO_RECEITA ADD FR_NEGOCIO VARCHAR2(50) DEFAULT 'Outros' NOT NULL");
      console.log("Coluna FR_NEGOCIO adicionada com sucesso!");
    } else {
      console.log("A coluna FR_NEGOCIO já existe.");
    }

    // 3. Remover constraint única antiga
    console.log("Removendo constraint única antiga (UK_FECH_REC)...");
    try {
      await db.execute("ALTER TABLE FECHAMENTO_RECEITA DROP CONSTRAINT UK_FECH_REC");
      console.log("Constraint UK_FECH_REC removida.");
    } catch (e) {
      console.warn("Aviso ao remover constraint antiga (pode não existir):", e.message);
    }

    // 4. Adicionar nova constraint única com FR_NEGOCIO
    console.log("Adicionando nova constraint única (UK_FECH_REC) com FR_NEGOCIO...");
    await db.execute(`
      ALTER TABLE FECHAMENTO_RECEITA 
      ADD CONSTRAINT UK_FECH_REC UNIQUE (FR_EMPRESA, FR_ANO, FR_MES, FR_RUBRICA, FR_NEGOCIO)
    `);
    console.log("Nova constraint única adicionada com sucesso!");

  } catch(e) {
    console.error("Erro na migração:", e);
  } finally {
    await db.close();
  }
}
run();

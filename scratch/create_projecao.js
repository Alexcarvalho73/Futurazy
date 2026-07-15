const db = require('../db');

async function createTable() {
  try {
    await db.initialize();
    
    // Create Table PROJECAO_DRE if it doesn't exist
    const sql = `
      BEGIN
        EXECUTE IMMEDIATE 'CREATE TABLE PROJECAO_DRE (
            PD_ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            PD_SAFRA VARCHAR2(20),
            PD_RUBRICA VARCHAR2(100),
            PD_VALOR NUMBER(18,2) DEFAULT 0,
            PD_CREATED_AT DATE DEFAULT SYSDATE
        )';
      EXCEPTION
        WHEN OTHERS THEN
          IF SQLCODE != -955 THEN
            RAISE;
          END IF;
      END;
    `;

    await db.execute(sql, {}, { autoCommit: true });
    console.log("Tabela PROJECAO_DRE criada ou já existente.");
    
  } catch(e) {
    console.error("Erro ao criar tabela:", e);
  } finally {
    await db.close();
  }
}

createTable();

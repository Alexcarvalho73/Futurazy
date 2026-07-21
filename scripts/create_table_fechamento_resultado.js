require('dotenv').config();
const db = require('../db');

async function createTable() {
  try {
    await db.initialize();
    console.log("Conectado ao DB via db.js!");

    const sql = `
      CREATE TABLE FECHAMENTO_RESULTADO (
        FR_ID NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        FR_ANO VARCHAR2(4) NOT NULL,
        FR_MES VARCHAR2(2) NOT NULL,
        FR_FILIAL VARCHAR2(20),
        FR_GRUPO VARCHAR2(100),
        FR_SUBGRUPO VARCHAR2(100),
        FR_ITEM VARCHAR2(150),
        FR_VALOR_BRL NUMBER(18,4) DEFAULT 0,
        FR_VALOR_USD NUMBER(18,4) DEFAULT 0,
        FR_PTAX NUMBER(15,6) DEFAULT 1,
        FR_DATA_CRIACAO TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await db.execute(sql, {}, { autoCommit: true });
    console.log("Tabela FECHAMENTO_RESULTADO criada com sucesso!");

  } catch (err) {
    if (err.errorNum === 955) {
      console.log("A tabela FECHAMENTO_RESULTADO já existe.");
    } else {
      console.error("Erro ao criar a tabela:", err);
    }
  } finally {
    process.exit(0);
  }
}

createTable();

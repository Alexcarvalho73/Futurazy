require('dotenv').config();
const db = require('../db');

async function createTable() {
  try {
    await db.initialize();
    console.log("Conectado ao DB via db.js!");

    const sql = `
      CREATE TABLE FECHAMENTO_RESULTADO_AJUSTES (
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
    console.log("Tabela FECHAMENTO_RESULTADO_AJUSTES criada com sucesso!");

    // Vamos copiar os dados da antiga FECHAMENTO_RESULTADO, pois eles são todos ajustes!
    try {
      const sqlCopy = `
        INSERT INTO FECHAMENTO_RESULTADO_AJUSTES (FR_ANO, FR_MES, FR_FILIAL, FR_GRUPO, FR_SUBGRUPO, FR_ITEM, FR_VALOR_BRL, FR_VALOR_USD, FR_PTAX, FR_DATA_CRIACAO)
        SELECT FR_ANO, FR_MES, FR_FILIAL, FR_GRUPO, FR_SUBGRUPO, FR_ITEM, FR_VALOR_BRL, FR_VALOR_USD, FR_PTAX, FR_DATA_CRIACAO
        FROM FECHAMENTO_RESULTADO
      `;
      await db.execute(sqlCopy, {}, { autoCommit: true });
      console.log("Dados migrados com sucesso para a nova tabela de ajustes.");
    } catch (e) {
      console.warn("Nao foi possivel copiar os dados: ", e.message);
    }

  } catch (err) {
    if (err.errorNum === 955) {
      console.log("A tabela FECHAMENTO_RESULTADO_AJUSTES já existe.");
    } else {
      console.error("Erro ao criar a tabela:", err);
    }
  } finally {
    process.exit(0);
  }
}

createTable();

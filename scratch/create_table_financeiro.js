/**
 * Script one-shot: cria a tabela FECHAMENTO_FINANCEIRO no Oracle
 * Rodar: node scratch/create_table_financeiro.js
 */
const oracledb = require('oracledb');

try {
  oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_24' });
} catch (err) {
  console.error('Thick mode error:', err.message);
}

const dbConfig = {
  user: 'SYS_READ',
  password: 'Hctm9pvy9#jpcta80y4',
  connectString: '192.168.180.30:1521/protheus',
};

const ddlStatements = [
  `CREATE TABLE FECHAMENTO_FINANCEIRO (
    FF_ID             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    FF_EMPRESA        VARCHAR2(10)  NOT NULL,
    FF_ANO            NUMBER(4)     NOT NULL,
    FF_MES            NUMBER(2)     NOT NULL,
    FF_NEGOCIO        VARCHAR2(50)  NOT NULL,
    FF_CC_GRUPO       VARCHAR2(100) NOT NULL,
    FF_CC_SUBGRUPO    VARCHAR2(100),
    FF_VALOR_BRL      NUMBER(18,2)  DEFAULT 0,
    FF_PTAX           NUMBER(10,4)  DEFAULT 0,
    FF_DT_FECHAMENTO  DATE          DEFAULT SYSDATE,
    FF_USUARIO        VARCHAR2(50),
    FF_OBS            VARCHAR2(500),
    CONSTRAINT UK_FF_EMP_ANO_MES_NEG UNIQUE (FF_EMPRESA, FF_ANO, FF_MES, FF_NEGOCIO, FF_CC_GRUPO, FF_CC_SUBGRUPO)
  )`,
  `CREATE INDEX IDX_FF_ANO_MES     ON FECHAMENTO_FINANCEIRO (FF_ANO, FF_MES)`,
  `CREATE INDEX IDX_FF_EMPRESA     ON FECHAMENTO_FINANCEIRO (FF_EMPRESA)`,
  `COMMENT ON TABLE  FECHAMENTO_FINANCEIRO IS 'Fechamento mensal de custos financeiros administrativos e indiretos'`,
];

async function run() {
  let conn;
  try {
    conn = await oracledb.getConnection(dbConfig);
    console.log('Conectado ao Oracle.');

    for (const ddl of ddlStatements) {
      const preview = ddl.split('\n')[0].trim().slice(0, 80);
      try {
        await conn.execute(ddl);
        console.log(`  ✔ OK: ${preview}`);
      } catch (err) {
        if (err.errorNum === 955) {
          console.log(`  ⚠ JÁ EXISTE (ignorado): ${preview}`);
        } else if (err.errorNum === 1408) {
          console.log(`  ⚠ ÍNDICE JÁ EXISTE (ignorado): ${preview}`);
        } else {
          console.error(`  ✘ ERRO: ${preview}`);
          console.error(`    ${err.message}`);
        }
      }
    }

    await conn.commit();
    console.log('\n✅ Tabela FECHAMENTO_FINANCEIRO criada com sucesso!');
  } catch (err) {
    console.error('Erro de conexão:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.close();
    console.log('Conexão encerrada.');
  }
}

run();

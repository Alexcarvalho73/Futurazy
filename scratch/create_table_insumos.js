/**
 * Script one-shot: cria a tabela FECHAMENTO_INSUMOS no Oracle
 * Rodar: node scratch/create_table_insumos.js
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
  `CREATE TABLE FECHAMENTO_INSUMOS (
    FI_ID             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    FI_EMPRESA        VARCHAR2(10)  NOT NULL,
    FI_ANO            NUMBER(4)     NOT NULL,
    FI_MES            NUMBER(2)     NOT NULL,
    FI_TIPO_INSUMO    VARCHAR2(20),
    FI_CUSTO_TOTAL    NUMBER(18,2)  DEFAULT 0,
    FI_PTAX           NUMBER(10,4)  DEFAULT 0,
    FI_DT_FECHAMENTO  DATE          DEFAULT SYSDATE,
    FI_USUARIO        VARCHAR2(50),
    FI_OBS            VARCHAR2(500),
    CONSTRAINT UK_FI_EMP_ANO_MES_TIPO UNIQUE (FI_EMPRESA, FI_ANO, FI_MES, FI_TIPO_INSUMO)
  )`,
  `CREATE INDEX IDX_FI_ANO_MES     ON FECHAMENTO_INSUMOS (FI_ANO, FI_MES)`,
  `CREATE INDEX IDX_FI_EMPRESA     ON FECHAMENTO_INSUMOS (FI_EMPRESA)`,
  `CREATE INDEX IDX_FI_TIPO_INSUMO ON FECHAMENTO_INSUMOS (FI_TIPO_INSUMO)`,
  `COMMENT ON TABLE  FECHAMENTO_INSUMOS IS 'Fechamento mensal de custos com insumos agricolas'`,
  `COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_CUSTO_TOTAL IS 'Custo total BRL = SUM(consumo x ValorRS)'`,
  `COMMENT ON COLUMN FECHAMENTO_INSUMOS.FI_PTAX IS 'PTAX medio ponderado do periodo'`,
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
    console.log('\n✅ Tabela FECHAMENTO_INSUMOS criada com sucesso!');
  } catch (err) {
    console.error('Erro de conexão:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.close();
    console.log('Conexão encerrada.');
  }
}

run();

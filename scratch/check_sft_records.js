const db = require('../db');

async function checkSFT() {
  try {
    await db.initialize();
    
    // Pegar o metadata de SFT020
    const sqlMeta = `SELECT * FROM PROTHEUS11.SFT020 WHERE ROWNUM = 1`;
    let conn;
    try {
      const oracledb = require('oracledb');
      const pool = await oracledb.getPool();
      conn = await pool.getConnection();
      const result = await conn.execute(sqlMeta, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      console.log('--- COLUNAS DE SFT020 ---');
      const cols = result.metaData.map(meta => meta.name);
      console.log('Existe FT_CHVNFE?', cols.includes('FT_CHVNFE'));
      console.log('Existe FT_CHAVENF?', cols.includes('FT_CHAVENF'));
      console.log('Todas as colunas contendo CHV ou CHAVE:');
      console.log(cols.filter(c => c.includes('CHV') || c.includes('CHAVE')));
      
    } catch (e) {
      console.error(e);
    } finally {
      if (conn) await conn.close();
    }

    // Buscar 10 registros de SFT020 com FT_CHVNFE preenchido (se existir)
    console.log('--- BUSCANDO REGISTROS EM SFT020 ---');
    const sqlRows = `
      SELECT * FROM (
        SELECT FT_FILIAL, FT_NFISCAL, FT_SERIE, FT_CLIEFOR, FT_LOJA, FT_CHVNFE 
        FROM PROTHEUS11.SFT020
        WHERE D_E_L_E_T_ = ' '
          AND FT_CHVNFE IS NOT NULL
          AND FT_CHVNFE <> ' '
      ) WHERE ROWNUM <= 5
    `;
    const rows = await db.execute(sqlRows);
    console.log('Amostra de registros no SFT020:', rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

checkSFT();

const db = require('../db');

async function inspectSF1() {
  try {
    await db.initialize();
    
    const key = '51250540154802000170560010000001230000001230';
    console.log(`Buscando no SF1020 pela chave: ${key}`);

    // Pegar as colunas contendo CHV ou CHAVE em SF1020
    const sqlMeta = `SELECT * FROM PROTHEUS11.SF1020 WHERE ROWNUM = 1`;
    let conn;
    try {
      const oracledb = require('oracledb');
      const pool = await oracledb.getPool();
      conn = await pool.getConnection();
      const result = await conn.execute(sqlMeta, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      console.log('--- COLUNAS DE SF1020 ---');
      const cols = result.metaData.map(meta => meta.name);
      console.log('Colunas de chave em SF1020:', cols.filter(c => c.includes('CHV') || c.includes('CHAVE') || c.includes('NFE')));
      
    } catch (e) {
      console.error(e);
    } finally {
      if (conn) await conn.close();
    }

    // Buscar no SF1020 pela chave XML
    // Vamos testar as colunas comuns F1_CHVNFE ou F1_CHVNFE (ou usar LIKE com a chave se tiver espaços)
    const sqlSF1 = `
      SELECT F1_FILIAL, F1_DOC, F1_SERIE, F1_FORNECE, F1_LOJA, F1_CHVNFE
      FROM PROTHEUS11.SF1020
      WHERE TRIM(F1_CHVNFE) = :chave
        AND D_E_L_E_T_ = ' '
    `;
    
    try {
      const rows = await db.execute(sqlSF1, { chave: key });
      console.log('Resultado no SF1020 por F1_CHVNFE:', rows);
    } catch (e) {
      console.error('Erro ao buscar por F1_CHVNFE:', e.message);
    }

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

inspectSF1();

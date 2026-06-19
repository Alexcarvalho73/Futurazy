const db = require('../db');
const oracledb = require('oracledb');

async function checkColumns() {
  try {
    await db.initialize();
    
    // Pegar o schema da tabela
    const sql = `SELECT * FROM PROTHEUS11.CONDORXML WHERE ROWNUM = 1`;
    let conn;
    try {
      const pool = await oracledb.getPool();
      conn = await pool.getConnection();
      const result = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      
      console.log('--- COLUNAS DE CONDORXML ---');
      result.metaData.forEach(meta => {
        console.log(meta.name);
      });
    } catch (e) {
      console.error(e);
    } finally {
      if (conn) await conn.close();
    }

  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

checkColumns();

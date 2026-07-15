const db = require('../db.js');

async function test() {
  try {
    await db.initialize();
    
    const sql = `
      SELECT DISTINCT
        z0.zo0_codfil
      FROM protheus11.zo0020 z0
      WHERE z0.zo0_anoagr = '20251'
    `;
    const res = await db.execute(sql, {});
    console.log("Valores de zo0_codfil:", res);
    
    await db.close();
  } catch (err) {
    console.error(err);
  }
}

test();

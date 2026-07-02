const db = require('../db.js');

async function test() {
  try {
    await db.initialize();
    
    const chave = '41260643999424000114560010002857110002857115';
    const rows = await db.execute(`SELECT * FROM PROTHEUS11.CONDORXML WHERE TRIM(XML_CHAVE) = :chave AND D_E_L_E_T_ = ' '`, { chave });
    console.log(Object.keys(rows[0]));
    
  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
  }
}

test();

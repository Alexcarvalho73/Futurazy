const db = require('../db');

async function checkDestFil() {
  try {
    await db.initialize();
    
    console.log('--- MAPEAMENTO XML_DEST -> XML_FIL ---');
    const sql = `
      SELECT TRIM(XML_DEST) as CNPJ_DEST, TRIM(XML_FIL) as FILIAL, COUNT(*) as QTD
      FROM PROTHEUS11.CONDORXML
      WHERE D_E_L_E_T_ = ' ' AND TRIM(XML_FIL) IS NOT NULL AND TRIM(XML_FIL) <> ' '
      GROUP BY TRIM(XML_DEST), TRIM(XML_FIL)
      ORDER BY FILIAL, QTD DESC
    `;
    const res = await db.execute(sql);
    console.log(res);

    console.log('--- DADOS DA NF ESPECÍFICA ---');
    const sqlNF = `
      SELECT XML_NUMNF, XML_DEST, XML_FIL, XML_NOMEMT 
      FROM PROTHEUS11.CONDORXML 
      WHERE XML_NUMNF LIKE '%890005574011%'
    `;
    const resNF = await db.execute(sqlNF);
    console.log(resNF);

  } catch (err) {
    console.error(err);
  } finally {
    await db.close();
  }
}

checkDestFil();

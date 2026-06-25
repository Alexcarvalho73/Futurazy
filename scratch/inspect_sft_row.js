const db = require('../db');

async function inspectCondorRow() {
  try {
    await db.initialize();
    
    console.log('--- BUSCANDO CONDORXML ---');
    const sqlXML = `
      SELECT XML_CHAVE, XML_NUMNF, XML_FIL, XML_EMIT, XML_DEST, XML_KEYF1, D_E_L_E_T_
      FROM PROTHEUS11.CONDORXML
      WHERE XML_CHAVE = '51250540154802000170560010000001230000001230'
    `;
    const rowsXML = await db.execute(sqlXML);
    console.log('CONDORXML:', rowsXML);

    console.log('--- BUSCANDO CONDORXMLITENS ---');
    const sqlIT = `
      SELECT XIT_CHAVE, XIT_ITEM, XIT_KEYSD1, D_E_L_E_T_
      FROM PROTHEUS11.CONDORXMLITENS
      WHERE XIT_CHAVE = '51250540154802000170560010000001230000001230'
    `;
    const rowsIT = await db.execute(sqlIT);
    console.log('CONDORXMLITENS:', rowsIT);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

inspectCondorRow();

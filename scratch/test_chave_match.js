const db = require('../db');

async function checkChave() {
  try {
    await db.initialize();
    const key = '51260606065588000148560010000112430000112435';
    
    console.log(`Buscando com chave direta...`);
    const sql1 = `
      SELECT XML_CHAVE, XML_NUMNF 
      FROM PROTHEUS11.CONDORXML 
      WHERE XML_CHAVE = :chave 
        AND D_E_L_E_T_ = ' '
    `;
    const rows1 = await db.execute(sql1, { chave: key });
    console.log('Resultado chave direta:', rows1);

    console.log(`Buscando com TRIM(XML_CHAVE)...`);
    const sql2 = `
      SELECT XML_CHAVE, XML_NUMNF 
      FROM PROTHEUS11.CONDORXML 
      WHERE TRIM(XML_CHAVE) = :chave 
        AND D_E_L_E_T_ = ' '
    `;
    const rows2 = await db.execute(sql2, { chave: key });
    console.log('Resultado TRIM(XML_CHAVE):', rows2);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

checkChave();

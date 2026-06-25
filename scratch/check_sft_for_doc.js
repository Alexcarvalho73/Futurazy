const db = require('../db');

async function checkSftForDoc() {
  try {
    await db.initialize();
    
    // Buscar no SFT020 pela nota 000011243
    const sql = `
      SELECT FT_FILIAL, FT_NFISCAL, FT_SERIE, FT_CLIEFOR, FT_LOJA, FT_CHVNFE 
      FROM PROTHEUS11.SFT020 
      WHERE TRIM(FT_NFISCAL) = '000011243'
        AND D_E_L_E_T_ = ' '
    `;
    const rows = await db.execute(sql);
    console.log('Resultados no SFT020 para o documento 000011243:', rows);

    // Buscar no CONDORXML para ver a chave exata da nota do print do usuário: 700000000123
    const sql2 = `
      SELECT XML_CHAVE, XML_NUMNF, XML_KEYF1 
      FROM PROTHEUS11.CONDORXML 
      WHERE XML_NUMNF LIKE '%123%'
        AND D_E_L_E_T_ = ' '
    `;
    const rows2 = await db.execute(sql2);
    console.log('Resultados no CONDORXML para 123:', rows2);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

checkSftForDoc();

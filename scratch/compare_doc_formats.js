const db = require('../db');

async function compareFormats() {
  try {
    await db.initialize();
    
    const sql = `
      SELECT * FROM (
        SELECT 
          XML_CHAVE,
          XML_NUMNF,
          XML_EMIT,
          XML_CODLOJ,
          XML_KEYF1
        FROM PROTHEUS11.CONDORXML
        WHERE D_E_L_E_T_ = ' '
          AND XML_KEYF1 <> ' '
      ) WHERE ROWNUM <= 20
    `;
    
    const rows = await db.execute(sql);
    console.log('--- FORMAT COMPARISON ---');
    rows.forEach(r => {
      const numnf = r.XML_NUMNF.trim();
      const keyf1 = r.XML_KEYF1.trim();
      const chave = r.XML_CHAVE.trim();
      
      // Extrair dados de XML_KEYF1:
      // Formato esperado de XML_KEYF1: FILIAL (6) + DOC (9) + SERIE (3) + FORNECE (6) + LOJA (2) + TIPO (1) + STATUS (2)
      let parsedKey = {};
      if (keyf1.length >= 26) {
        parsedKey = {
          filial: keyf1.substring(0, 6),
          doc: keyf1.substring(6, 15),
          serie: keyf1.substring(15, 18),
          fornece: keyf1.substring(18, 24),
          loja: keyf1.substring(24, 26)
        };
      }
      
      // Extrair da chave de acesso XML (44 digitos)
      // serie pos 23 a 25 (0-indexed: 22 a 25)
      // doc pos 26 a 34 (0-indexed: 25 a 34)
      let parsedChave = {};
      if (chave.length === 44) {
        parsedChave = {
          serie: chave.substring(22, 25),
          doc: chave.substring(25, 34)
        };
      }
      
      console.log({
        XML_NUMNF: numnf,
        XML_CHAVE: chave,
        ParsedChave: parsedChave,
        XML_KEYF1: keyf1,
        ParsedKey: parsedKey
      });
    });
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

compareFormats();

const db = require('../db');

async function searchSftAny() {
  try {
    await db.initialize();
    
    console.log('--- BUSCANDO 123 NO SFT020 (QUALQUER FORMATO) ---');
    const sql1 = `
      SELECT FT_FILIAL, FT_NFISCAL, FT_SERIE, FT_CLIEFOR, FT_LOJA, FT_CHVNFE, D_E_L_E_T_
      FROM PROTHEUS11.SFT020
      WHERE (TRIM(FT_NFISCAL) = '123' OR TRIM(FT_NFISCAL) = '000000123')
        AND D_E_L_E_T_ = ' '
    `;
    const rows1 = await db.execute(sql1);
    console.log('Resultado 123 em SFT020:', rows1);

    console.log('--- BUSCANDO 11243 NO SFT020 (QUALQUER FORMATO) ---');
    const sql2 = `
      SELECT FT_FILIAL, FT_NFISCAL, FT_SERIE, FT_CLIEFOR, FT_LOJA, FT_CHVNFE, D_E_L_E_T_
      FROM PROTHEUS11.SFT020
      WHERE (TRIM(FT_NFISCAL) = '11243' OR TRIM(FT_NFISCAL) = '000011243')
        AND D_E_L_E_T_ = ' '
    `;
    const rows2 = await db.execute(sql2);
    console.log('Resultado 11243 em SFT020:', rows2);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

searchSftAny();

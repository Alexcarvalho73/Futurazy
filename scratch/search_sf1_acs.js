const db = require('../db');

async function searchSF1Acs() {
  try {
    await db.initialize();
    
    console.log('--- BUSCANDO REGISTROS DE ACS NO SF1020 ---');
    const sql = `
      SELECT F1_FILIAL, F1_DOC, F1_SERIE, F1_FORNECE, F1_LOJA, F1_EMISSAO, F1_CHVNFE, F1_VALMERC
      FROM PROTHEUS11.SF1020
      WHERE F1_FORNECE = '025902'
        AND D_E_L_E_T_ = ' '
    `;
    const rows = await db.execute(sql);
    console.log('Notas Fiscais no SF1020:', rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

searchSF1Acs();

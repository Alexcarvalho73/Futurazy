const db = require('../db');

async function searchSE2020Doc123() {
  try {
    await db.initialize();
    
    console.log('--- BUSCANDO 123 NO SE2020 ---');
    const sql = `
      SELECT E2_FILIAL, E2_NUM, E2_PREFIXO, E2_FORNECE, E2_LOJA, E2_NOMFOR, E2_VALOR, E2_SALDO, E2_HIST
      FROM PROTHEUS11.SE2020
      WHERE (TRIM(E2_NUM) = '123' OR TRIM(E2_NUM) = '000000123')
        AND D_E_L_E_T_ = ' '
    `;
    const rows = await db.execute(sql);
    console.log('Resultados no SE2020 para 123:', rows);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

searchSE2020Doc123();

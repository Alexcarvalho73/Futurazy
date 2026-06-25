const db = require('../db');

async function searchSupplier() {
  try {
    await db.initialize();
    
    console.log('--- BUSCANDO QUALQUER REGISTRO DE 000521 NO SE2020 ---');
    const sql1 = `
      SELECT E2_FILIAL, E2_NUM, E2_PREFIXO, E2_FORNECE, E2_LOJA, E2_VALOR, E2_SALDO, E2_HIST
      FROM PROTHEUS11.SE2020
      WHERE E2_FORNECE = '000521'
        AND D_E_L_E_T_ = ' '
        AND ROWNUM <= 10
    `;
    const res1 = await db.execute(sql1);
    console.log('Resultados 000521:', res1);

    console.log('--- BUSCANDO QUALQUER REGISTRO DE 001317 NO SE2020 ---');
    const sql2 = `
      SELECT E2_FILIAL, E2_NUM, E2_PREFIXO, E2_FORNECE, E2_LOJA, E2_VALOR, E2_SALDO, E2_HIST
      FROM PROTHEUS11.SE2020
      WHERE E2_FORNECE = '001317'
        AND D_E_L_E_T_ = ' '
        AND ROWNUM <= 10
    `;
    const res2 = await db.execute(sql2);
    console.log('Resultados 001317:', res2);

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

searchSupplier();

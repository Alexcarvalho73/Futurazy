const db = require('../db');

async function checkDeleted() {
  try {
    await db.initialize();
    
    const sql = `
      SELECT E2_FILIAL, E2_NUM, E2_PREFIXO, E2_FORNECE, E2_LOJA, E2_VALOR, E2_SALDO, D_E_L_E_T_ 
      FROM PROTHEUS11.SE2020 
      WHERE E2_FORNECE = '025902' 
        AND TRIM(E2_NUM) = '000000123'
    `;
    const rows = await db.execute(sql);
    console.log('Resultados no SE2020 (incluindo deletados):', rows);
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

checkDeleted();

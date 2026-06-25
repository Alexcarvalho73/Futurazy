const db = require('../db');

async function checkBaixa() {
  try {
    await db.initialize();
    
    // Buscar alguns registros com saldo 0 (baixados)
    const sql = `
      SELECT E2_NUM, E2_VALOR, E2_SALDO, E2_BAIXA, E2_FATURA 
      FROM PROTHEUS11.SE2020 
      WHERE E2_SALDO = 0 
        AND D_E_L_E_T_ = ' '
        AND ROWNUM <= 5
    `;
    const rows = await db.execute(sql);
    console.log('Registros com saldo 0:', rows);
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

checkBaixa();

const db = require('../db');

async function check() {
  try {
    await db.initialize();
    
    console.log('--- BUSCANDO TODOS OS FORNECEDORES COM CNPJ 40154802000170 ---');
    const sql = `
      SELECT A2_COD, A2_LOJA, A2_NOME, D_E_L_E_T_
      FROM PROTHEUS11.SA2020
      WHERE TRIM(A2_CGC) = '40154802000170'
    `;
    const sa2Rows = await db.execute(sql);
    console.log('Fornecedores SA2020:', sa2Rows);
    
    console.log('--- BUSCANDO SE2020 PARA QUALQUER FORNECEDOR COM NUM 123 E PREFIXO 700 OR 001 ---');
    const sqlSe2 = `
      SELECT E2_FILIAL, E2_NUM, E2_PREFIXO, E2_FORNECE, E2_LOJA, E2_VALOR, E2_SALDO, E2_HIST, D_E_L_E_T_
      FROM PROTHEUS11.SE2020
      WHERE (TRIM(E2_NUM) = '123' OR TRIM(E2_NUM) = '000000123')
    `;
    const se2Rows = await db.execute(sqlSe2);
    console.log('SE2020 rows:', se2Rows);
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

check();

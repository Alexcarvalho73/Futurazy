const db = require('../db');

async function searchSftCnpj() {
  try {
    await db.initialize();
    
    const cnpj = '40154802000170';
    console.log(`CNPJ: ${cnpj}`);
    
    // 1. SA2020
    const sqlSA2 = `
      SELECT A2_COD, A2_LOJA, A2_NOME 
      FROM PROTHEUS11.SA2020 
      WHERE TRIM(A2_CGC) = :cnpj
        AND D_E_L_E_T_ = ' '
    `;
    const sa2 = await db.execute(sqlSA2, { cnpj });
    console.log('SA2020:', sa2);
    
    if (sa2.length > 0) {
      const code = sa2[0].A2_COD;
      console.log(`Código do Fornecedor: ${code}`);
      
      // 2. SFT020
      const sqlSFT = `
        SELECT FT_FILIAL, FT_NFISCAL, FT_SERIE, FT_CLIEFOR, FT_LOJA, FT_CHVNFE
        FROM PROTHEUS11.SFT020
        WHERE FT_CLIEFOR = :code
          AND D_E_L_E_T_ = ' '
      `;
      const sft = await db.execute(sqlSFT, { code });
      console.log('Registros no SFT020 para o fornecedor:', sft);
      
      // 3. SE2020
      const sqlSE2 = `
        SELECT E2_FILIAL, E2_NUM, E2_PREFIXO, E2_PARCELA, E2_VALOR, E2_SALDO, E2_HIST
        FROM PROTHEUS11.SE2020
        WHERE E2_FORNECE = :code
          AND D_E_L_E_T_ = ' '
      `;
      const se2 = await db.execute(sqlSE2, { code });
      console.log('Registros no SE2020 para o fornecedor:', se2);
    } else {
      console.log('Fornecedor não localizado em SA2020.');
    }
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

searchSftCnpj();

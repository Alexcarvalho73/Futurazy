const db = require('../db');

async function testSFTLookup() {
  try {
    await db.initialize();
    
    // As chaves de teste
    const chaves = [
      '51260606065588000148560010000112430000112435', // Nota anterior (AUTO PECAS)
      '51250540154802000170560010000001230000001230'  // Nota do print do usuário (ACS GESTAO)
    ];

    for (const key of chaves) {
      console.log(`\n=== BUSCANDO SFT PARA A CHAVE: ${key} ===`);
      
      const sqlSFT = `
        SELECT DISTINCT 
          FT_FILIAL, 
          FT_SERIE, 
          FT_NFISCAL, 
          FT_CLIEFOR, 
          FT_LOJA 
        FROM PROTHEUS11.SFT020 
        WHERE TRIM(FT_CHVNFE) = :chave 
          AND FT_TIPOMOV = 'E' 
          AND D_E_L_E_T_ = ' '
      `;
      
      const sftRows = await db.execute(sqlSFT, { chave: key });
      console.log('Resultados no SFT020:', sftRows);
      
      if (sftRows.length > 0) {
        const sft = sftRows[0];
        console.log(`Buscando no SE2020 com os dados do SFT -> Filial: [${sft.FT_FILIAL}], Serie: [${sft.FT_SERIE}], Doc: [${sft.FT_NFISCAL}], Fornece: [${sft.FT_CLIEFOR}], Loja: [${sft.FT_LOJA}]`);
        
        const sqlSE2 = `
          SELECT 
            E2_FILIAL,
            E2_NUM,
            E2_PREFIXO,
            E2_PARCELA,
            E2_TIPO,
            E2_FORNECE,
            E2_LOJA,
            E2_NOMFOR,
            E2_EMISSAO,
            E2_VENCTO,
            E2_VENCREA,
            E2_TPGER,
            E2_VALOR,
            E2_SALDO,
            E2_HIST,
            E2_FATURA,
            E2_BAIXA
          FROM PROTHEUS11.SE2020
          WHERE E2_FILIAL = :filial
            AND E2_PREFIXO = :prefixo
            AND E2_NUM = :num
            AND E2_FORNECE = :fornece
            AND E2_LOJA = :loja
            AND D_E_L_E_T_ = ' '
          ORDER BY E2_PARCELA ASC
        `;
        
        const se2Rows = await db.execute(sqlSE2, {
          filial: sft.FT_FILIAL,
          prefixo: sft.FT_SERIE,
          num: sft.FT_NFISCAL,
          fornece: sft.FT_CLIEFOR,
          loja: sft.FT_LOJA
        });
        
        console.log('Financeiro no SE2020 encontrado:', se2Rows);
      } else {
        console.log('Nenhuma nota fiscal encontrada no SFT020 para esta chave.');
      }
    }
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

testSFTLookup();

const db = require('../db');

async function testMatch() {
  try {
    await db.initialize();
    
    // Vamos buscar as mesmas 5 notas do CONDORXML, mas agora fazendo a busca no SE2020 
    // usando os dados corretos extraídos de XML_KEYF1!
    const sqlXML = `
      SELECT * FROM (
        SELECT 
          XML_CHAVE,
          XML_NUMNF,
          XML_EMIT,
          XML_NOMEMT,
          XML_CODLOJ,
          XML_KEYF1,
          XML_STATUS
        FROM (
          SELECT XM.*,
            CASE  
              WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%|A%' THEN 'Lançada'
              WHEN XML_KEYF1 <> ' ' AND XML_KEYF1 LIKE '%| %'  THEN 'Pré-Nota'
              WHEN XML_KEYF1 <> ' ' THEN 'Lançada'
              ELSE 'Sem Definição'
            END as XML_STATUS
          FROM PROTHEUS11.CONDORXML XM
          WHERE XM.D_E_L_E_T_ = ' '
            AND XM.XML_KEYF1 <> ' '
        )
        WHERE XML_STATUS = 'Lançada'
      ) WHERE ROWNUM <= 5
    `;
    
    const xmlNotes = await db.execute(sqlXML);
    
    for (const note of xmlNotes) {
      const keyf1 = note.XML_KEYF1.trim();
      console.log(`\n--- NOTA XML: ${note.XML_NUMNF} | KEYF1: ${keyf1}`);
      
      let fornecedor = '';
      let loja = '';
      let doc = '';
      let serie = '';
      
      if (keyf1.length >= 26) {
        doc = keyf1.substring(6, 15);
        serie = keyf1.substring(15, 18);
        fornecedor = keyf1.substring(18, 24);
        loja = keyf1.substring(24, 26);
        
        console.log(`Extraído de KEYF1 -> Fornecedor: [${fornecedor}], Loja: [${loja}], Doc: [${doc}], Serie: [${serie}]`);
      } else {
        // Fallback: se KEYF1 estiver vazio, obter fornecedor do SA2020 por CNPJ e formatar doc e serie
        console.log('KEYF1 não tem formato válido, tentando fallback...');
      }
      
      if (fornecedor) {
        // Fazer a query no SE2020
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
            E2_FATURA
          FROM PROTHEUS11.SE2020
          WHERE E2_FORNECE = :fornece
            AND E2_LOJA = :loja
            AND E2_NUM = :num
            AND E2_PREFIXO = :prefixo
            AND D_E_L_E_T_ = ' '
        `;
        
        const se2Rows = await db.execute(sqlSE2, {
          fornece: fornecedor,
          loja: loja,
          num: doc,
          prefixo: serie
        });
        
        console.log('Financeiro no SE2020 encontrado:', se2Rows);
      }
    }
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

testMatch();

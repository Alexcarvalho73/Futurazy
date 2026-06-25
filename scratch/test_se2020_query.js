const db = require('../db');

async function testQuery() {
  try {
    await db.initialize();
    
    // Buscar algumas notas fiscais de CONDORXML que tenham XML_KEYF1 preenchido (ou seja, lançadas/pré-notas)
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
    console.log('--- NOTAS DO XML (AMOSTRA) ---');
    console.log(xmlNotes);
    
    for (const note of xmlNotes) {
      console.log(`\nProcessando nota: ${note.XML_NUMNF} fornecedor: ${note.XML_NOMEMT} (CNPJ/CPF: ${note.XML_EMIT})`);
      
      // Buscar no SA2020 pelo CNPJ/CPF (A2_CGC) para obter o código do fornecedor (A2_COD)
      const cgcClean = note.XML_EMIT.trim();
      const sqlSA2 = `
        SELECT A2_COD, A2_LOJA, A2_NOME, A2_CGC
        FROM PROTHEUS11.SA2020
        WHERE TRIM(A2_CGC) = :cgc
          AND D_E_L_E_T_ = ' '
      `;
      const sa2Rows = await db.execute(sqlSA2, { cgc: cgcClean });
      console.log('Fornecedores encontrados em SA2020:', sa2Rows);
      
      if (sa2Rows.length > 0) {
        const codFornece = sa2Rows[0].A2_COD;
        const lojaFornece = sa2Rows[0].A2_LOJA;
        const docNum = note.XML_NUMNF.trim();
        // A serie da nota fiscal: vamos pegar de XML_KEYF1 ou da XML_CHAVE
        let serie = '';
        if (note.XML_KEYF1 && note.XML_KEYF1.trim().length >= 18) {
          serie = note.XML_KEYF1.substring(15, 18).trim();
        } else {
          // Da XML_CHAVE posições 23 a 25 (0-indexed: 22 a 25)
          serie = note.XML_CHAVE.substring(22, 25).trim();
        }
        
        console.log(`Buscando no SE2020 com Fornecedor: ${codFornece}, Loja: ${lojaFornece}, Doc: ${docNum}, Serie: ${serie}`);
        
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
            AND TRIM(E2_NUM) = :num
            AND TRIM(E2_PREFIXO) = :prefixo
            AND D_E_L_E_T_ = ' '
        `;
        
        const se2Rows = await db.execute(sqlSE2, {
          fornece: codFornece,
          loja: lojaFornece,
          num: docNum,
          prefixo: serie
        });
        
        console.log('Financeiro no SE2020 encontrado:', se2Rows);
      }
    }
  } catch (err) {
    console.error('Erro no teste:', err);
  } finally {
    await db.close();
  }
}

testQuery();

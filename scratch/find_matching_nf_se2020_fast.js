const db = require('../db');

async function findMatchesFast() {
  try {
    await db.initialize();
    
    // Buscar 200 notas fiscais de CONDORXML que tenham XML_KEYF1 preenchido
    const sqlXML = `
      SELECT * FROM (
        SELECT 
          XML_CHAVE,
          XML_NUMNF,
          XML_EMIT,
          XML_NOMEMT,
          XML_CODLOJ,
          XML_KEYF1
        FROM PROTHEUS11.CONDORXML
        WHERE D_E_L_E_T_ = ' '
          AND XML_KEYF1 <> ' '
        ORDER BY XML_EMISSA DESC
      ) WHERE ROWNUM <= 200
    `;
    
    const xmlNotes = await db.execute(sqlXML);
    console.log(`Buscadas ${xmlNotes.length} notas do XML.`);
    
    let matchCount = 0;
    
    for (const note of xmlNotes) {
      const keyf1 = note.XML_KEYF1.trim();
      if (keyf1.length < 26) continue;
      
      const doc = keyf1.substring(6, 15);
      const serie = keyf1.substring(15, 18);
      const fornece = keyf1.substring(18, 24);
      const loja = keyf1.substring(24, 26);
      
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
        fornece: fornece,
        loja: loja,
        num: doc,
        prefixo: serie
      });
      
      if (se2Rows.length > 0) {
        matchCount++;
        console.log(`\n[MATCH ${matchCount}] Nota XML: ${note.XML_NUMNF} | Fornecedor: ${note.XML_NOMEMT.trim()}`);
        console.log(`Dados Financeiros no SE2020 (${se2Rows.length} parcelas):`);
        se2Rows.forEach(r => {
          console.log(`  - Filial: ${r.E2_FILIAL} | Num: ${r.E2_NUM} | Parcela: ${r.E2_PARCELA} | Tipo: ${r.E2_TIPO} | Valor: ${r.E2_VALOR} | Venc: ${r.E2_VENCREA} | Gerencia: ${r.E2_TPGER} | Hist: ${r.E2_HIST.trim()}`);
        });
        
        if (matchCount >= 5) {
          console.log('\nAlcançou limite de 5 correspondências para exibição.');
          break;
        }
      }
    }
    
    if (matchCount === 0) {
      console.log('Nenhum correspondente direto encontrado nas 200 notas mais recentes.');
    }

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

findMatchesFast();

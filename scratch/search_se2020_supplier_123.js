const db = require('../db');

async function search() {
  try {
    await db.initialize();
    
    console.log('--- BUSCANDO SE2020 COM FILTRO DE FORNECE + NUM ---');
    const sql = `
      SELECT E2_FILIAL, E2_NUM, E2_PREFIXO, E2_PARCELA, E2_VALOR, E2_SALDO, E2_HIST, D_E_L_E_T_
      FROM PROTHEUS11.SE2020
      WHERE E2_FORNECE = '025902'
        AND (E2_NUM LIKE '%123%' OR E2_NUM = '000000123')
    `;
    const rows = await db.execute(sql);
    console.log('Resultados no SE2020:', rows);

    console.log('--- BUSCANDO CONDORXML COMPLETO PARA A NOTA ---');
    const sqlXml = `
      SELECT XML_CHAVE, XML_NUMNF, XML_FIL, XML_EMIT, XML_DEST, XML_KEYF1, XML_STATUS
      FROM (
        SELECT XM.*,
          CASE  
            WHEN XM.XML_REJEIT <> ' ' THEN 'Rejeitada'
            WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' THEN 'Lançada'
            WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %'  THEN 'Pré-Nota'
            WHEN XM.XML_KEYF1 <> ' ' THEN 'Lançada'
            ELSE 'Pendente'
          END as XML_STATUS
        FROM PROTHEUS11.CONDORXML XM
        WHERE XML_CHAVE = '51250540154802000170560010000001230000001230'
      )
    `;
    const rowsXml = await db.execute(sqlXml);
    console.log('Dados XML:', rowsXml);
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

search();

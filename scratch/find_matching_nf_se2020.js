const db = require('../db');

async function findMatches() {
  try {
    await db.initialize();
    
    // Fazer uma query de junção para encontrar notas que tenham financeiro no SE2020
    const sql = `
      SELECT * FROM (
        SELECT 
          XM.XML_CHAVE,
          XM.XML_NUMNF,
          XM.XML_EMISSA,
          XM.XML_EMIT,
          XM.XML_NOMEMT,
          SA2.A2_COD,
          SA2.A2_LOJA,
          SE2.E2_NUM,
          SE2.E2_PREFIXO,
          SE2.E2_VALOR,
          SE2.E2_HIST,
          SE2.E2_TPGER
        FROM PROTHEUS11.CONDORXML XM
        INNER JOIN PROTHEUS11.SA2020 SA2 ON TRIM(SA2.A2_CGC) = TRIM(XM.XML_EMIT) AND SA2.D_E_L_E_T_ = ' '
        INNER JOIN PROTHEUS11.SE2020 SE2 ON SE2.E2_FORNECE = SA2.A2_COD 
                                       AND SE2.E2_LOJA = SA2.A2_LOJA
                                       -- Fazer correspondência do número e série de forma flexível
                                       AND TRIM(SE2.E2_NUM) = TRIM(XM.XML_NUMNF)
                                       AND SE2.D_E_L_E_T_ = ' '
        WHERE XM.D_E_L_E_T_ = ' '
      ) WHERE ROWNUM <= 10
    `;
    
    const rows = await db.execute(sql);
    console.log('--- NOTAS COM FINANCEIRO CORRESPONDENTE ENCONTRADAS ---');
    console.log(`Total encontrado: ${rows.length}`);
    rows.forEach(r => {
      console.log({
        XML_NUMNF: r.XML_NUMNF,
        XML_EMIT: r.XML_EMIT,
        XML_NOMEMT: r.XML_NOMEMT.trim(),
        A2_COD: r.A2_COD,
        A2_LOJA: r.A2_LOJA,
        E2_NUM: r.E2_NUM,
        E2_PREFIXO: r.E2_PREFIXO,
        E2_VALOR: r.E2_VALOR,
        E2_HIST: r.E2_HIST.trim(),
        E2_TPGER: r.E2_TPGER
      });
    });

  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

findMatches();

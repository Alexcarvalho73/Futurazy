const db = require('../db');

async function test() {
  try {
    await db.initialize();
    
    // As tabelas são:
    // FECHAMENTO_RECEITA: FR_ANO, FR_MES, FR_EMPRESA, FR_RECEITA_TOTAL, FR_INTERCOMPANY, etc. (deduções)
    // FECHAMENTO_INSUMOS: FI_ANO, FI_MES, FI_EMPRESA, FI_TIPO_INSUMO, FI_CUSTO_TOTAL
    // FECHAMENTO_PECUARIA: FP_ANO, FP_MES, FP_EMPRESA, FP_CAV
    // FECHAMENTO_FINANCEIRO: FF_ANO, FF_MES, FF_EMPRESA, FF_CC_GRUPO, FF_TIPO_RATEIO, FF_VALOR_BRL

    const sqlRec = `
      SELECT FR_ANO, FR_MES, FR_EMPRESA, 
             SUM(FR_RECEITA_TOTAL) AS VALOR_CLI,
             SUM(FR_INTERCOMPANY) AS VALOR_INT,
             SUM(COALESCE(FR_FUNRURAL,0) + COALESCE(FR_GTA,0) + COALESCE(FR_FETHAB,0) + COALESCE(FR_VLR_FACS,0)) AS VALOR_DED
      FROM FECHAMENTO_RECEITA
      GROUP BY FR_ANO, FR_MES, FR_EMPRESA
    `;

    const sqlIns = `
      SELECT FI_ANO, FI_MES, FI_EMPRESA, FI_TIPO_INSUMO, SUM(FI_CUSTO_TOTAL) AS VALOR
      FROM FECHAMENTO_INSUMOS
      GROUP BY FI_ANO, FI_MES, FI_EMPRESA, FI_TIPO_INSUMO
    `;

    const sqlPec = `
      SELECT FP_ANO, FP_MES, FP_EMPRESA, SUM(FP_CAV) AS VALOR
      FROM FECHAMENTO_PECUARIA
      GROUP BY FP_ANO, FP_MES, FP_EMPRESA
    `;

    const sqlFin = `
      SELECT FF_ANO, FF_MES, FF_EMPRESA, FF_CC_GRUPO, FF_TIPO_RATEIO, SUM(FF_VALOR_BRL) AS VALOR
      FROM FECHAMENTO_FINANCEIRO
      GROUP BY FF_ANO, FF_MES, FF_EMPRESA, FF_CC_GRUPO, FF_TIPO_RATEIO
    `;

    const [rec, ins, pec, fin] = await Promise.all([
      db.execute(sqlRec),
      db.execute(sqlIns),
      db.execute(sqlPec),
      db.execute(sqlFin)
    ]);
    
    console.log("Receitas:", rec.length);
    console.log("Insumos:", ins.length);
    console.log("Pecuária:", pec.length);
    console.log("Financeiro:", fin.length);
    
  } catch(e) {
    console.error(e);
  } finally {
    await db.close();
  }
}
test();

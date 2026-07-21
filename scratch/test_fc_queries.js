require('dotenv').config();
const db = require('../db');
(async () => {
  await db.initialize();
  try {
    const sql = `
      SELECT
        substr(SE5.E5_DTDISPO,1,6) AS ANO_MES,
        TRIM(substr(SE5.E5_FILIAL,1,6)) AS FILIAL,
        CASE SE5.E5_RECPAG WHEN 'P' THEN SE5.E5_VALOR * -1 ELSE SE5.E5_VALOR END AS VALOR_BRL,
        SE5.E5_VLMOED2 AS VALOR_USD,
        (SELECT SM.M2_MOEDA2 FROM PROTHEUS11.SM2020 SM
         WHERE TO_CHAR(SM.M2_DATA,'YYYYMMDD') = TO_CHAR(TO_DATE(SE5.E5_DTDISPO,'YYYYMMDD') - 1,'YYYYMMDD')
           AND SM.D_E_L_E_T_ <> '*' AND ROWNUM = 1) AS PTAX
      FROM PROTHEUS11.SE5020 SE5
      WHERE SE5.E5_MOEDA = 'M1'
        AND SE5.E5_SITUACA <> 'C'
        AND SE5.D_E_L_E_T_ = ' '
        AND LENGTH(TRIM(SE5.E5_DTDISPO)) = 8
        AND substr(SE5.E5_DTDISPO,1,6) BETWEEN '202609' AND '202612'
        FETCH FIRST 5 ROWS ONLY
    `;
    const r = await db.execute(sql);
    console.log('✅ SE5020 OK! Registros:', r.length);
    r.forEach(x => console.log(' ', JSON.stringify(x)));
  } catch(e) {
    console.error('❌ ERRO SE5020:', e.message);
  }

  // Testar view principal também
  try {
    const sql2 = `
      SELECT
        TO_CHAR(fv.VENCIMENTO, 'YYYYMM') AS ANO_MES,
        TRIM(fv.FILIAL) AS FILIAL,
        TRIM(fv.TPGER) AS TP_GER,
        fv.STATUS,
        "VALOR_R$" AS VALOR_BRL,
        pl.FP_CONTA_PL,
        pl.FP_NIVEL
      FROM PROTHEUS11.AV_FLUXODECAIXAFTZ fv
      LEFT JOIN DF_FLUXO_PL pl ON TRIM(pl.FP_TP_GER) = TRIM(fv.TPGER)
      WHERE TO_CHAR(fv.VENCIMENTO, 'YYYYMM') BETWEEN '202609' AND '202612'
        AND NVL(TRIM(fv.TPGER), 'X') <> 'NFC'
        FETCH FIRST 5 ROWS ONLY
    `;
    const r2 = await db.execute(sql2);
    console.log('✅ View principal OK! Registros:', r2.length);
    r2.forEach(x => console.log(' ', JSON.stringify(x)));
  } catch(e) {
    console.error('❌ ERRO View:', e.message);
  }

  await db.close();
})();

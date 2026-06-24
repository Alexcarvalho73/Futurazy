const db = require('../db');

async function run() {
  try {
    await db.initialize();
    
    // Contar registros de abril e maio de 2026
    const sql = `
      SELECT EMPRESA, 
             TO_CHAR(EMISSAO, 'YYYY-MM') AS MES_ANO,
             COUNT(*) AS QTD,
             SUM(TOTAL) AS SOMA_TOTAL
      FROM (
        SELECT f2_filial AS EMPRESA,
               CASE 
                 WHEN LENGTH(TRIM(F2_EMISSAO)) = 8 AND F2_EMISSAO <> '00000000' AND F2_EMISSAO <> '        ' AND REGEXP_LIKE(F2_EMISSAO, '^[0-9]{8}$')
                 THEN TO_DATE(F2_EMISSAO, 'yyyymmdd')
                 ELSE NULL
               END AS EMISSAO,
               (d2_total + d2_valfre) AS TOTAL
        FROM protheus11.sf2020 f2
        JOIN protheus11.sd2020 d2 ON d2.d2_doc = f2.f2_doc AND d2.d2_serie = f2.f2_serie AND d2.d2_cliente = f2.f2_cliente AND d2.d2_loja = f2.f2_loja AND d2.d2_filial = f2.f2_filial
        WHERE f2.d_e_l_e_t_ <> '*' AND d2.d_e_l_e_t_ <> '*'
          AND F2_EMISSAO >= '20260401' AND F2_EMISSAO <= '20260531'
      )
      GROUP BY EMPRESA, TO_CHAR(EMISSAO, 'YYYY-MM')
      ORDER BY MES_ANO, EMPRESA
    `;
    const rows = await db.execute(sql);
    console.log("Registros brutos de notas em Abril/Maio 2026:");
    console.log(rows);
  } catch(e) {
    console.error("Erro na consulta:", e);
  } finally {
    await db.close();
  }
}
run();

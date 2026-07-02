const db = require('../db');

async function run() {
  try {
    await db.initialize();
    const sql = `
    SELECT DISTINCT
      TRIM(e.cd_empresa)            AS EMPRESA_COD,
      ua.regiao                     AS REGIAO,
      u1.de_upnivel1                AS FAZENDA,
      u3.cd_upnivel3                AS TALHAO,
      ps.de_per_safra               AS PERIODO_SAFRA,
      vr.de_variedade               AS VARIEDADE,
      z0.zo0_anoagr                 AS SAFRA,
      TO_DATE(z0.zo0_data, 'yyyy/mm/dd') AS DDATA,
      z0.zo0_codigo                 AS O_S,
      TRIM(bm.bm_desc)              AS TIPO_PRODUTO,
      substr(b1_grupo, 1, 4)        AS GRUPO,
      TRIM(bm.bm_desc)              AS SUBGRUPO,
      z1.zo1_codpro                 AS CODPROD,
      b1.b1_desc                    AS PRODUTO,
      u3.qt_area_prod               AS AREA_PLAN,
      z4.zo4_haapli                 AS AREA_APLIC,
      (SELECT SUM(z41.zo4_haapli)
         FROM protheus11.zo4020 z41
        WHERE z41.zo4_codigo = z0.zo0_codigo
          AND z41.d_e_l_e_t_ <> '*') AS AREA_APLT,
      z1.zo1_qtdcon                 AS CONSUMO,
      za.za5_moeda                  AS ZA5_MOEDA,
      CASE za.za5_moeda
        WHEN '1' THEN NVL(za.za5_vcompr, 0)
        ELSE NVL(za.za5_vcompr, 0) * NVL(za.za5_ptax, 1)
      END                           AS VLR_RS,
      NVL(za.za5_ptax, 0)           AS PTAX
    FROM protheus11.zo4020         z4,
         protheus11.zo1020         z1,
         protheus11.zo0020         z0,
         protheus11.sb1020         b1,
         protheus11.sbm020         bm,
         protheus11.za5020         za,
         unidadeadm@PIMSGRAOSAGR   ua,
         upnivel2@PIMSGRAOSAGR     u2,
         upnivel1@PIMSGRAOSAGR     u1,
         filial@PIMSGRAOSAGR       f,
         empresa@PIMSGRAOSAGR      e,
         upnivel3@PIMSGRAOSAGR     u3,
         variedade@PIMSGRAOSAGR    vr,
         periodosafra@PIMSGRAOSAGR ps,
         safra@PIMSGRAOSAGR        sf
   WHERE z4.zo4_codigo = z0.zo0_codigo
     AND z0.zo0_codemp = '85'
     AND z0.zo0_codigo = z1.zo1_codigo
     AND z1.zo1_codpro = b1.b1_cod
     AND substr(b1.b1_grupo,1,4)||'   ' = bm.bm_grupo
     AND ua.id_filial = f.id_filial
     AND f.id_empresa = e.id_empresa
     AND CAST(TRIM(z0.zo0_codagl) AS VARCHAR(6)) = ua.cd_int_erp
     AND CAST(TRIM(z4.zo4_codset) AS VARCHAR(6)) = u2.cd_upnivel2
     AND u2.id_upnivel1 = u1.id_upnivel1
     AND u1.id_unidadeadm = ua.id_unidadeadm
     AND u3.id_upnivel2 = u2.id_upnivel2
     AND u3.id_periodosafra = ps.id_periodosafra
     AND trim(TO_CHAR(ps.cd_per_safra)) = TRIM(z0.zo0_perpro)
     AND ps.id_safra = sf.id_safra
     AND TRIM(sf.da_safra) = TRIM(z0.zo0_anoagr)
     AND TRIM(e.cd_empresa) = TRIM(z0.zo0_codemp)
     AND u3.id_variedade = vr.id_variedade
     AND z1.zo1_qtdcon <> 0
     AND ((trim(TO_CHAR(nvl(u3.cd_upnivel3, 0))) = trim(nvl(z4.zo4_codtal, ' ')))
          OR (TRIM(u3.id_upnivel3) = TRIM(z4.zo4_idupn3)))
     AND ' '         = za.d_e_l_e_t_(+)
     AND '20251' = za.za5_safra(+)
     AND '0285' = za.za5_filial(+)
     AND z1.zo1_codpro = za.za5_produt(+)
     AND z4.d_e_l_e_t_ = ' '
     AND z1.d_e_l_e_t_ = ' '
     AND z0.d_e_l_e_t_ = ' '
     AND b1.d_e_l_e_t_ = ' '
     AND bm.d_e_l_e_t_ = ' '
     AND b1_grupo like '02%'
     AND TO_DATE(z0.zo0_data, 'yyyy/mm/dd') >= TO_DATE('20260601', 'yyyymmdd')
     AND TO_DATE(z0.zo0_data, 'yyyy/mm/dd') <= TO_DATE('20260630', 'yyyymmdd')
    `;
    console.log('Executando query...');
    const result = await db.execute(sql, {});
    console.log('Result:', result.length);
  } catch (err) {
    console.error('Erro na query:', err.message);
  } finally {
    process.exit(0);
  }
}
run();

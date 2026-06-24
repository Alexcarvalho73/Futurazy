const db = require('../db');

function buildReceitaSQL() {
  return `
    SELECT OUTER_Q.*,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.TOTAL       / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS TOTAL_USD,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VLR_FACS    / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS VLR_FACS_USD,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VLR_FETHAB  / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS VLR_FETHAB_USD,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VL_FUNRURAL / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS VL_FUNRURAL_USD
    FROM (
      SELECT MID_Q.*,
        (SELECT PTAX FROM (
           SELECT SM.M2_MOEDA2 AS PTAX
           FROM protheus11.SM2020 SM
           WHERE SM.M2_DATA <= to_char(MID_Q.EMISSAO - 1,'yyyymmdd')
             AND SM.D_E_L_E_T_ <> '*'
           ORDER BY SM.M2_DATA DESC
         ) WHERE ROWNUM = 1) AS COTACAO_DOLAR
      FROM (
        SELECT distinct
          f2_filial                             AS EMPRESA,
          CASE 
            WHEN LENGTH(TRIM(F2_EMISSAO)) = 8 AND F2_EMISSAO <> '00000000' AND F2_EMISSAO <> '        ' AND REGEXP_LIKE(F2_EMISSAO, '^[0-9]{8}$')
            THEN TO_DATE(F2_EMISSAO, 'yyyymmdd')
            ELSE NULL
          END                                   AS EMISSAO,
          TRIM(F2_DOC)                           AS NF,
          decode(f2_tipo,'D',
            (select SUBSTR(a2.a2_nome,1,30) from protheus11.sa2020 a2
              where a2.a2_cod=f2_cliente and a2.a2_loja=f2_loja and a2.d_e_l_e_t_<>'*'),
            (select SUBSTR(a1.a1_nome,1,30) from protheus11.sa1020 a1
              where a1.a1_cod=f2_cliente and a1.a1_loja=f2_loja and a1.d_e_l_e_t_<>'*')
          )                                      AS NOME_CLIENTE,
          C5_CONTRAT                             AS CONTRPAI,
          C5_SUBCOO                              AS CONTRFILHO,
          TRIM(D2_CF)                            AS CFOP,
          D2_QUANT                               AS QUANT,
          (d2_total + d2_valfre)                 AS TOTAL,
          SUBSTR(B1_desc,1,35)                   AS PRODUTO,
          TRIM(F2_TIPO)                          AS TPDOC,
          CASE WHEN TRIM(B1_GRUPO) = '0402008' THEN D2_QUANT/60 ELSE 0 END AS SACAS,
          CASE WHEN TRIM(B1_GRUPO) = '0203003' THEN D2_QUANT ELSE 0 END AS CABECAS,
          D2_PRCVEN                              AS VLR_UNIT,
          F2_VALFAC                              AS VLR_FACS,
          F2_VALFET                              AS VLR_FETHAB,
          F2_CONTSOC                             AS VL_FUNRURAL,
          SUBSTR(C5_NOMTRAN,1,25)                AS TRANSP,
          C5.C5_VEICULO                          AS PLACA,
          TRIM(B1_GRUPO)                         AS B1_GRUPO,
          CASE
            WHEN TRIM(B1_GRUPO) = '0203003' THEN 'Pecuária'
            WHEN TRIM(B1_GRUPO) = '0402008' THEN 'Agricultura'
            ELSE 'Outros'
          END                                    AS TIPO_NEGOCIO
        FROM protheus11.sc5020 c5,
             protheus11.sc6020 c6,
             protheus11.sf2020 f2,
             protheus11.sd2020 d2,
             protheus11.sb1020 b1
        WHERE c5.c5_num      = c6.c6_num
          AND D2.D2_PEDIDO   = c5.c5_num
          AND c5.c5_filial   = c6.c6_filial
          AND F2.F2_FILIAL   = c6.c6_filial
          AND D2.D2_FILIAL   = f2.f2_filial
          AND d2.d2_cod      = b1.b1_cod
          AND f2.f2_doc      = d2.d2_doc
          AND f2.f2_serie    = d2.d2_serie
          AND f2.f2_cliente  = d2.d2_cliente
          AND f2.f2_loja     = d2.d2_loja
          AND c5.d_e_l_e_t_ <> '*'
          AND c6.d_e_l_e_t_ <> '*'
          AND f2.d_e_l_e_t_ <> '*'
          AND d2.d_e_l_e_t_ <> '*'
          AND b1.d_e_l_e_t_ <> '*'
          AND F2_EMISSAO >= REPLACE(:data_de, '-', '')
          AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
          AND D2_CF NOT IN ('5949','5905','5151','5910','5201','5208')
          AND F2.F2_FILIAL IN ('028501','028503')

        UNION

        SELECT distinct
          f1_filial                              AS EMPRESA,
          CASE 
            WHEN LENGTH(TRIM(F1_EMISSAO)) = 8 AND F1_EMISSAO <> '00000000' AND F1_EMISSAO <> '        ' AND REGEXP_LIKE(F1_EMISSAO, '^[0-9]{8}$')
            THEN TO_DATE(F1_EMISSAO, 'yyyymmdd')
            ELSE NULL
          END                                   AS EMISSAO,
          TRIM(D1_DOC)                           AS NF,
          decode(d1_TIPO,'D',
            (select SUBSTR(a2.a2_nome,1,30) from protheus11.sa2020 a2
              where a2.a2_cod=F1_fornece and a2.a2_loja=d1_loja and a2.d_e_l_e_t_<>'*'),
            (select SUBSTR(a1.a1_nome,1,30) from protheus11.sa1020 a1
              where a1.a1_cod=F1_fornece and a1.a1_loja=d1_loja and a1.d_e_l_e_t_<>'*')
          )                                      AS NOME_CLIENTE,
          'ENTRADA'                              AS CONTRPAI,
          'ENTRADA'                              AS CONTRFILHO,
          TRIM(D1_CF)                            AS CFOP,
          D1_QUANT * -1                          AS QUANT,
          d1_total * -1                          AS TOTAL,
          SUBSTR(B1_desc,1,35)                   AS PRODUTO,
          TRIM(d1_TIPO)                          AS TPDOC,
          CASE WHEN TRIM(B1_GRUPO) = '0402008' THEN D1_QUANT/60 ELSE 0 END * -1 AS SACAS,
          CASE WHEN TRIM(B1_GRUPO) = '0203003' THEN D1_QUANT ELSE 0 END * -1 AS CABECAS,
          D1_VUNIT                               AS VLR_UNIT,
          D1_VALFAC * -1                         AS VLR_FACS,
          D1_VALFET                              AS VLR_FETHAB,
          F1_CONTSOC * -1                        AS VL_FUNRURAL,
          SUBSTR(F1_TRANSP,1,25)                 AS TRANSP,
          'ENTRADA'                              AS PLACA,
          TRIM(B1_GRUPO)                         AS B1_GRUPO,
          CASE
            WHEN TRIM(B1_GRUPO) = '0203003' THEN 'Pecuária'
            WHEN TRIM(B1_GRUPO) = '0402008' THEN 'Agricultura'
            ELSE 'Outros'
          END                                    AS TIPO_NEGOCIO
        FROM protheus11.sf1020 f1,
             protheus11.sd1020 d1,
             protheus11.sb1020 b1
        WHERE D1.D1_FILIAL  = f1.f1_filial
          AND d1.d1_cod     = b1.b1_cod
          AND f1.f1_doc     = d1.d1_doc
          AND f1.f1_serie   = d1.d1_serie
          AND f1.f1_fornece = d1.d1_fornece
          AND f1.f1_loja    = d1.d1_loja
          AND f1.d_e_l_e_t_ <> '*'
          AND d1.d_e_l_e_t_ <> '*'
          AND b1.d_e_l_e_t_ <> '*'
          AND F1_EMISSAO >= REPLACE(:data_de, '-', '')
          AND F1_EMISSAO <= REPLACE(:data_ate, '-', '')
          AND D1_CF NOT IN ('1906','1151','1101','1933','1356','1922','1910','1209')
          AND f1.f1_filial IN ('028501','028503')
      ) MID_Q
    ) OUTER_Q
  `;
}

function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthRange(ano, mes) {
  return {
    dataDe:  dateToStr(new Date(ano, mes - 1, 1)),
    dataAte: dateToStr(new Date(ano, mes, 0))
  };
}

async function loadMonth(ano, mes) {
  console.log(`\n========================================`);
  console.log(`Processando fechamento para: ${mes}/${ano}...`);
  
  const { dataDe, dataAte } = getMonthRange(ano, mes);
  console.log(`Intervalo de datas: de ${dataDe} até ${dataAte}`);

  const rows = await db.execute(buildReceitaSQL(), { data_de: dataDe, data_ate: dataAte });
  console.log(`Registros encontrados no Oracle: ${rows.length}`);

  // Calcular o dólar médio ponderado global do mês
  let totalBrl = 0;
  let totalUsd = 0;
  for (const r of rows) {
    totalBrl += Number(r.TOTAL || 0);
    totalUsd += Number(r.TOTAL_USD || 0);
  }
  const dolarMedio = totalUsd > 0 ? (totalBrl / totalUsd) : null;
  console.log(`Dólar Médio calculado para o mês: ${dolarMedio}`);

  // Agrupar dados por empresa (filial) e negócio (TIPO_NEGOCIO)
  const groups = {};
  for (const r of rows) {
    const emp = r.EMPRESA;
    const negocio = r.TIPO_NEGOCIO || 'Outros';
    const key = `${emp}_${negocio}`;

    if (!groups[key]) {
      groups[key] = {
        empresa: emp,
        negocio: negocio,
        receita: 0,
        sacas: 0,
        cabecas: 0,
        funrural: 0,
        fethab: 0,
        vlrFacs: 0,
        nfsSet: new Set()
      };
    }

    const tot = Number(r.TOTAL || 0);
    const sac = Number(r.SACAS || 0);
    const cab = Number(r.CABECAS || 0);

    groups[key].receita  += tot;
    groups[key].sacas    += sac;
    groups[key].cabecas  += cab;
    groups[key].funrural += Number(r.VL_FUNRURAL || 0);
    groups[key].fethab   += Number(r.VLR_FETHAB  || 0);
    groups[key].vlrFacs  += Number(r.VLR_FACS    || 0);
    if (r.NF) groups[key].nfsSet.add(r.NF);
  }

  // Deletar fechamentos existentes do período para evitar chaves duplicadas
  await db.execute(`
    DELETE FROM FECHAMENTO_RECEITA 
    WHERE FR_EMPRESA IN ('028501', '028503', 'TODAS') 
      AND FR_ANO = :ano 
      AND FR_MES = :mes 
      AND FR_RUBRICA = 'RECEITA'
  `, { ano, mes }, { autoCommit: true });
  console.log(`Fechamentos anteriores de ${mes}/${ano} limpos no banco.`);

  const insertSql = `
    INSERT INTO FECHAMENTO_RECEITA
      (FR_EMPRESA, FR_NEGOCIO, FR_ANO, FR_MES, FR_RUBRICA, FR_RECEITA_TOTAL, FR_SACAS, FR_QTD_NFS,
       FR_FUNRURAL, FR_FETHAB, FR_VLR_FACS,
       FR_AGRO_RECEITA, FR_AGRO_SACAS, FR_PEC_RECEITA, FR_PEC_SACAS,
       FR_OUTROS_RECEITA, FR_OUTROS_SACAS, FR_DOLAR_MEDIO, FR_DT_FECHAMENTO)
    VALUES
      (:empresa, :negocio, :ano, :mes, 'RECEITA', :receita, :sacas, :qtdNfs,
       :funrural, :fethab, :vlrFacs,
       :agroReceita, :agroSacas, :pecReceita, :pecSacas,
       :outrosReceita, :outrosSacas, :dolarMedio, SYSDATE)
  `;

  for (const g of Object.values(groups)) {
    let agroReceita = 0, agroSacas = 0;
    let pecReceita = 0, pecSacas = 0;
    let outrosReceita = 0, outrosSacas = 0;

    if (g.negocio === 'Agricultura') {
      agroReceita = g.receita;
      agroSacas = g.sacas;
    } else if (g.negocio === 'Pecuária') {
      pecReceita = g.receita;
      pecSacas = g.cabecas;
    } else {
      outrosReceita = g.receita;
      outrosSacas = g.sacas;
    }

    await db.execute(insertSql, {
      empresa: g.empresa,
      negocio: g.negocio,
      ano,
      mes,
      receita: g.receita,
      sacas: g.sacas,
      qtdNfs: g.nfsSet.size,
      funrural: g.funrural,
      fethab: g.fethab,
      vlrFacs: g.vlrFacs,
      agroReceita,
      agroSacas,
      pecReceita,
      pecSacas,
      outrosReceita,
      outrosSacas,
      dolarMedio
    }, { autoCommit: true });
    console.log(`  -> Grupo [${g.empresa} / ${g.negocio}] inserido com sucesso.`);
  }
}

async function run() {
  try {
    await db.initialize();

    // Meses a fechar: Set/2025 (2025/9) até Abr/2026 (2026/4)
    const meses = [
      { ano: 2025, mes: 9 },
      { ano: 2025, mes: 10 },
      { ano: 2025, mes: 11 },
      { ano: 2025, mes: 12 },
      { ano: 2026, mes: 1 },
      { ano: 2026, mes: 2 },
      { ano: 2026, mes: 3 },
      { ano: 2026, mes: 4 }
    ];

    for (const m of meses) {
      await loadMonth(m.ano, m.mes);
    }

    console.log("\n========================================");
    console.log("Carga de histórico finalizada com sucesso!");
  } catch(e) {
    console.error("Erro na carga de histórico:", e);
  } finally {
    await db.close();
  }
}

run();

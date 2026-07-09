const oracledb = require('oracledb');
oracledb.initOracleClient({ libDir: 'C:\\\\oracle\\\\instantclient_19_24' });
async function run() {
  const conn = await oracledb.getConnection({ user: 'SYS_READ', password: 'Hctm9pvy9#jpcta80y4', connectString: '192.168.180.30:1521/protheus' });
  const sql = `
SELECT  
  SUBSTR(E5_FILIAL, 3, 2) AS Empresa,
  DECODE(E5_CLVLDB,'01','028501','02','028501','03','028501',E5_FILorig) AS Filial,
  TO_DATE(E5_DTDISPO, 'yyyy/mm/dd') AS Data,
  CASE E5_RECPAG 
      WHEN 'P' THEN E5_VALOR * -1
      WHEN 'R' THEN E5_VALOR 
  END AS Valor_R$,
  decode(za1_nature, '1','Custo Mão-de-Obra', '2','Dia-a-Dia', '3','Manutenção', '6','Arrendamentos ','Sem Classificação') as cc_grupo,
  substr(E5_CCD,1,2) AS C_CUSTO,
  cc2.ctt_desc01 as cc_subgrupo,
  ZA.ZA1_CODIGO AS Tp_Ger,
  ZA.ZA1_DESC AS Tipo_Gerencial,
  ZA.ZA1_CLASSI AS Clas,
  case when E5_CLVLDB = '02' then 'Rateio Geral'
  else DECODE(substr(E5_CCD,1,2),'01','PECUARIA','02','SOJA','Rateio Interno')  end Tipo_rateio,
  E5_PREFIXO AS Prefixo,
  E5_NUMERO AS Numero,
  E5_PARCELA AS Parcela,
  E5_TIPO AS Tipo,
  E5_NATUREZ AS Natureza,
  E5_CLIFOR AS Cli_For,
  E5_BENEF AS Benef,
  E5_HISTOR AS Historico_Baixa,
  SE5.R_E_C_N_O_ AS REGSE5
FROM protheus11.SE5020 SE5
LEFT JOIN protheus11.ctt020 cc ON cc.ctt_filial=e5_filial and cc.ctt_custo = substr(E5_CCD,1,2)||'       ' AND cc.D_E_L_E_T_ <> '*'
LEFT JOIN protheus11.ctt020 cc2 ON cc2.ctt_filial=e5_filial and cc2.ctt_custo = E5_CCD AND cc2.D_E_L_E_T_ <> '*'
LEFT JOIN protheus11.ZA1020 ZA ON ZA.ZA1_CODIGO = SE5.E5_TPGER AND ZA.D_E_L_E_T_ <> '*'
LEFT JOIN protheus11.SED020 ED ON ED.ED_CODIGO = SE5.E5_NATUREZ AND ED.D_E_L_E_T_ <> '*'
LEFT JOIN protheus11.SM2020 SM ON SM.M2_DATA = SE5.E5_DTDISPO - 1 AND SM.D_E_L_E_T_ <> '*'
WHERE SE5.E5_BANCO <> '   '
  AND SE5.E5_TIPODOC NOT IN ('DC','JR','MT','CM','D2','J2','M2','V2','C2','CP','TL','BA','I2','EI')
  AND NOT (SE5.E5_MOEDA IN ('C1','C2','C3','C4','C5','CH') AND SE5.E5_NUMCHEQ = '               ' AND SE5.E5_TIPODOC NOT IN ('TR','TE'))
  AND NOT (SE5.E5_TIPODOC IN ('TR','TE') AND (SE5.E5_NUMCHEQ BETWEEN '*              ' AND '*ZZZZZZZZZZZZZZ' OR SE5.E5_DOCUMEN BETWEEN '*                ' AND '*ZZZZZZZZZZZZZZZZ'))
  AND NOT (SE5.E5_TIPODOC IN ('TR','TE') AND SE5.E5_NUMERO = '      ' AND SE5.E5_MOEDA NOT IN ('CC','CD','CH','CO','DOC','FI','R$','TB','TC','VL','DO'))
  AND SE5.E5_SITUACA <> 'C'
  AND SE5.E5_VALOR <> 0
  AND NOT(SE5.E5_NUMCHEQ BETWEEN '*              ' AND '*ZZZZZZZZZZZZZZ') 
  AND SE5.D_E_L_E_T_ = ' '
  AND TRIM(SUBSTR(SE5.E5_FILIAL, 1, 4)) IN ('0285')
  AND SE5.E5_DTDISPO between '20260601' AND '20260731'
  AND ZA.ZA1_CLASSI='3'
  AND TRIM(cc2.ctt_desc01) = 'COMPRAS / SUPRIMENTOS'
  AND ZA.za1_nature='1'
ORDER BY tipo_rateio,cc_GRUPO,CC_SUBGRUPO,TIPO_GERENCIAL
  `;
  const res = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  console.log('Result count:', res.rows.length);
  res.rows.forEach(r => console.log(r.DT, r.TIPO_GERENCIAL, r.PREFIXO, r.NUMERO, r.PARCELA, r.VALOR_R$));
  await conn.close();
}
run().catch(console.error);
run().catch(console.error);

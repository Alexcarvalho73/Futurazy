const db = require('./db');

async function run() {
  await db.initialize();

  try {
    const q1 = `
      select * from protheus11.CONDORXML
      where xml_chave='51260621821738000190550010001610091418183048'
    `;
    const res1 = await db.execute(q1);
    console.log("=== Principal SQL ===");
    if (res1.length > 0) {
      console.log("XML_CHAVE:", res1[0].XML_CHAVE);
      console.log("XML_KEYF1:", res1[0].XML_KEYF1);
      console.log("XML_NUMNF:", res1[0].XML_NUMNF);
      console.log("XML_FIL:", res1[0].XML_FIL);
      console.log("XML_EMIT:", res1[0].XML_EMIT);
      console.log("XML_DEST:", res1[0].XML_DEST);
      
      const xmlKey = res1[0].XML_KEYF1 || '';
      console.log("Extracted from XML_KEYF1:");
      console.log("  filial:", xmlKey.substring(0, 6));
      console.log("  nfiscal:", xmlKey.substring(6, 15));
      console.log("  serie:", xmlKey.substring(15, 18));
      console.log("  fornec:", xmlKey.substring(18, 24));
      console.log("  loja:", xmlKey.substring(24, 26));

    } else {
      console.log("Nenhum registro encontrado no Principal SQL");
    }

    const q2 = `
      SELECT 
        TRIM(E2_FILIAL) as E2_FILIAL,
        TRIM(E2_NUM) as E2_NUM,
        TRIM(E2_PREFIXO) as E2_PREFIXO,
        TRIM(E2_PARCELA) as E2_PARCELA,
        TRIM(E2_TIPO) as E2_TIPO,
        TRIM(E2_FORNECE) as E2_FORNECE,
        TRIM(E2_LOJA) as E2_LOJA,
        TRIM(E2_NOMFOR) as E2_NOMFOR,
        E2_EMISSAO,
        E2_VENCTO,
        E2_VENCREA,
        TRIM(E2_TPGER) as E2_TPGER,
        E2_VALOR,
        E2_SALDO,
        TRIM(E2_HIST) as E2_HIST,
        TRIM(E2_FATURA) as E2_FATURA,
        E2_BAIXA
      FROM PROTHEUS11.SE2020
      WHERE E2_FILIAL = '028501'
        AND E2_PREFIXO = '1'
        AND E2_NUM = '000161009'
        AND D_E_L_E_T_ = ' '
      ORDER BY E2_PARCELA ASC, E2_VENCREA ASC
    `;
    const res2 = await db.execute(q2);
    console.log("\n=== Financeiro SQL ===");
    console.log(`Registros encontrados: ${res2.length}`);
    if (res2.length > 0) {
      console.log(res2);
    } else {
      console.log("Fazendo busca mais ampla no SE2020 para o NUM 000161009...");
      const q3 = `
        SELECT TRIM(E2_FILIAL) as E2_FILIAL, TRIM(E2_NUM) as E2_NUM, TRIM(E2_PREFIXO) as E2_PREFIXO, TRIM(E2_FORNECE) as E2_FORNECE, TRIM(E2_LOJA) as E2_LOJA 
        FROM PROTHEUS11.SE2020 
        WHERE E2_NUM = '000161009' AND D_E_L_E_T_ = ' '
      `;
      const res3 = await db.execute(q3);
      console.log("Resultados amplos:");
      console.log(res3);
    }

  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
  }
}

run();

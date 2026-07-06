const db = require('./db');

async function run() {
  await db.initialize();

  try {
    const q1 = `
      select * from protheus11.CONDORXML
      where xml_chave='51260621821738000190550010001610091418183048'
    `;
    const res1 = await db.execute(q1);
    
    const xmlKey = res1[0].XML_KEYF1 || '';
    const filial = xmlKey.substring(0, 6).trim();
    const nfiscal = xmlKey.substring(6, 15).trim();
    const serie = xmlKey.substring(15, 18).trim();
    const fornec = xmlKey.substring(18, 24).trim();
    const loja = xmlKey.substring(24, 26).trim();
    
    console.log("Valores Trimmed:");
    console.log(`filial: '${filial}'`);
    console.log(`nfiscal: '${nfiscal}'`);
    console.log(`serie: '${serie}'`);
    console.log(`fornec: '${fornec}'`);
    console.log(`loja: '${loja}'`);

    const q2_binds = `
      SELECT TRIM(E2_NUM) as E2_NUM
      FROM PROTHEUS11.SE2020
      WHERE E2_FILIAL = :filial
        AND E2_PREFIXO = :prefixo
        AND E2_NUM = :num
        AND E2_FORNECE = :fornece
        AND E2_LOJA = :loja
        AND D_E_L_E_T_ = ' '
    `;
    const binds = {
      filial: filial,
      prefixo: serie,
      num: nfiscal,
      fornece: fornec,
      loja: loja
    };

    const res2 = await db.execute(q2_binds, binds);
    console.log("\n=== Financeiro SQL with TRIMMED binds ===");
    console.log(`Registros encontrados: ${res2.length}`);

    const binds_untrimmed = {
      filial: xmlKey.substring(0, 6),
      prefixo: xmlKey.substring(15, 18),
      num: xmlKey.substring(6, 15),
      fornece: xmlKey.substring(18, 24),
      loja: xmlKey.substring(24, 26)
    };

    const res3 = await db.execute(q2_binds, binds_untrimmed);
    console.log("\n=== Financeiro SQL with UNTRIMMED binds ===");
    console.log(`Registros encontrados: ${res3.length}`);

  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
  }
}

run();

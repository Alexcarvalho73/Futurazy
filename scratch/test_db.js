const db = require('../db.js');

async function test() {
  try {
    await db.initialize();
    
    console.log("--- SFT020 por NF/Serie ---");
    const sft = await db.execute(`SELECT FT_FILIAL, FT_NFISCAL, FT_SERIE, FT_ITEM, FT_CHVNFE, FT_ESPECIE, FT_CLIEFOR, FT_LOJA, FT_PRODUTO FROM PROTHEUS11.SFT020 WHERE FT_FILIAL = '028501' AND FT_NFISCAL = '000285711' AND FT_SERIE = '000' AND D_E_L_E_T_ = ' '`);
    console.log(sft);
    
    console.log("--- CONDORXMLITENS ---");
    const itens = await db.execute(`SELECT XIT_ITEM, XIT_KEYSD1, XIT_CHAVE FROM PROTHEUS11.CONDORXMLITENS WHERE TRIM(XIT_CHAVE) = '41260643999424000114560010002857110002857115'`);
    console.log(itens);
  } catch (e) {
    console.error(e);
  } finally {
    await db.close();
  }
}

test();

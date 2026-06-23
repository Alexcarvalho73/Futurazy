const db = require('../db');

async function main() {
  await db.initialize();
  try {
    const key = '41260649501736000132550010000007521653963031';
    
    // Corrected direct join with 6-char filial offsets
    const sql = `
      SELECT 
        TRIM(XIT_ITEM) as XIT_ITEM, 
        TRIM(XIT_CODNFE) as XIT_CODNFE, 
        TRIM(D1_TES) as D1_TES, 
        TRIM(D1_CF) as D1_CF, 
        TRIM(D1_COD) as D1_COD,
        TRIM(XIT_DESCRI) as XIT_DESCRI
      FROM PROTHEUS11.CONDORXMLITENS XI  
      INNER JOIN PROTHEUS11.CONDORXML XM   ON XM.D_E_L_E_T_ =' '   
                               AND XML_CHAVE = XIT_CHAVE   
      LEFT JOIN PROTHEUS11.SD1020 D1     ON D1.D_E_L_E_T_ =' '    
                               AND ((D1_FILIAL = TRIM(XM.XML_FIL)    
                               AND D1_DOC = SUBSTR(XIT_KEYSD1,7,9)    
                               AND D1_SERIE = SUBSTR(XIT_KEYSD1,16,3)    
                               AND D1_FORNECE = SUBSTR(XIT_KEYSD1,19,6)    
                               AND D1_LOJA = SUBSTR(XIT_KEYSD1,25,2)    
                               AND D1_ITEM = SUBSTR(XIT_KEYSD1,42,4)
                               AND XIT_KEYSD1 <> ' ' ) 
                               OR     (D1_FILIAL = TRIM(XM.XML_FIL)    
                               AND D1_DOC = SUBSTR(XML_KEYF1,7,9)    
                               AND D1_SERIE = SUBSTR(XML_KEYF1,16,3)    
                               AND D1_FORNECE = SUBSTR(XML_KEYF1,19,6)    
                               AND D1_LOJA = SUBSTR(XML_KEYF1,25,2)    
                               AND D1_ITEM = XIT_ITEM 
                               AND XIT_KEYSD1 = ' ' ))     
      WHERE XI.D_E_L_E_T_ = ' '     
        AND TRIM(XML_CHAVE) = :key
        AND XML_DEST <> XML_EMIT  
    `;
    
    const rows = await db.execute(sql, { key });
    console.log('Query result with corrected offsets:', rows);
  } catch (err) {
    console.error('Error running test join query:', err);
  } finally {
    await db.close();
  }
}

main();

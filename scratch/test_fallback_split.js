const db = require('../db');

async function testFallbackSplit() {
  try {
    await db.initialize();
    
    // Pegar a mesma nota de teste
    const sqlXML = `
      SELECT XML_CHAVE, XML_NUMNF, XML_EMIT, XML_NOMEMT, XML_KEYF1 
      FROM PROTHEUS11.CONDORXML 
      WHERE D_E_L_E_T_ = ' '
        AND XML_NUMNF LIKE '%11243%'
        AND ROWNUM = 1
    `;
    const xmlRows = await db.execute(sqlXML);
    const note = xmlRows[0];
    
    console.log(`Testando fallback split com Nota: ${note.XML_NUMNF} | Emitente: ${note.XML_NOMEMT.trim()}`);
    
    const cnpj = note.XML_EMIT.trim();
    const sqlSA2 = `
      SELECT DISTINCT A2_COD, A2_LOJA
      FROM PROTHEUS11.SA2020
      WHERE TRIM(A2_CGC) = :cnpj
        AND D_E_L_E_T_ = ' '
    `;
    const sa2Rows = await db.execute(sqlSA2, { cnpj });
    console.log('Fornecedores SA2020:', sa2Rows);
    
    // Aplicar a nova regra de split de XML_NUMNF
    const numnfStr = note.XML_NUMNF; // "100000011243  "
    const prefixoExtracted = numnfStr.substring(0, 3); // "100"
    const docExtracted = numnfStr.substring(3, 12); // "000011243"
    
    console.log(`Dados extraídos via Split -> Prefixo: [${prefixoExtracted}], Doc: [${docExtracted}]`);
    
    const providerBinds = {};
    const providerBindsNames = [];
    sa2Rows.forEach((row, index) => {
      const codBindName = `cod_${index}`;
      const lojaBindName = `loja_${index}`;
      providerBindsNames.push(`(E2_FORNECE = :${codBindName} AND E2_LOJA = :${lojaBindName})`);
      providerBinds[codBindName] = row.A2_COD.trim();
      providerBinds[lojaBindName] = row.A2_LOJA.trim();
    });
    
    const bindsSE2 = {
      ...providerBinds,
      num: docExtracted,
      prefix: prefixoExtracted
    };
    
    const sqlSE2 = `
      SELECT 
        TRIM(E2_FILIAL) as E2_FILIAL,
        TRIM(E2_NUM) as E2_NUM,
        TRIM(E2_PREFIXO) as E2_PREFIXO,
        TRIM(E2_PARCELA) as E2_PARCELA,
        E2_VALOR,
        E2_SALDO
      FROM PROTHEUS11.SE2020
      WHERE (${providerBindsNames.join(' OR ')})
        AND E2_NUM = :num
        AND E2_PREFIXO = :prefix
        AND D_E_L_E_T_ = ' '
    `;
    
    const financeRows = await db.execute(sqlSE2, bindsSE2);
    console.log('Resultados do Financeiro (SE2020) via Fallback Split:', financeRows);
    
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await db.close();
  }
}

testFallbackSplit();

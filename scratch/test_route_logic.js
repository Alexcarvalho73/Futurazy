const db = require('../db');

async function testRouteLogic() {
  try {
    await db.initialize();
    
    // Buscar uma nota em CONDORXML que tenha KEYF1 preenchido para validar
    const sqlXML = `
      SELECT XML_CHAVE, XML_NUMNF, XML_EMIT, XML_NOMEMT, XML_KEYF1 
      FROM PROTHEUS11.CONDORXML 
      WHERE D_E_L_E_T_ = ' '
        AND XML_KEYF1 <> ' '
        AND XML_NUMNF LIKE '%11243%'
        AND ROWNUM = 1
    `;
    const xmlRows = await db.execute(sqlXML);
    if (xmlRows.length === 0) {
      console.log('Nenhuma nota modelo encontrada para o teste.');
      return;
    }
    
    const note = xmlRows[0];
    const key = note.XML_CHAVE;
    console.log(`Testando com a Nota Fiscal: ${note.XML_NUMNF} | Emitente: ${note.XML_NOMEMT.trim()} | Chave: ${key}`);
    
    // Executar a lógica da Rota
    const keyf1 = note.XML_KEYF1 ? note.XML_KEYF1.trim() : '';

    let fornece = '';
    let loja = '';
    let doc = '';
    let prefixo = '';
    let hasKeyInfo = false;

    if (keyf1 && keyf1.length >= 26) {
      doc = keyf1.substring(6, 15);
      prefixo = keyf1.substring(15, 18);
      fornece = keyf1.substring(18, 24);
      loja = keyf1.substring(24, 26);
      hasKeyInfo = true;
    }

    console.log(`Dados extraídos: fornece=[${fornece}], loja=[${loja}], doc=[${doc}], prefixo=[${prefixo}], hasKeyInfo=${hasKeyInfo}`);

    // Forçar hasKeyInfo = false para testar o fallback de busca por CNPJ + Número + Série
    hasKeyInfo = false;

    if (hasKeyInfo) {
      const sqlSE2 = `
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
        WHERE E2_FORNECE = :fornece
          AND E2_LOJA = :loja
          AND E2_NUM = :num
          AND E2_PREFIXO = :prefixo
          AND D_E_L_E_T_ = ' '
        ORDER BY E2_PARCELA ASC, E2_VENCREA ASC
      `;
      const binds = { fornece, loja, num: doc, prefixo };
      const financeRows = await db.execute(sqlSE2, binds);
      console.log('Resultados do Financeiro (SE2020) via KEYF1:', financeRows);
    } else {
      console.log('Nota não possui vínculo de KEYF1. Testando busca fallback...');
      const cnpj = note.XML_EMIT ? note.XML_EMIT.trim() : '';
      if (!cnpj) {
        console.log('Nota fiscal sem CNPJ para busca fallback.');
        return;
      }

      console.log(`CNPJ do Emitente: [${cnpj}]`);

      const sqlSA2 = `
        SELECT DISTINCT A2_COD, A2_LOJA
        FROM PROTHEUS11.SA2020
        WHERE TRIM(A2_CGC) = :cnpj
          AND D_E_L_E_T_ = ' '
      `;
      const sa2Rows = await db.execute(sqlSA2, { cnpj });
      console.log('Fornecedores resolvidos em SA2020:', sa2Rows);

      if (sa2Rows.length === 0) {
        console.log('Fornecedor não localizado em SA2020.');
        return;
      }

      const providerBinds = {};
      const providerBindsNames = [];
      sa2Rows.forEach((row, index) => {
        const codBindName = `cod_${index}`;
        const lojaBindName = `loja_${index}`;
        providerBindsNames.push(`(E2_FORNECE = :${codBindName} AND E2_LOJA = :${lojaBindName})`);
        providerBinds[codBindName] = row.A2_COD.trim();
        providerBinds[lojaBindName] = row.A2_LOJA.trim();
      });

      const docClean = note.XML_NUMNF ? note.XML_NUMNF.trim() : '';
      let docCleanNumeric = docClean;
      try {
        docCleanNumeric = parseInt(docClean, 10).toString();
      } catch (e) {}

      const xmlChave = note.XML_CHAVE ? note.XML_CHAVE.trim() : '';
      let prefixClean = '';
      let prefixClean2 = '';
      if (xmlChave.length === 44) {
        const serieVal = xmlChave.substring(22, 25).trim();
        prefixClean = serieVal;
        try {
          prefixClean2 = parseInt(serieVal, 10).toString();
        } catch (e) {}
      }

      const bindsSE2 = {
        ...providerBinds,
        num1: docClean,
        num2: docCleanNumeric,
        prefix1: prefixClean,
        prefix2: prefixClean2
      };

      const sqlSE2Fallback = `
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
        WHERE (${providerBindsNames.join(' OR ')})
          AND (TRIM(E2_NUM) = :num1 OR TRIM(E2_NUM) = :num2)
          AND (TRIM(E2_PREFIXO) = :prefix1 OR TRIM(E2_PREFIXO) = :prefix2)
          AND D_E_L_E_T_ = ' '
        ORDER BY E2_PARCELA ASC, E2_VENCREA ASC
      `;

      const financeRows = await db.execute(sqlSE2Fallback, bindsSE2);
      console.log('Resultados do Financeiro (SE2020) via Fallback:', financeRows);
    }

  } catch (err) {
    console.error('Erro no teste de rota:', err);
  } finally {
    await db.close();
  }
}

testRouteLogic();

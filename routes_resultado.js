module.exports = function(app, db) {

  // ==========================================
  // GET /api/fechamento/resultado
  // ==========================================
  app.get('/api/fechamento/resultado', async (req, res) => {
    const { data_de, data_ate } = req.query;
    if (!data_de || !data_ate) {
      return res.status(400).json({ error: 'data_de e data_ate obrigatórios' });
    }

    try {
      // 1. RECEITAS E DESPESAS FINANCEIRAS + VENDAS DIVERSAS (SE5020)
      const sqlSE5 = `
        SELECT OUTER_Q.*,
          CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VALOR_BRL / OUTER_Q.COTACAO_DOLAR ELSE 0 END AS VALOR_USD
        FROM (
          SELECT MID_Q.*,
            (SELECT PTAX FROM (
               SELECT SM.M2_MOEDA2 AS PTAX
               FROM protheus11.SM2020 SM
               WHERE SM.M2_DATA <= TO_CHAR(MID_Q.DTDISPO - 1, 'YYYYMMDD')
                 AND SM.D_E_L_E_T_ <> '*'
               ORDER BY SM.M2_DATA DESC
             ) WHERE ROWNUM = 1) AS COTACAO_DOLAR
          FROM (
            SELECT
              SUBSTR(SE5.E5_DTDISPO, 1, 4) AS ANO,
              SUBSTR(SE5.E5_DTDISPO, 5, 2) AS MES,
              TRIM(SE5.E5_FILIAL) AS EMPRESA,
              TRIM(SE5.E5_TPGER) AS TPGER,
              TRIM(SE5.E5_NATUREZ) AS NATUREZA,
              TO_DATE(SE5.E5_DTDISPO, 'YYYYMMDD') AS DTDISPO,
              SE5.E5_PREFIXO AS PREFIXO,
              SE5.E5_NUMERO AS NUMERO,
              SE5.E5_PARCELA AS PARCELA,
              SE5.E5_HISTOR AS HISTORICO,
              (SE5.E5_VALOR * CASE WHEN SE5.E5_RECPAG = 'R' THEN 1 ELSE -1 END) AS VALOR_BRL
            FROM protheus11.SE5020 SE5
            LEFT JOIN protheus11.ZA1020 ZA ON ZA.ZA1_CODIGO = SE5.E5_TPGER AND ZA.D_E_L_E_T_ <> '*'
            LEFT JOIN protheus11.SED020 ED ON ED.ED_CODIGO = SE5.E5_NATUREZ AND ED.D_E_L_E_T_ <> '*'
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
              AND SE5.E5_DTDISPO >= REPLACE(:data_de, '-', '')
              AND SE5.E5_DTDISPO <= REPLACE(:data_ate, '-', '')
          ) MID_Q
        ) OUTER_Q
      `;
      const binds = { data_de, data_ate };
      const resSE5 = await db.execute(sqlSE5, binds);

      // 2. VENDAS IMOBILIZADO (CFOP 5551)
      const sqlFaturam = `
        SELECT OUTER_Q.*,
          CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VALOR_BRL / OUTER_Q.COTACAO_DOLAR ELSE 0 END AS VALOR_USD
        FROM (
          SELECT MID_Q.*,
            (SELECT PTAX FROM (
               SELECT SM.M2_MOEDA2 AS PTAX
               FROM protheus11.SM2020 SM
               WHERE SM.M2_DATA <= TO_CHAR(MID_Q.EMISSAO - 1, 'YYYYMMDD')
                 AND SM.D_E_L_E_T_ <> '*'
               ORDER BY SM.M2_DATA DESC
             ) WHERE ROWNUM = 1) AS COTACAO_DOLAR
          FROM (
            SELECT
              SUBSTR(F2_EMISSAO, 1, 4) AS ANO,
              SUBSTR(F2_EMISSAO, 5, 2) AS MES,
              TRIM(F2.F2_FILIAL) AS EMPRESA,
              TO_DATE(F2_EMISSAO, 'YYYYMMDD') AS EMISSAO,
              F2.F2_SERIE AS PREFIXO,
              F2.F2_DOC AS NUMERO,
              ' ' AS PARCELA,
              'NF Saída CFOP 5551' AS HISTORICO,
              (D2_TOTAL + D2_VALFRE) AS VALOR_BRL
            FROM protheus11.sd2020 d2
            INNER JOIN protheus11.sf2020 f2 ON F2.F2_DOC = D2.D2_DOC AND F2.F2_SERIE = D2.D2_SERIE AND F2.F2_CLIENTE = D2.D2_CLIENTE AND F2.F2_LOJA = D2.D2_LOJA AND F2.F2_FILIAL = D2.D2_FILIAL AND F2.D_E_L_E_T_ <> '*'
            WHERE d2.d_e_l_e_t_ <> '*'
              AND TRIM(D2_CF) = '5551'
              AND F2_EMISSAO >= REPLACE(:data_de, '-', '')
              AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
              AND TRIM(SUBSTR(D2.D2_FILIAL, 1, 4)) IN ('0285')
              
            UNION ALL
            
            SELECT
              SUBSTR(F1_EMISSAO, 1, 4) AS ANO,
              SUBSTR(F1_EMISSAO, 5, 2) AS MES,
              TRIM(F1.F1_FILIAL) AS EMPRESA,
              TO_DATE(F1_EMISSAO, 'YYYYMMDD') AS EMISSAO,
              F1.F1_SERIE AS PREFIXO,
              F1.F1_DOC AS NUMERO,
              ' ' AS PARCELA,
              'NF Entrada CFOP 5551' AS HISTORICO,
              ((D1_TOTAL) * -1) AS VALOR_BRL
            FROM protheus11.sd1020 d1
            INNER JOIN protheus11.sf1020 f1 ON f1.f1_doc = d1.d1_doc AND f1.f1_serie = d1.d1_serie AND f1.f1_fornece = d1.d1_fornece AND f1.f1_loja = d1.d1_loja AND f1.f1_filial = d1.d1_filial AND f1.d_e_l_e_t_ <> '*'
            WHERE d1.d_e_l_e_t_ <> '*'
              AND TRIM(D1_CF) = '5551'
              AND F1_EMISSAO >= REPLACE(:data_de, '-', '')
              AND F1_EMISSAO <= REPLACE(:data_ate, '-', '')
              AND TRIM(SUBSTR(D1.D1_FILIAL, 1, 4)) IN ('0285')
          ) MID_Q
        ) OUTER_Q
      `;
      const resFaturam = await db.execute(sqlFaturam, binds);

      // --- Mapeamento/Categorização do Protheus ---
      let data = [];

      // Helper para jogar no array final
      const addData = (row, grupo, subgrupo, item) => {
        data.push({
          ANO: row.ANO,
          MES: row.MES,
          EMPRESA: row.EMPRESA,
          GRUPO: grupo,
          SUBGRUPO: subgrupo,
          ITEM: item,
          DETALHE: `${row.PREFIXO || ''} ${row.NUMERO || ''} ${row.PARCELA || ''} - ${row.HISTORICO || ''}`.trim(),
          VALOR_BRL: row.VALOR_BRL,
          VALOR_USD: row.VALOR_USD || 0
        });
      };

      // SE5020 mapping
      for (const r of resSE5) {
        const tpger = r.TPGER;
        const nat = r.NATUREZA;

        if (tpger === 'FINAN' && nat === '160204') {
          addData(r, 'RESULTADO FINANCEIRO', 'RECEITAS FINANCEIRAS', '1 - Rendimentos sobre Aplicações');
        } else if (tpger === 'HEDG' && nat === '160203') {
          addData(r, 'RESULTADO FINANCEIRO', 'RECEITAS FINANCEIRAS', '2 - Variação Cambial Positiva');
        } else if ((tpger === 'JURO' || tpger === 'TAXB') && (nat === '160106' || nat === '170302')) {
          addData(r, 'RESULTADO FINANCEIRO', 'DESPESAS FINANCEIRAS', '1 - Juros e Taxas Financeiras');
        } else if (tpger === 'HEDG' && nat === '160103') {
          addData(r, 'RESULTADO FINANCEIRO', 'DESPESAS FINANCEIRAS', '2 - Variação Cambial Negativa');
        } else if (tpger === 'VDIV' || tpger === 'VSI' || tpger === 'AVE') {
          addData(r, 'OPERAÇÕES DE IMOBILIZADO', 'VENDA DE IMOBILIZADO', '3 - Receitas com Vendas Diversas');
        }
      }

      // Faturamento (CFOP 5551)
      for (const r of resFaturam) {
        addData(r, 'OPERAÇÕES DE IMOBILIZADO', 'VENDA DE IMOBILIZADO', '1 - Receita com Venda de Imobilizado');
      }

      res.json({ success: true, data });

    } catch (err) {
      console.error('Erro GET /api/fechamento/resultado:', err);
      res.status(500).json({ error: err.message });
    }
  });


  // ==========================================
  // GET /api/fechamento/ajustes/resultado
  // ==========================================
  app.get('/api/fechamento/ajustes/resultado', async (req, res) => {
    try {
      const sql = `SELECT * FROM FECHAMENTO_RESULTADO ORDER BY FR_ANO DESC, FR_MES DESC, FR_ID DESC`;
      const result = await db.execute(sql);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // NOVA ROTA: Resumo Anual (Mix de Protheus para 2 meses + Tabela Local para o resto)
  app.get('/api/fechamento/resultado/anual', async (req, res) => {
    try {
      const { ano, safraAnoEnd, isSafra } = req.query;
      const today = new Date();
      
      // Datas para o Protheus (Mês Atual e Mês Anterior SEMPRE)
      const curYear = today.getFullYear();
      const curMonth = today.getMonth() + 1; // 1 to 12
      
      let prevMonth = curMonth - 1;
      let prevYear = curYear;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      
      const pDe = `${prevYear}-${String(prevMonth).padStart(2,'0')}-01`;
      const pAte = `${curYear}-${String(curMonth).padStart(2,'0')}-31`; // simplified 31 for end
      const bindsProtheus = { data_de: pDe, data_ate: pAte };

      // Datas para FECHAMENTO_RESULTADO (O Ano ou Safra Inteira)
      let rDe, rAte;
      if (isSafra === 'true') {
        const endY = parseInt(safraAnoEnd) || parseInt(ano) || curYear;
        rDe = `${endY - 1}-09-01`;
        rAte = `${endY}-08-31`;
      } else {
        const y = parseInt(ano) || curYear;
        rDe = `${y}-01-01`;
        rAte = `${y}-12-31`;
      }
      const bindsAjustes = { data_de: rDe, data_ate: rAte };

      // Queries no Protheus (Mês Atual e Anterior) usando a mesma lógica completa
      const sqlSE5 = `
        SELECT OUTER_Q.*,
          CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VALOR_BRL / OUTER_Q.COTACAO_DOLAR ELSE 0 END AS VALOR_USD
        FROM (
          SELECT MID_Q.*,
            (SELECT PTAX FROM (
               SELECT SM.M2_MOEDA2 AS PTAX
               FROM protheus11.SM2020 SM
               WHERE SM.M2_DATA <= TO_CHAR(MID_Q.DTDISPO - 1, 'YYYYMMDD')
                 AND SM.D_E_L_E_T_ <> '*'
               ORDER BY SM.M2_DATA DESC
             ) WHERE ROWNUM = 1) AS COTACAO_DOLAR
          FROM (
            SELECT
              SUBSTR(SE5.E5_DTDISPO, 1, 4) AS ANO,
              SUBSTR(SE5.E5_DTDISPO, 5, 2) AS MES,
              TRIM(SE5.E5_FILIAL) AS EMPRESA,
              TRIM(SE5.E5_TPGER) AS TPGER,
              TRIM(SE5.E5_NATUREZ) AS NATUREZA,
              TO_DATE(SE5.E5_DTDISPO, 'YYYYMMDD') AS DTDISPO,
              SUM(SE5.E5_VALOR * CASE WHEN SE5.E5_RECPAG = 'R' THEN 1 ELSE -1 END) AS VALOR_BRL
            FROM protheus11.SE5020 SE5
            LEFT JOIN protheus11.ZA1020 ZA ON ZA.ZA1_CODIGO = SE5.E5_TPGER AND ZA.D_E_L_E_T_ <> '*'
            LEFT JOIN protheus11.SED020 ED ON ED.ED_CODIGO = SE5.E5_NATUREZ AND ED.D_E_L_E_T_ <> '*'
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
              AND SE5.E5_DTDISPO >= REPLACE(:data_de, '-', '')
              AND SE5.E5_DTDISPO <= REPLACE(:data_ate, '-', '')
            GROUP BY 
              SUBSTR(SE5.E5_DTDISPO, 1, 4),
              SUBSTR(SE5.E5_DTDISPO, 5, 2),
              TRIM(SE5.E5_FILIAL),
              TRIM(SE5.E5_TPGER),
              TRIM(SE5.E5_NATUREZ),
              SE5.E5_DTDISPO
          ) MID_Q
        ) OUTER_Q
      `;
      const sqlFaturam = `
        SELECT OUTER_Q.*,
          CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VALOR_BRL / OUTER_Q.COTACAO_DOLAR ELSE 0 END AS VALOR_USD
        FROM (
          SELECT MID_Q.*,
            (SELECT PTAX FROM (
               SELECT SM.M2_MOEDA2 AS PTAX
               FROM protheus11.SM2020 SM
               WHERE SM.M2_DATA <= TO_CHAR(MID_Q.EMISSAO - 1, 'YYYYMMDD')
                 AND SM.D_E_L_E_T_ <> '*'
               ORDER BY SM.M2_DATA DESC
             ) WHERE ROWNUM = 1) AS COTACAO_DOLAR
          FROM (
            SELECT
              SUBSTR(F2_EMISSAO, 1, 4) AS ANO,
              SUBSTR(F2_EMISSAO, 5, 2) AS MES,
              TRIM(F2.F2_FILIAL) AS EMPRESA,
              TO_DATE(F2_EMISSAO, 'YYYYMMDD') AS EMISSAO,
              SUM(D2_TOTAL + D2_VALFRE) AS VALOR_BRL
            FROM protheus11.sd2020 d2
            INNER JOIN protheus11.sf2020 f2 ON F2.F2_DOC = D2.D2_DOC AND F2.F2_SERIE = D2.D2_SERIE AND F2.F2_CLIENTE = D2.D2_CLIENTE AND F2.F2_LOJA = D2.D2_LOJA AND F2.F2_FILIAL = D2.D2_FILIAL AND F2.D_E_L_E_T_ <> '*'
            WHERE d2.d_e_l_e_t_ <> '*'
              AND TRIM(D2_CF) = '5551'
              AND F2_EMISSAO >= REPLACE(:data_de, '-', '')
              AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
              AND TRIM(SUBSTR(D2.D2_FILIAL, 1, 4)) IN ('0285')
            GROUP BY 
              SUBSTR(F2_EMISSAO, 1, 4),
              SUBSTR(F2_EMISSAO, 5, 2),
              TRIM(F2.F2_FILIAL),
              F2_EMISSAO
              
            UNION ALL
            
            SELECT
              SUBSTR(F1_EMISSAO, 1, 4) AS ANO,
              SUBSTR(F1_EMISSAO, 5, 2) AS MES,
              TRIM(F1.F1_FILIAL) AS EMPRESA,
              TO_DATE(F1_EMISSAO, 'YYYYMMDD') AS EMISSAO,
              SUM((D1_TOTAL) * -1) AS VALOR_BRL
            FROM protheus11.sd1020 d1
            INNER JOIN protheus11.sf1020 f1 ON f1.f1_doc = d1.d1_doc AND f1.f1_serie = d1.d1_serie AND f1.f1_fornece = d1.d1_fornece AND f1.f1_loja = d1.d1_loja AND f1.f1_filial = d1.d1_filial AND f1.d_e_l_e_t_ <> '*'
            WHERE d1.d_e_l_e_t_ <> '*'
              AND TRIM(D1_CF) = '5551'
              AND F1_EMISSAO >= REPLACE(:data_de, '-', '')
              AND F1_EMISSAO <= REPLACE(:data_ate, '-', '')
              AND TRIM(SUBSTR(D1.D1_FILIAL, 1, 4)) IN ('0285')
            GROUP BY 
              SUBSTR(F1_EMISSAO, 1, 4),
              SUBSTR(F1_EMISSAO, 5, 2),
              TRIM(F1.F1_FILIAL),
              F1_EMISSAO
          ) MID_Q
        ) OUTER_Q
      `;

      // 3. Ajustes e Fechamentos Manuais (Tabela Local)
      const sqlAjustes = `
        SELECT FR_ANO AS ANO, FR_MES AS MES, FR_FILIAL AS EMPRESA, FR_GRUPO AS GRUPO, FR_SUBGRUPO AS SUBGRUPO, FR_ITEM AS ITEM, FR_VALOR_BRL AS VALOR_BRL, FR_VALOR_USD AS VALOR_USD
        FROM FECHAMENTO_RESULTADO
        WHERE FR_ANO || FR_MES >= SUBSTR(REPLACE(:data_de, '-', ''), 1, 6)
          AND FR_ANO || FR_MES <= SUBSTR(REPLACE(:data_ate, '-', ''), 1, 6)
      `;

      const [resSE5, resFaturam, resAjustes] = await Promise.all([
        db.execute(sqlSE5, bindsProtheus),
        db.execute(sqlFaturam, bindsProtheus),
        db.execute(sqlAjustes, bindsAjustes)
      ]);

      let data = [];
      const addData = (row, grupo, subgrupo, item) => {
        data.push({
          ANO: row.ANO,
          MES: row.MES,
          EMPRESA: row.EMPRESA,
          GRUPO: grupo,
          SUBGRUPO: subgrupo,
          ITEM: item,
          VALOR_BRL: row.VALOR_BRL,
          VALOR_USD: row.VALOR_USD || 0
        });
      };

      for (const r of resSE5) {
        const tpger = r.TPGER;
        const nat = r.NATUREZA;
        if (tpger === 'FINAN' && nat === '160204') {
          addData(r, 'RESULTADO FINANCEIRO', 'RECEITAS FINANCEIRAS', '1 - Rendimentos sobre Aplicações');
        } else if (tpger === 'HEDG' && nat === '160203') {
          addData(r, 'RESULTADO FINANCEIRO', 'RECEITAS FINANCEIRAS', '2 - Variação Cambial Positiva');
        } else if ((tpger === 'JURO' || tpger === 'TAXB') && (nat === '160106' || nat === '170302')) {
          addData(r, 'RESULTADO FINANCEIRO', 'DESPESAS FINANCEIRAS', '1 - Juros e Taxas Financeiras');
        } else if (tpger === 'HEDG' && nat === '160103') {
          addData(r, 'RESULTADO FINANCEIRO', 'DESPESAS FINANCEIRAS', '2 - Variação Cambial Negativa');
        } else if (tpger === 'VDIV' || tpger === 'VSI' || tpger === 'AVE') {
          addData(r, 'OPERAÇÕES DE IMOBILIZADO', 'VENDA DE IMOBILIZADO', '1 - Receita com Venda de Imobilizado');
        }
      }

      for (const r of resFaturam) {
        addData(r, 'OPERAÇÕES DE IMOBILIZADO', 'VENDA DE IMOBILIZADO', '1 - Receita com Venda de Imobilizado');
      }

      for (const r of resAjustes) {
        addData(r, r.GRUPO, r.SUBGRUPO, r.ITEM);
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // POST /api/fechamento/ajustes/resultado
  // ==========================================
  app.post('/api/fechamento/ajustes/resultado', async (req, res) => {
    const { ano, mes, filial, grupo, subgrupo, item, valor_brl, ptax } = req.body;
    try {
      const valor_usd = (ptax && Number(ptax) > 0) ? Number(valor_brl) / Number(ptax) : 0;
      const sql = `
        INSERT INTO FECHAMENTO_RESULTADO (
          FR_ANO, FR_MES, FR_FILIAL, FR_GRUPO, FR_SUBGRUPO, FR_ITEM, FR_VALOR_BRL, FR_VALOR_USD, FR_PTAX
        ) VALUES (
          :ano, :mes, :filial, :grupo, :subgrupo, :item, :valor_brl, :valor_usd, :ptax
        )
      `;
      const binds = {
        ano, mes,
        filial: filial || 'CONSOLIDADO',
        grupo: grupo || '',
        subgrupo: subgrupo || '',
        item: item || '',
        valor_brl: Number(valor_brl || 0),
        valor_usd: valor_usd,
        ptax: Number(ptax || 1)
      };
      await db.execute(sql, binds, { autoCommit: true });
      res.json({ success: true, mensagem: 'Ajuste criado com sucesso' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // PUT /api/fechamento/ajustes/resultado/:id
  // ==========================================
  app.put('/api/fechamento/ajustes/resultado/:id', async (req, res) => {
    const { ano, mes, filial, grupo, subgrupo, item, valor_brl, ptax } = req.body;
    try {
      const valor_usd = (ptax && Number(ptax) > 0) ? Number(valor_brl) / Number(ptax) : 0;
      const sql = `
        UPDATE FECHAMENTO_RESULTADO SET
          FR_ANO = :ano, FR_MES = :mes, FR_FILIAL = :filial, FR_GRUPO = :grupo, 
          FR_SUBGRUPO = :subgrupo, FR_ITEM = :item, FR_VALOR_BRL = :valor_brl, 
          FR_VALOR_USD = :valor_usd, FR_PTAX = :ptax
        WHERE FR_ID = :id
      `;
      const binds = {
        ano, mes,
        filial: filial || 'CONSOLIDADO',
        grupo: grupo || '',
        subgrupo: subgrupo || '',
        item: item || '',
        valor_brl: Number(valor_brl || 0),
        valor_usd: valor_usd,
        ptax: Number(ptax || 1),
        id: req.params.id
      };
      await db.execute(sql, binds, { autoCommit: true });
      res.json({ success: true, mensagem: 'Ajuste atualizado com sucesso' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // DELETE /api/fechamento/ajustes/resultado/:id
  // ==========================================
  app.delete('/api/fechamento/ajustes/resultado/:id', async (req, res) => {
    try {
      const sql = `DELETE FROM FECHAMENTO_RESULTADO WHERE FR_ID = :id`;
      await db.execute(sql, { id: req.params.id }, { autoCommit: true });
      res.json({ success: true, mensagem: 'Ajuste removido com sucesso' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
  
  // ==========================================
  // GET /api/fechamento/resultado/detalhes
  // ==========================================
  // ==========================================
  // POST /api/fechamento/resultado/parametros
  // ==========================================
  app.post('/api/fechamento/resultado/parametros', async (req, res) => {
    const { ano, mes, val1, val2, val3, val4 } = req.body;
    try {
      // Remover os 4 itens específicos para este ano/mês
      const sqlDelete = `
        DELETE FROM FECHAMENTO_RESULTADO
        WHERE FR_ANO = :ano AND FR_MES = :mes
          AND (
            (FR_GRUPO = 'OPERAÇÕES DE IMOBILIZADO' AND FR_SUBGRUPO = 'VENDA DE IMOBILIZADO' AND FR_ITEM = '2 - Indenizações Recebidas (Seguros)') OR
            (FR_GRUPO = 'OPERAÇÕES DE IMOBILIZADO' AND FR_SUBGRUPO = 'DEPRECIAÇÕES' AND FR_ITEM = '1 - Depreciação de benfeitorias/instalações') OR
            (FR_GRUPO = 'OPERAÇÕES DE IMOBILIZADO' AND FR_SUBGRUPO = 'DEPRECIAÇÕES' AND FR_ITEM = '2 - Depreciação de Maquinas/Imp e Veiculos') OR
            (FR_GRUPO = 'OPERAÇÕES DE IMOBILIZADO' AND FR_SUBGRUPO = 'DEPRECIAÇÕES' AND FR_ITEM = '3 - Demais Depreciações')
          )
      `;
      await db.execute(sqlDelete, { ano, mes }, { autoCommit: true });

      // Inserir os novos valores
      const sqlInsert = `
        INSERT INTO FECHAMENTO_RESULTADO (FR_ANO, FR_MES, FR_FILIAL, FR_GRUPO, FR_SUBGRUPO, FR_ITEM, FR_VALOR_BRL, FR_VALOR_USD, FR_PTAX)
        VALUES (:ano, :mes, 'CONSOLIDADO', :grupo, :subgrupo, :item, :valor_brl, 0, 1)
      `;
      
      const insertPromises = [];
      
      if (Number(val1) !== 0) {
        insertPromises.push(db.execute(sqlInsert, {
          ano, mes, grupo: 'OPERAÇÕES DE IMOBILIZADO', subgrupo: 'VENDA DE IMOBILIZADO', item: '2 - Indenizações Recebidas (Seguros)', valor_brl: Number(val1)
        }, { autoCommit: true }));
      }
      if (Number(val2) !== 0) {
        insertPromises.push(db.execute(sqlInsert, {
          ano, mes, grupo: 'OPERAÇÕES DE IMOBILIZADO', subgrupo: 'DEPRECIAÇÕES', item: '1 - Depreciação de benfeitorias/instalações', valor_brl: Number(val2)
        }, { autoCommit: true }));
      }
      if (Number(val3) !== 0) {
        insertPromises.push(db.execute(sqlInsert, {
          ano, mes, grupo: 'OPERAÇÕES DE IMOBILIZADO', subgrupo: 'DEPRECIAÇÕES', item: '2 - Depreciação de Maquinas/Imp e Veiculos', valor_brl: Number(val3)
        }, { autoCommit: true }));
      }
      if (Number(val4) !== 0) {
        insertPromises.push(db.execute(sqlInsert, {
          ano, mes, grupo: 'OPERAÇÕES DE IMOBILIZADO', subgrupo: 'DEPRECIAÇÕES', item: '3 - Demais Depreciações', valor_brl: Number(val4)
        }, { autoCommit: true }));
      }

      await Promise.all(insertPromises);

      res.json({ success: true, mensagem: 'Parâmetros salvos com sucesso' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

};

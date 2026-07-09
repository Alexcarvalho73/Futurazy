const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '../server.js');
let content = fs.readFileSync(serverFile, 'utf8');

const codeToInsert = `
// ============================================================
// MÓDULO FECHAMENTO FINANCEIRO — CUSTOS INDIRETOS E DESPESAS
// ============================================================

function buildFinanceiroSQL() {
  return \`
    SELECT  
      TRIM(SUBSTR(SE5.E5_FILIAL, 3, 2)) AS EMPRESA,
      TRIM(SE5.E5_FILIAL) AS FILIAL,
      TO_DATE(SE5.E5_DTDISPO, 'yyyy/mm/dd') AS DATA_PAGAMENTO,
      CASE SE5.E5_RECPAG 
          WHEN 'P' THEN SE5.E5_VALOR * -1
          WHEN 'R' THEN SE5.E5_VALOR 
      END AS VALOR_R$,
      TRIM(substr(SE5.E5_CCD,1,2)) AS C_CUSTO,
      TRIM(cc.ctt_desc01) as CC_GRUPO,
      TRIM(cc2.ctt_desc01) as CC_SUBGRUPO,
      TRIM(ZA.ZA1_CODIGO) AS TP_GER,
      TRIM(ZA.ZA1_DESC) AS TIPO_GERENCIAL,
      TRIM(ZA.ZA1_CLASSI) AS CLAS,
      TRIM(SE5.E5_PREFIXO) AS PREFIXO,
      TRIM(SE5.E5_NUMERO) AS NUMERO,
      TRIM(SE5.E5_PARCELA) AS PARCELA,
      TRIM(SE5.E5_TIPO) AS TIPO,
      TRIM(SE5.E5_NATUREZ) AS NATUREZA,
      TRIM(SE5.E5_CLIFOR) AS CLI_FOR,
      TRIM(SE5.E5_BENEF) AS BENEF,
      TRIM(SE5.E5_HISTOR) AS HISTORICO_BAIXA,
      TRIM(SE5.E5_MOEDA) AS MOEDA,
      SM.M2_MOEDA2 AS PTAX,
      TRIM(SE5.E5_NUMCHEQ) AS NUMCHEQ,
      TRIM(SE5.E5_DOCUMEN) AS DOCUMEN,
      TRIM(SE5.E5_TIPODOC) AS TIPODOC,
      TRIM(SE5.E5_FILORIG) AS FILORIG,
      TRIM(SE5.E5_RECPAG) AS RECPAG,
      TRIM(SE5.E5_RECONC) AS RECONC,
      TRIM(SE5.E5_SEQ) AS SEQ,
      SE5.R_E_C_N_O_ AS REGSE5,
      TRIM(SE5.E5_BANCO) AS BANCO,
      TRIM(SE5.E5_AGENCIA) AS AGENCIA,
      TRIM(SE5.E5_CONTA) AS CONTA,
      TRIM(SE5.E5_CLVLDB) AS AGLOM,
      TRIM(SE5.E5_YPLPCO) AS SAFRA,
      SUBSTR(SE5.E5_DTDISPO, 1, 4) AS ANO,
      SUBSTR(SE5.E5_DTDISPO, 5, 2) AS MES,
      SUBSTR(SE5.E5_DTDISPO, 1, 6) AS ANO_MES
    FROM protheus11.SE5020 SE5
    LEFT JOIN protheus11.ctt020 cc
      ON cc.ctt_filial=SE5.E5_FILIAL
      and cc.ctt_custo = substr(SE5.E5_CCD,1,2)||'       '
      AND cc.D_E_L_E_T_ <> '*'
    LEFT JOIN protheus11.ctt020 cc2
      ON cc2.ctt_filial=SE5.E5_FILIAL
      and cc2.ctt_custo = SE5.E5_CCD
      AND cc2.D_E_L_E_T_ <> '*'
    LEFT JOIN protheus11.ZA1020 ZA
      ON ZA.ZA1_CODIGO = SE5.E5_TPGER
      AND ZA.D_E_L_E_T_ <> '*'
    LEFT JOIN protheus11.SED020 ED
      ON ED.ED_CODIGO = SE5.E5_NATUREZ
      AND ED.D_E_L_E_T_ <> '*'
    LEFT JOIN protheus11.SM2020 SM
      ON SM.M2_DATA = SE5.E5_DTDISPO - 1
      AND SM.D_E_L_E_T_ <> '*'
    WHERE SE5.E5_BANCO <> '   '
      AND SE5.E5_TIPODOC NOT IN ('DC','JR','MT','CM','D2','J2','M2','V2','C2','CP','TL','BA','I2','EI')
      AND NOT (
            SE5.E5_MOEDA IN ('C1','C2','C3','C4','C5','CH')
            AND SE5.E5_NUMCHEQ = '               '
            AND SE5.E5_TIPODOC NOT IN ('TR','TE')
      )
      AND NOT (
            SE5.E5_TIPODOC IN ('TR','TE')
            AND (
                  SE5.E5_NUMCHEQ BETWEEN '*              ' AND '*ZZZZZZZZZZZZZZ'
                  OR SE5.E5_DOCUMEN BETWEEN '*                ' AND '*ZZZZZZZZZZZZZZZZ'
            )
      )
      AND NOT (
            SE5.E5_TIPODOC IN ('TR','TE')
            AND SE5.E5_NUMERO = '      '
            AND SE5.E5_MOEDA NOT IN ('CC','CD','CH','CO','DOC','FI','R$','TB','TC','VL','DO')
      )
      AND SE5.E5_SITUACA <> 'C'
      AND SE5.E5_VALOR <> 0
      AND NOT(SE5.E5_NUMCHEQ BETWEEN '*              ' AND '*ZZZZZZZZZZZZZZ') 
      AND SE5.D_E_L_E_T_ = ' '
      AND TRIM(SUBSTR(SE5.E5_FILIAL, 1, 4)) IN ('0285')
      and SE5.E5_DTDISPO >= REPLACE(:data_de, '-', '')
      AND SE5.E5_DTDISPO <= REPLACE(:data_ate, '-', '')
      AND ZA.ZA1_CLASSI='3'
  \`;
}

app.get('/api/financeiro/dados', async (req, res) => {
  const { data_de, data_ate } = req.query;
  if (!data_de || !data_ate) {
    return res.status(400).json({ success: false, error: 'Faltando data_de ou data_ate' });
  }

  try {
    const binds = { data_de, data_ate };
    const sql = buildFinanceiroSQL();
    const rows = await db.execute(sql, binds);
    
    // Normalizar nulls
    rows.forEach(r => {
      r.CC_GRUPO = r.CC_GRUPO || 'SEM GRUPO';
      r.CC_SUBGRUPO = r.CC_SUBGRUPO || 'SEM SUBGRUPO';
      r.TIPO_GERENCIAL = r.TIPO_GERENCIAL || 'NÃO CLASSIFICADO';
    });

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('Erro /api/financeiro/dados:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/financeiro/fechados — lista registros de FECHAMENTO_FINANCEIRO
app.get('/api/financeiro/fechados', async (req, res) => {
  try {
    const { ano, mes } = req.query;
    let where = '';
    const binds = {};
    if (ano && mes) {
      where = 'WHERE FF_ANO = :ano AND FF_MES = :mes';
      binds.ano = ano;
      binds.mes = mes;
    }
    const rows = await db.execute(\`SELECT * FROM FECHAMENTO_FINANCEIRO \${where} ORDER BY FF_ANO DESC, FF_MES DESC\`, binds);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/financeiro/fechar-mes — grava fechamento
app.post('/api/financeiro/fechar-mes', async (req, res) => {
  const { ano, mes, dados } = req.body;
  if (!ano || !mes || !Array.isArray(dados)) {
    return res.status(400).json({ success: false, error: 'Faltam dados para fechamento.' });
  }

  try {
    await db.execute('DELETE FROM FECHAMENTO_FINANCEIRO WHERE FF_ANO = :ano AND FF_MES = :mes', { ano, mes }, { autoCommit: false });

    for (const d of dados) {
      const sql = \`
        INSERT INTO FECHAMENTO_FINANCEIRO (
          FF_ANO, FF_MES, FF_EMPRESA, FF_NEGOCIO, 
          FF_CC_GRUPO, FF_CC_SUBGRUPO, FF_VALOR_BRL, FF_PTAX
        ) VALUES (
          :ano, :mes, :empresa, :negocio, 
          :grupo, :subgrupo, :vlrBrl, :ptax
        )
      \`;
      const binds = {
        ano,
        mes,
        empresa: d.empresa || 'TOTAL',
        negocio: d.negocio || 'ND',
        grupo: d.grupo || 'ND',
        subgrupo: d.subgrupo || '',
        vlrBrl: d.vlrBrl || 0,
        ptax: d.ptax || 0
      };
      await db.execute(sql, binds, { autoCommit: false });
    }

    await db.execute('COMMIT', [], { autoCommit: true });
    res.json({ success: true, mensagem: \`Mês \${mes}/\${ano} fechado com sucesso!\` });
  } catch (err) {
    await db.execute('ROLLBACK', [], { autoCommit: true });
    console.error('Erro fechar-mes Financeiro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/financeiro/fechados/:ano/:mes — Reabrir mês
app.delete('/api/financeiro/fechados/:ano/:mes', async (req, res) => {
  const { ano, mes } = req.params;
  try {
    await db.execute('DELETE FROM FECHAMENTO_FINANCEIRO WHERE FF_ANO = :ano AND FF_MES = :mes', { ano, mes }, { autoCommit: true });
    res.json({ success: true, mensagem: \`Mês \${mes}/\${ano} reaberto com sucesso.\` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

`;

if (!content.includes('buildFinanceiroSQL')) {
  const target = 'async function startServer() {';
  const parts = content.split(target);
  if (parts.length === 2) {
    content = parts[0] + codeToInsert + '\n' + target + parts[1];
    fs.writeFileSync(serverFile, content, 'utf8');
    console.log('Financeiro API endpoints added to server.js');
  } else {
    console.log('Error injecting code');
  }
} else {
  console.log('Financeiro API already exists in server.js');
}

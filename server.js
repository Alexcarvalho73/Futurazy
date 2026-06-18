const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar o Express para servir arquivos estáticos na pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Rota de API para buscar os dados de tratos consumidos
app.get('/api/tratos', async (req, res) => {
  const sql = `
    SELECT 
      TRIM(NJH_DESPRO) as NJH_DESPRO,
      TRIM(NJH_NOMENT) as NJH_NOMENT,
      NJH_DATA,
      TRIM(NJH_PLACA) as NJH_PLACA,
      NJH_HORPS1,
      NJH_HORPS2,
      NJH_PSSUBT
    FROM protheus11.njh020
    WHERE NJH_FILIAL = '028501'
      AND NJH_STATUS = '3'
      AND d_e_l_e_t_ = ' '
    ORDER BY NJH_DATA DESC, NJH_HORPS1 DESC
  `;

  try {
    const rows = await db.execute(sql);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erro ao buscar dados do banco Oracle: ' + err.message });
  }
});

// Rota de API para buscar cabeçalhos de notas fiscais (com paginação e filtros)
app.get('/api/notas', async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  
  const status = req.query.status || 'pendente';
  const filial = req.query.filial || '';
  const fornecedor = req.query.fornecedor || '';
  const numnf = req.query.numnf || '';
  const emissao_de = req.query.emissao_de || '';
  const emissao_ate = req.query.emissao_ate || '';
  const vencimento_de = req.query.vencimento_de || '';
  const vencimento_ate = req.query.vencimento_ate || '';
  const search = req.query.search || '';

  const maxRow = page * limit;
  const minRow = (page - 1) * limit;

  let whereClause = `
    WHERE XM.D_E_L_E_T_ = ' '
      AND NOT EXISTS (
        SELECT 1 FROM PROTHEUS11.SFT020 FT 
        WHERE FT.D_E_L_E_T_ = ' ' 
          AND FT.FT_CHVNFE = XM.XML_CHAVE 
          AND FT.FT_TIPOMOV = 'E'
      )
  `;
  const binds = {};

  // Status do Documento
  if (status === 'normal') {
    whereClause += " AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) NOT IN ('T', 'F') AND (TRIM(XM.XML_OK) IS NULL OR TRIM(XM.XML_OK) <> 'NP')";
  } else if (status === 'cte_cif') {
    whereClause += " AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND (TRIM(XM.XML_CTEFOB) IS NULL OR TRIM(XM.XML_CTEFOB) <> 'S')";
  } else if (status === 'cte_fob') {
    whereClause += " AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'T' AND TRIM(XM.XML_CTEFOB) = 'S'";
  } else if (status === 'prenota') {
    whereClause += " AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) <> 'T' AND TRIM(XM.XML_OK) = 'NP'";
  } else if (status === 'compl') {
    whereClause += " AND TRIM(XM.XML_REJEIT) IS NULL AND TRIM(XM.XML_TIPODC) = 'F'";
  } else if (status === 'rejeitada') {
    whereClause += " AND TRIM(XM.XML_REJEIT) IS NOT NULL";
  }

  // Filial
  if (filial) {
    whereClause += " AND TRIM(XM.XML_FIL) = :filial";
    binds.filial = filial.trim();
  }

  // Fornecedor (Nome ou CNPJ)
  if (fornecedor) {
    whereClause += " AND (XM.XML_EMIT LIKE :fornecedor OR UPPER(XM.XML_NOMEMT) LIKE :fornecedor)";
    binds.fornecedor = `%${fornecedor.trim().toUpperCase()}%`;
  }

  // Número NF
  if (numnf) {
    whereClause += " AND XM.XML_NUMNF LIKE :numnf";
    binds.numnf = `%${numnf.trim()}%`;
  }

  // Datas de Emissão
  if (emissao_de) {
    whereClause += " AND XM.XML_EMISSA >= :emissao_de";
    binds.emissao_de = emissao_de.replace(/-/g, '');
  }
  if (emissao_ate) {
    whereClause += " AND XM.XML_EMISSA <= :emissao_ate";
    binds.emissao_ate = emissao_ate.replace(/-/g, '');
  }

  // Datas de Vencimento
  if (vencimento_de) {
    whereClause += " AND XM.XML_DTRVLD >= :vencimento_de";
    binds.vencimento_de = vencimento_de.replace(/-/g, '');
  }
  if (vencimento_ate) {
    whereClause += " AND XM.XML_DTRVLD <= :vencimento_ate";
    binds.vencimento_ate = vencimento_ate.replace(/-/g, '');
  }

  // Busca Geral (mantida para compatibilidade e flexibilidade)
  if (search) {
    whereClause += " AND (XM.XML_NUMNF LIKE :search OR UPPER(XM.XML_NOMEMT) LIKE :search OR XM.XML_CHAVE LIKE :search)";
    binds.search = `%${search.trim().toUpperCase()}%`;
  }

  const countSql = `
    SELECT COUNT(*) as TOTAL 
    FROM PROTHEUS11.CONDORXML XM
    ${whereClause}
  `;

  const querySql = `
    SELECT * FROM (
      SELECT a.*, ROWNUM rnum FROM (
        SELECT 
          XM.XML_CHAVE,
          TRIM(XM.XML_NUMNF) as XML_NUMNF,
          TRIM(XM.XML_NOMEMT) as XML_NOMEMT,
          XM.XML_EMISSA,
          XM.XML_RECEB,
          XM.XML_DTRVLD,
          XM.XML_VLRDOC,
          TRIM(XM.XML_TIPODC) as XML_TIPODC,
          TRIM(XM.XML_OK) as XML_OK,
          TRIM(XM.XML_REJEIT) as XML_REJEIT,
          TRIM(XM.XML_CTEFOB) as XML_CTEFOB,
          CASE 
            WHEN REGEXP_LIKE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), '^[0-9]{8}$') 
            THEN ROUND(SYSDATE - TO_DATE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), 'YYYYMMDD'))
            ELSE NULL 
          END as DIAS
        FROM PROTHEUS11.CONDORXML XM
        ${whereClause}
        ORDER BY DIAS DESC NULLS LAST
      ) a WHERE ROWNUM <= :maxRow
    ) WHERE rnum > :minRow
  `;

  try {
    const totalRows = await db.execute(countSql, binds);
    const total = totalRows[0]?.TOTAL || 0;

    const queryBinds = { ...binds, maxRow, minRow };
    const rows = await db.execute(querySql, queryBinds);
    res.json({
      success: true,
      page,
      limit,
      total,
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erro ao buscar notas fiscais: ' + err.message });
  }
});

// Rota de API para buscar itens de uma nota fiscal específica (filtrada por XML_CHAVE)
app.get('/api/notas/:chave/itens', async (req, res) => {
  const { chave } = req.params;

  // SQL baseada na query do usuário, mas adaptada para trazer apenas uma chave e com as colunas do item
  const sql = `
    SELECT 
      XML_EMP, XML_FIL, FT_EMISSAO, FT_ENTRADA, FT_NFISCAL, XML_TIPODC, FT_TIPO, FT_ESPECIE, XML_DEST, XML_IEDEST, XML_NOMEDT, XML_MUNDT, XML_CHAVE, XML_EMIT, XML_NOMEMT, XML_MUNMT, XML_CODLOJ, XML_EMISSA,
      XML_NUMNF, XML_NATOPE, 
      TRIM(XIT_ITEM) as XIT_ITEM, 
      TRIM(XIT_CODNFE) as XIT_CODNFE, 
      TRIM(XIT_PEDIDO) as XIT_PEDIDO, 
      TRIM(XIT_ITEMPC) as XIT_ITEMPC, 
      TRIM(XIT_OK) as XIT_OK, 
      TRIM(XIT_UMNFE) as XIT_UMNFE, 
      XIT_PRCNFE,
      TRIM(FT_PRODUTO) as FT_PRODUTO, 
      TRIM(XIT_DESCRI) as XIT_DESCRI, 
      D1_NFORI, XIT_CFNFE, FT_TES, FT_CFOP, XIT_NCM, FT_POSIPI, XIT_QTENFE, FT_QUANT, XIT_TOTNFE, FT_TOTAL, FT_DESPESA, FT_SEGURO,
      FT_FRETE, FT_VALPEDG, XIT_CSTORI, XIT_BASICM, XIT_PICM, XIT_VALICM, XIT_PREDBC, FT_CLASFIS, FT_BASEICM, FT_ALIQICM, FT_VALICM, FT_ISENICM, FT_OUTRICM, FT_OBSICM, D1_VALICM, D1_ICMSCOM, XIT_BASRET,
      XIT_PMVA, XIT_PICMST, XIT_VALRET, XIT_BRETAN, XIT_VRETAN, XIT_ICMSUB, XIT_PRETST, FT_BASERET, FT_MARGEM, FT_ICMSRET, FT_OBSSOL, FT_SOLTRIB, XIT_CSTIPI, XIT_BASIPI, XIT_PIPI, XIT_VALIPI, FT_CTIPI,
      FT_BASEIPI, FT_VALIPI, FT_ISENIPI, FT_OUTRIPI, D1_VALIPI, XIT_CSTPIS, XIT_BASPIS, XIT_PPIS, XIT_VALPIS, FT_CSTPIS, FT_BASEPIS, FT_ALIQPIS, FT_VALPIS, XIT_CSTCOF, XIT_BASCOF, XIT_PCOF, XIT_VALCOF,
      FT_CSTCOF, FT_BASECOF, FT_ALIQCOF, FT_VALCOF, FT_BASEIRR, FT_ALIQIRR, FT_VALIRR, FT_BRETCOF, FT_ARETCOF, FT_VRETCOF, FT_BRETPIS, FT_ARETPIS, FT_VRETPIS, FT_BRETCSL, FT_ARETCSL, FT_VRETCSL, XML_VRETIR,
      XML_VRETCF, XML_VRETPS, XML_VRETCS, XIT_KEYSD1, XML_KEYF1, XML_CONFCO, XML_CONFIS, XML_DTRCTO, XML_DTENTG, COALESCE(FT.R_E_C_N_O_,0) FTRECNO   
    FROM PROTHEUS11.CONDORXMLITENS XI  
    INNER JOIN PROTHEUS11.CONDORXML XM   ON XM.D_E_L_E_T_ =' '   
                             AND XML_CHAVE = XIT_CHAVE   
    LEFT JOIN PROTHEUS11.SFT020 FT       ON FT.D_E_L_E_T_ =' '   
                             AND FT_CHVNFE = XIT_CHAVE    
                             AND FT_TIPOMOV = 'E'    
                             AND ((FT_FILIAL = SUBSTR(XIT_KEYSD1,1,2)    
                             AND FT_NFISCAL = SUBSTR(XIT_KEYSD1,3,9)    
                             AND FT_SERIE = SUBSTR(XIT_KEYSD1,12,3)    
                             AND FT_CLIEFOR = SUBSTR(XIT_KEYSD1,15,6)    
                             AND FT_LOJA = SUBSTR(XIT_KEYSD1,21,2)    
                             AND FT_PRODUTO = SUBSTR(XIT_KEYSD1,23,15)    
                             AND FT_ITEM = SUBSTR(XIT_KEYSD1,38,4)     ) 
                             OR     (FT_FILIAL = SUBSTR(XML_KEYF1,1,2)    
                             AND FT_NFISCAL = SUBSTR(XML_KEYF1,3,9)    
                             AND FT_SERIE = SUBSTR(XML_KEYF1,12,3)    
                             AND FT_CLIEFOR = SUBSTR(XML_KEYF1,15,6)    
                             AND FT_LOJA = SUBSTR(XML_KEYF1,21,2)    
                             AND FT_ITEM = XIT_ITEM AND XIT_KEYSD1 = ' ' ))     
                             AND FT_ESPECIE = 'SPED'     
                             AND FT_FILIAL = '01'     
                             AND FT_CFOP <='5'    
                             AND FT_FORMUL NOT IN('S')  
    LEFT JOIN PROTHEUS11.SD1020 D1     ON D1.D_E_L_E_T_ =' '    
                             AND D1_FILIAL = '01'     
                             AND D1_DOC = FT_NFISCAL     
                             AND D1_SERIE = FT_SERIE     
                             AND D1_FORNECE = FT_CLIEFOR     
                             AND D1_LOJA = FT_LOJA     
                             AND D1_COD = FT_PRODUTO     
                             AND D1_ITEM = FT_ITEM    
    WHERE XI.D_E_L_E_T_ = ' '     
      AND XML_CHAVE = :chave
      AND XML_DEST <> XML_EMIT  
    
    UNION ALL  
    
    SELECT 
      XML_EMP, XML_FIL, FT_EMISSAO, FT_ENTRADA, FT_NFISCAL, XML_TIPODC, FT_TIPO, FT_ESPECIE, XML_DEST, XML_IEDEST, XML_NOMEDT, XML_MUNDT, XML_CHAVE, XML_EMIT, XML_NOMEMT, XML_MUNMT, XML_CODLOJ,
      XML_EMISSA, XML_NUMNF, XML_NATOPE, 
      TRIM(FT_ITEM) AS XIT_ITEM, 
      ' ' AS XIT_CODNFE, 
      ' ' AS XIT_PEDIDO, 
      ' ' AS XIT_ITEMPC, 
      ' ' AS XIT_OK, 
      ' ' AS XIT_UMNFE, 
      0 AS XIT_PRCNFE,
      TRIM(FT_PRODUTO) as FT_PRODUTO, 
      TRIM(XIM_PRPRED) as XIT_DESCRI, 
      D1_NFORI, XML_NATOPE XIT_CFNFE, FT_TES, FT_CFOP, ' ' XIT_NCM,
      FT_POSIPI, 0 AS XIT_QTENFE, FT_QUANT, XML_VLRDOC AS XIT_TOTNFE, FT_TOTAL, FT_DESPESA, FT_SEGURO, FT_FRETE, FT_VALPEDG, XIM_CST XIT_CSTORI, XIM_BASICM AS XIT_BASICM, XIM_ALQICM AS XIT_PICM,
      XIM_VALICM AS XIT_VALICM, XIM_PICRED AS XIT_PREDBC, FT_CLASFIS, FT_BASEICM, FT_ALIQICM, FT_VALICM, FT_ISENICM, FT_OUTRICM, FT_OBSICM, D1_VALICM, D1_ICMSCOM, XIM_BRICMS AS XIT_BASRET,
      0 AS XIT_PMVA, XIM_PICRET AS XIT_PICMST, XIM_ICMRET AS XIT_VALRET, 0 AS XIT_BRETAN, 0 AS XIT_VRETAN, 0 AS XIT_ICMSUB, 0 AS XIT_PRETST, FT_BASERET, FT_MARGEM, FT_ICMSRET, FT_OBSSOL, FT_SOLTRIB,
      ' ' AS XIT_CSTIPI, 0 AS XIT_BASIPI, 0 AS XIT_PIPI, 0 AS XIT_VALIPI, FT_CTIPI, FT_BASEIPI, FT_VALIPI, FT_ISENIPI, FT_OUTRIPI, D1_VALIPI, ' ' AS XIT_CSTPIS, 0 AS XIT_BASPIS, 0 AS XIT_PPIS,
      0 AS XIT_VALPIS, FT_CSTPIS, FT_BASEPIS, FT_ALIQPIS, FT_VALPIS, ' ' AS XIT_CSTCOF, 0 AS XIT_BASCOF, 0 AS XIT_PCOF, 0 AS XIT_VALCOF, FT_CSTCOF, FT_BASECOF, FT_ALIQCOF, FT_VALCOF, FT_BASEIRR,
      FT_ALIQIRR, FT_VALIRR, FT_BRETCOF, FT_ARETCOF, FT_VRETCOF, FT_BRETPIS, FT_ARETPIS, FT_VRETPIS, FT_BRETCSL, FT_ARETCSL, FT_VRETCSL, XML_VRETIR, XML_VRETCF, XML_VRETPS, XML_VRETCS, ' ' AS XIT_KEYSD1,
      XML_KEYF1, XML_CONFCO, XML_CONFIS, XML_DTRCTO, XML_DTENTG, COALESCE(FT.R_E_C_N_O_,0) FTRECNO   
    FROM PROTHEUS11.CONDORXML XM   
    LEFT JOIN PROTHEUS11.SFT020 FT     ON FT.D_E_L_E_T_ =' '   
                           AND FT_CHVNFE = XML_CHAVE    
                           AND FT_TIPOMOV = 'E'    
                           AND FT_FILIAL = SUBSTR(XML_KEYF1,1,2)    
                           AND FT_NFISCAL = SUBSTR(XML_KEYF1,3,9)    
                           AND FT_SERIE = SUBSTR(XML_KEYF1,12,3)    
                           AND FT_CLIEFOR = SUBSTR(XML_KEYF1,15,6)    
                           AND FT_LOJA = SUBSTR(XML_KEYF1,21,2)     
                           AND FT_ESPECIE = 'CTE'     
                           AND FT_FILIAL = '01'     
                           AND FT_CFOP <='5'    
                           AND FT_FORMUL NOT IN('S')   
    LEFT JOIN PROTHEUS11.SD1020 D1      ON D1.D_E_L_E_T_ =' '    
                           AND D1_FILIAL = SUBSTR(XML_KEYF1,1,2)     
                           AND D1_DOC = SUBSTR(XML_KEYF1,3,9)    
                           AND D1_SERIE = SUBSTR(XML_KEYF1,12,3)     
                           AND D1_FORNECE = SUBSTR(XML_KEYF1,15,6)     
                           AND D1_LOJA = SUBSTR(XML_KEYF1,21,2)     
                           AND D1_COD = FT_PRODUTO     
                           AND D1_ITEM = FT_ITEM   
    INNER JOIN PROTHEUS11.CONDORCTEIMPOSTO XC      ON XC.D_E_L_E_T_ = ' '     
                             AND XIM_CHAVE = XML_CHAVE  
    WHERE XM.D_E_L_E_T_ = ' '     
      AND XML_CHAVE = :chave
      AND XML_DEST <> XML_EMIT
  `;

  try {
    const rows = await db.execute(sql, { chave });
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erro ao buscar itens da nota fiscal: ' + err.message });
  }
});

// Inicialização do Servidor e do Pool de Banco de Dados
async function startServer() {
  try {
    await db.initialize();
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Falha ao iniciar o servidor:', err);
    process.exit(1);
  }
}

// Fechamento limpo do pool ao encerrar a aplicação
process.on('SIGINT', async () => {
  console.log('Encerrando servidor...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Encerrando servidor...');
  await db.close();
  process.exit(0);
});

startServer();

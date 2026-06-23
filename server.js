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

  const status = req.query.status || 'todos';
  const fluxo = req.query.fluxo || 'pendentes';
  const filial = req.query.filial || '';
  const fornecedor = req.query.fornecedor || '';
  const numnf = req.query.numnf || '';
  const emissao_de = req.query.emissao_de || '';
  const emissao_ate = req.query.emissao_ate || '';
  const vencimento_de = req.query.vencimento_de || '';
  const vencimento_ate = req.query.vencimento_ate || '';
  const search = req.query.search || '';
  const xml_confco = req.query.xml_confco || 'todos';

  const maxRow = page * limit;
  const minRow = (page - 1) * limit;

  const baseQuery = `
    SELECT XM.*,
      CASE
        WHEN XML_STATUS = 'Lançada' THEN 'Concluido'
        ELSE 'Pendente'
      END as XML_CATEGORIA
    FROM (
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
        XM.XML_FIL,
        XM.XML_EMIT,
        XM.XML_DEST,
        XM.XML_TPNF,
        XM.D_E_L_E_T_,
        XM.XML_CONFCO,
        -- Lógica de Filial Calculada
        CASE
          WHEN TRIM(XM.XML_FIL) IS NOT NULL AND TRIM(XM.XML_FIL) <> ' ' THEN TRIM(XM.XML_FIL)
          ELSE
            CASE
              WHEN TRIM(XM.XML_DEST) = '03613104121' AND TRIM(XM.XML_IEDEST) = '00000137398557' THEN '028501'
              WHEN TRIM(XM.XML_DEST) = '03613104121' AND TRIM(XM.XML_IEDEST) = '00000138284679' THEN '028503'
              WHEN TRIM(XM.XML_DEST) = '03613104121' AND TRIM(XM.XML_IEDEST) = '00000140259694' THEN '028505'
              WHEN TRIM(XM.XML_DEST) = '10158356001850' THEN '028503'
              WHEN TRIM(XM.XML_DEST) = '00073769100' AND TRIM(XM.XML_IEDEST) = '00000136631533' THEN '026702'
              WHEN TRIM(XM.XML_DEST) = '00073769100' AND TRIM(XM.XML_IEDEST) = '00000137276877' THEN '026703'
              WHEN TRIM(XM.XML_DEST) = '01847197981' AND TRIM(XM.XML_IEDEST) = '00000156158299' THEN '027902'
              WHEN TRIM(XM.XML_DEST) = '01847197981' AND TRIM(XM.XML_IEDEST) = '00000138682615' THEN '027903'
              WHEN TRIM(XM.XML_DEST) = '01847197981' AND TRIM(XM.XML_IEDEST) = '00000138938385' THEN '027904'
              WHEN TRIM(XM.XML_DEST) = '02076338195' AND TRIM(XM.XML_IEDEST) = '00000133192814' THEN '026601'
              WHEN TRIM(XM.XML_DEST) = '02076338195' AND TRIM(XM.XML_IEDEST) = '00000135809797' THEN '026602'
              WHEN TRIM(XM.XML_DEST) = '45909369172' AND TRIM(XM.XML_IEDEST) = '00000133256375' THEN '026001'
              WHEN TRIM(XM.XML_DEST) = '45909369172' AND TRIM(XM.XML_IEDEST) = '00000135467128' THEN '025801'
              WHEN TRIM(XM.XML_DEST) = '52392236968' AND TRIM(XM.XML_IEDEST) = '00000134652029' THEN '026901'
              WHEN TRIM(XM.XML_DEST) = '52392236968' AND TRIM(XM.XML_IEDEST) = '00000137527888' THEN '026903'
              WHEN TRIM(XM.XML_DEST) = '94178020110' AND TRIM(XM.XML_IEDEST) = '00000132179806' THEN '026101'
              WHEN TRIM(XM.XML_DEST) = '94178020110' AND TRIM(XM.XML_IEDEST) = '00000137120680' THEN '028101'
              WHEN TRIM(XM.XML_DEST) = '96945524949' AND TRIM(XM.XML_IEDEST) = '00000132874130' THEN '026201'
              WHEN TRIM(XM.XML_DEST) = '96945524949' AND TRIM(XM.XML_IEDEST) = '00000137299320' THEN '026202'
              WHEN TRIM(XM.XML_DEST) = '88211487187' AND TRIM(XM.XML_IEDEST) = '00000137273029' THEN '028401'
              WHEN TRIM(XM.XML_DEST) = '88211487187' THEN '020801'
              WHEN TRIM(XM.XML_DEST) = '06889621000154' THEN '010101'
              WHEN TRIM(XM.XML_DEST) = '58510168920' THEN '025902'
              WHEN TRIM(XM.XML_DEST) = '99470195191' THEN '026403'
              WHEN TRIM(XM.XML_DEST) = '01058947109' THEN '026501'
              WHEN TRIM(XM.XML_DEST) = '53733665104' THEN '028202'
              WHEN TRIM(XM.XML_DEST) = '02971375145' THEN '028601'
              ELSE NULL
            END
        END as XML_FIL_CALC,
        CASE  
          WHEN XM.XML_REJEIT <> ' ' THEN 'Rejeitada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <> ' ' AND XM.XML_DTRCTO <> ' ' THEN 'Lançada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_DTRCTO <> ' ' AND XM.XML_CONFCO = ' ' THEN 'Lançada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_DTRCTO <> ' ' AND XM.XML_CONFCO = ' ' THEN 'Pré-Nota'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_DTRCTO <> ' ' THEN 'Pré-Nota'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' AND XM.XML_CONFCO <> ' ' THEN 'Lançada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %' AND XM.XML_CONFCO <> ' ' THEN 'Pré-Nota'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%|A%' THEN 'Lançada'
          WHEN XM.XML_KEYF1 <> ' ' AND XM.XML_KEYF1 LIKE '%| %'  THEN 'Pré-Nota'
          WHEN XM.XML_KEYF1 <> ' ' THEN 'Lançada'
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'B' THEN 'Benef.Aberto' 
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'S' THEN 'Em Aberto' 
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'D' THEN 'Dev.Venda Aberto' 
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'F' THEN 'CT-e Aberto' 
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_TIPODC = 'T' THEN 'CT-e Aberto' 
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO = ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO  = ' ' AND XM.XML_TIPODC = 'N' THEN 'Em Aberto' 
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO = ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS <>  ' ' AND XM.XML_DTRCTO = ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFIS = ' ' AND XM.XML_DTRCTO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_DTRCTO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
          WHEN XM.XML_KEYF1 = ' ' AND XM.XML_CONFCO <> ' ' AND XM.XML_TIPODC = 'N'  THEN 'Em Aberto'
          ELSE 
            'Sem Definição'
        END as XML_STATUS
      FROM PROTHEUS11.CONDORXML XM
      WHERE XM.D_E_L_E_T_ = ' '
        AND (XM.XML_TIPODC IN ('T', 'F') OR XM.XML_TPNF NOT IN ('0'))
        AND XM.XML_DEST <> XM.XML_EMIT
        AND XM.XML_EMISSA >= '20240601'
    ) XM
  `;

  let baseWhere = ' WHERE 1 = 1';
  const baseBinds = {};

  // Filial
  if (filial) {
    baseWhere += " AND XM.XML_FIL_CALC = :filial";
    baseBinds.filial = filial.trim();
  }

  // Fornecedor (Nome ou CNPJ)
  if (fornecedor) {
    baseWhere += " AND (XM.XML_EMIT LIKE :fornecedor OR UPPER(XM.XML_NOMEMT) LIKE :fornecedor)";
    baseBinds.fornecedor = `%${fornecedor.trim().toUpperCase()}%`;
  }

  // Número NF
  if (numnf) {
    baseWhere += " AND XM.XML_NUMNF LIKE :numnf";
    baseBinds.numnf = `%${numnf.trim()}%`;
  }

  // Datas de Emissão
  if (emissao_de) {
    baseWhere += " AND XM.XML_EMISSA >= :emissao_de";
    baseBinds.emissao_de = emissao_de.replace(/-/g, '');
  }
  if (emissao_ate) {
    baseWhere += " AND XM.XML_EMISSA <= :emissao_ate";
    baseBinds.emissao_ate = emissao_ate.replace(/-/g, '');
  }

  // Datas de Vencimento
  if (vencimento_de) {
    baseWhere += " AND XM.XML_DTRVLD >= :vencimento_de";
    baseBinds.vencimento_de = vencimento_de.replace(/-/g, '');
  }
  if (vencimento_ate) {
    baseWhere += " AND XM.XML_DTRVLD <= :vencimento_ate";
    baseBinds.vencimento_ate = vencimento_ate.replace(/-/g, '');
  }

  // Busca Geral
  if (search) {
    baseWhere += " AND (XM.XML_NUMNF LIKE :search OR UPPER(XM.XML_NOMEMT) LIKE :search OR XM.XML_CHAVE LIKE :search)";
    baseBinds.search = `%${search.trim().toUpperCase()}%`;
  }

  // Filtro de Conferência Comercial (xml_confco)
  if (xml_confco === 'sim') {
    baseWhere += " AND XM.XML_CONFCO <> ' ' AND XM.XML_CONFCO IS NOT NULL";
  } else if (xml_confco === 'nao') {
    baseWhere += " AND (XM.XML_CONFCO = ' ' OR XM.XML_CONFCO IS NULL)";
  }

  // Query de Totalizadores para os KPI Cards
  const summarySql = `
    SELECT 
      SUM(CASE WHEN XML_CATEGORIA = 'Pendente' THEN 1 ELSE 0 END) as PENDENTES,
      SUM(CASE WHEN XML_CATEGORIA = 'Concluido' THEN 1 ELSE 0 END) as CONCLUIDOS
    FROM (${baseQuery}) XM
    ${baseWhere}
  `;

  // Query do total de registros paginados
  let whereClause = baseWhere;
  const listBinds = { ...baseBinds };

  // Filtro de Fluxo (Categoria)
  if (fluxo === 'pendentes') {
    whereClause += " AND XM.XML_CATEGORIA = 'Pendente'";
  } else if (fluxo === 'concluidos') {
    whereClause += " AND XM.XML_CATEGORIA = 'Concluido'";
  }

  // Filtro de Status Específico
  if (status && status !== 'todos') {
    whereClause += " AND XM.XML_STATUS = :status";
    listBinds.status = status;
  }

  const countSql = `
    SELECT COUNT(*) as TOTAL 
    FROM (${baseQuery}) XM
    ${whereClause}
  `;

  const querySql = `
    SELECT * FROM (
      SELECT a.*, ROWNUM rnum FROM (
        SELECT 
          XM.XML_CHAVE,
          XM.XML_NUMNF,
          XM.XML_NOMEMT,
          XM.XML_EMISSA,
          XM.XML_RECEB,
          XM.XML_DTRVLD,
          XM.XML_VLRDOC,
          XM.XML_TIPODC,
          XM.XML_OK,
          XM.XML_REJEIT,
          XM.XML_CTEFOB,
          XM.XML_STATUS,
          XM.XML_CATEGORIA,
          XM.XML_FIL_CALC,
          CASE 
            WHEN REGEXP_LIKE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), '^[0-9]{8}$') 
            THEN ROUND(SYSDATE - TO_DATE(TRIM(COALESCE(TRIM(XM.XML_RECEB), XM.XML_EMISSA)), 'YYYYMMDD'))
            ELSE NULL 
          END as DIAS
        FROM (${baseQuery}) XM
        ${whereClause}
        ORDER BY DIAS DESC NULLS LAST
      ) a WHERE ROWNUM <= :maxRow
    ) WHERE rnum > :minRow
  `;

  try {
    // Executar a query de resumo/totalizadores
    const summaryRows = await db.execute(summarySql, baseBinds);
    const totalPendentes = summaryRows[0]?.PENDENTES || 0;
    const totalConcluidos = summaryRows[0]?.CONCLUIDOS || 0;

    // Executar a contagem da lista filtrada
    const totalRows = await db.execute(countSql, listBinds);
    const total = totalRows[0]?.TOTAL || 0;

    // Executar a query paginada da lista
    const queryBinds = { ...listBinds, maxRow, minRow };
    const rows = await db.execute(querySql, queryBinds);

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPendentes,
      totalConcluidos,
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
      D1_NFORI, XIT_CFNFE, FT_TES, FT_CFOP, TRIM(D1_TES) as D1_TES, TRIM(D1_CF) as D1_CF, XIT_NCM, FT_POSIPI, XIT_QTENFE, FT_QUANT, XIT_TOTNFE, FT_TOTAL, FT_DESPESA, FT_SEGURO,
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
                             AND ((FT_FILIAL = SUBSTR(XIT_KEYSD1,1,6)    
                             AND FT_NFISCAL = SUBSTR(XIT_KEYSD1,7,9)    
                             AND FT_SERIE = SUBSTR(XIT_KEYSD1,16,3)    
                             AND FT_CLIEFOR = SUBSTR(XIT_KEYSD1,19,6)    
                             AND FT_LOJA = SUBSTR(XIT_KEYSD1,25,2)    
                             AND FT_PRODUTO = SUBSTR(XIT_KEYSD1,27,15)    
                             AND FT_ITEM = SUBSTR(XIT_KEYSD1,42,4)     ) 
                             OR     (FT_FILIAL = SUBSTR(XML_KEYF1,1,6)    
                             AND FT_NFISCAL = SUBSTR(XML_KEYF1,7,9)    
                             AND FT_SERIE = SUBSTR(XML_KEYF1,16,3)    
                             AND FT_CLIEFOR = SUBSTR(XML_KEYF1,19,6)    
                             AND FT_LOJA = SUBSTR(XML_KEYF1,25,2)    
                             AND FT_ITEM = XIT_ITEM AND XIT_KEYSD1 = ' ' ))     
                             AND FT_ESPECIE = 'SPED'     
                             AND FT_FILIAL = TRIM(XM.XML_FIL)     
                             AND FT_CFOP <='5'    
                             AND FT_FORMUL NOT IN('S')  
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
      D1_NFORI, XML_NATOPE XIT_CFNFE, FT_TES, FT_CFOP, TRIM(D1_TES) as D1_TES, TRIM(D1_CF) as D1_CF, ' ' XIT_NCM,
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
                           AND FT_FILIAL = SUBSTR(XML_KEYF1,1,6)    
                           AND FT_NFISCAL = SUBSTR(XML_KEYF1,7,9)    
                           AND FT_SERIE = SUBSTR(XML_KEYF1,16,3)    
                           AND FT_CLIEFOR = SUBSTR(XML_KEYF1,19,6)    
                           AND FT_LOJA = SUBSTR(XML_KEYF1,25,2)     
                           AND FT_ESPECIE = 'CTE'     
                           AND FT_FILIAL = TRIM(XM.XML_FIL)     
                           AND FT_CFOP <='5'    
                           AND FT_FORMUL NOT IN('S')   
    LEFT JOIN PROTHEUS11.SD1020 D1      ON D1.D_E_L_E_T_ =' '    
                           AND D1_FILIAL = TRIM(XM.XML_FIL)     
                           AND D1_DOC = SUBSTR(XML_KEYF1,7,9)    
                           AND D1_SERIE = SUBSTR(XML_KEYF1,16,3)     
                           AND D1_FORNECE = SUBSTR(XML_KEYF1,19,6)     
                           AND D1_LOJA = SUBSTR(XML_KEYF1,25,2)     
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

// ============================================================
// MÓDULO FECHAMENTO FINANCEIRO — RECEITAS
// ============================================================

// SQL principal de Receitas (UNION Saídas + Entradas) com cotação do dólar (M2_MOEDA2)
// Estrutura em 3 camadas:
//   1. UNION interno (distinct): dados brutos SF2020 + SF1020
//   2. Camada intermediária: busca COTACAO_DOLAR via scalar subquery em SM2020
//      Regra: busca M2_MOEDA2 com M2_DATA <= (data_nf - 1 dia), ORDER BY DESC → ROWNUM = 1
//      Assim garante fallback automático para qualquer dia anterior com cotação disponível.
// NOTA: SM2020.M2_DATA assumido em formato 'YYYYMMDD' (VARCHAR2). Se for tipo DATE, remover to_char().
// NOTA: SM2020.M2_MOEDA2 é o campo da cotação do Dólar. Verifique o nome correto no banco se necessário.
function buildReceitaSQL() {
  return `
    SELECT OUTER_Q.*,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.TOTAL       / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS TOTAL_USD,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VLR_FACS    / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS VLR_FACS_USD,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VLR_FETHAB  / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS VLR_FETHAB_USD,
      CASE WHEN OUTER_Q.COTACAO_DOLAR > 0 THEN OUTER_Q.VL_FUNRURAL / OUTER_Q.COTACAO_DOLAR ELSE NULL END AS VL_FUNRURAL_USD
    FROM (
      SELECT MID_Q.*,
        (SELECT PTAX FROM (
           SELECT SM.M2_MOEDA2 AS PTAX
           FROM protheus11.SM2020 SM
           WHERE SM.M2_DATA <= to_char(MID_Q.EMISSAO - 1,'yyyymmdd')
             AND SM.D_E_L_E_T_ <> '*'
           ORDER BY SM.M2_DATA DESC
         ) WHERE ROWNUM = 1) AS COTACAO_DOLAR
      FROM (
        SELECT distinct
          f2_filial                             AS EMPRESA,
          CASE 
            WHEN LENGTH(TRIM(F2_EMISSAO)) = 8 AND F2_EMISSAO <> '00000000' AND F2_EMISSAO <> '        ' AND REGEXP_LIKE(F2_EMISSAO, '^[0-9]{8}$')
            THEN TO_DATE(F2_EMISSAO, 'yyyymmdd')
            ELSE NULL
          END                                   AS EMISSAO,
          TRIM(F2_DOC)                           AS NF,
          decode(f2_tipo,'D',
            (select SUBSTR(a2.a2_nome,1,30) from protheus11.sa2020 a2
              where a2.a2_cod=f2_cliente and a2.a2_loja=f2_loja and a2.d_e_l_e_t_<>'*'),
            (select SUBSTR(a1.a1_nome,1,30) from protheus11.sa1020 a1
              where a1.a1_cod=f2_cliente and a1.a1_loja=f2_loja and a1.d_e_l_e_t_<>'*')
          )                                      AS NOME_CLIENTE,
          C5_CONTRAT                             AS CONTRPAI,
          C5_SUBCOO                              AS CONTRFILHO,
          TRIM(D2_CF)                            AS CFOP,
          D2_QUANT                               AS QUANT,
          (d2_total + d2_valfre)                 AS TOTAL,
          SUBSTR(B1_desc,1,35)                   AS PRODUTO,
          TRIM(F2_TIPO)                          AS TPDOC,
          D2_QUANT/60                            AS SACAS,
          D2_PRCVEN                              AS VLR_UNIT,
          F2_VALFAC                              AS VLR_FACS,
          F2_VALFET                              AS VLR_FETHAB,
          F2_CONTSOC                             AS VL_FUNRURAL,
          SUBSTR(C5_NOMTRAN,1,25)                AS TRANSP,
          C5.C5_VEICULO                          AS PLACA,
          TRIM(B1_GRUPO)                         AS B1_GRUPO,
          CASE
            WHEN TRIM(B1_GRUPO) = '0203003' THEN 'Pecuária'
            WHEN TRIM(B1_GRUPO) = '0402008' THEN 'Agricultura'
            ELSE 'Outros'
          END                                    AS TIPO_NEGOCIO
        FROM protheus11.sc5020 c5,
             protheus11.sc6020 c6,
             protheus11.sf2020 f2,
             protheus11.sd2020 d2,
             protheus11.sb1020 b1
        WHERE c5.c5_num      = c6.c6_num
          AND D2.D2_PEDIDO   = c5.c5_num
          AND c5.c5_filial   = c6.c6_filial
          AND F2.F2_FILIAL   = c6.c6_filial
          AND D2.D2_FILIAL   = f2.f2_filial
          AND d2.d2_cod      = b1.b1_cod
          AND f2.f2_doc      = d2.d2_doc
          AND f2.f2_serie    = d2.d2_serie
          AND f2.f2_cliente  = d2.d2_cliente
          AND f2.f2_loja     = d2.d2_loja
          AND c5.d_e_l_e_t_ <> '*'
          AND c6.d_e_l_e_t_ <> '*'
          AND f2.d_e_l_e_t_ <> '*'
          AND d2.d_e_l_e_t_ <> '*'
          AND b1.d_e_l_e_t_ <> '*'
          AND F2_EMISSAO >= REPLACE(:data_de, '-', '')
          AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
          AND D2_CF NOT IN ('5949','5905','5151','5910','5201','5208')
          AND F2.F2_FILIAL IN ('028501','028503')

        UNION

        SELECT distinct
          f1_filial                              AS EMPRESA,
          CASE 
            WHEN LENGTH(TRIM(F1_EMISSAO)) = 8 AND F1_EMISSAO <> '00000000' AND F1_EMISSAO <> '        ' AND REGEXP_LIKE(F1_EMISSAO, '^[0-9]{8}$')
            THEN TO_DATE(F1_EMISSAO, 'yyyymmdd')
            ELSE NULL
          END                                   AS EMISSAO,
          TRIM(D1_DOC)                           AS NF,
          decode(d1_TIPO,'D',
            (select SUBSTR(a2.a2_nome,1,30) from protheus11.sa2020 a2
              where a2.a2_cod=F1_fornece and a2.a2_loja=d1_loja and a2.d_e_l_e_t_<>'*'),
            (select SUBSTR(a1.a1_nome,1,30) from protheus11.sa1020 a1
              where a1.a1_cod=F1_fornece and a1.a1_loja=d1_loja and a1.d_e_l_e_t_<>'*')
          )                                      AS NOME_CLIENTE,
          'ENTRADA'                              AS CONTRPAI,
          'ENTRADA'                              AS CONTRFILHO,
          TRIM(D1_CF)                            AS CFOP,
          D1_QUANT * -1                          AS QUANT,
          d1_total * -1                          AS TOTAL,
          SUBSTR(B1_desc,1,35)                   AS PRODUTO,
          TRIM(d1_TIPO)                          AS TPDOC,
          D1_QUANT / 60                          AS SACAS,
          D1_VUNIT                               AS VLR_UNIT,
          D1_VALFAC * -1                         AS VLR_FACS,
          D1_VALFET                              AS VLR_FETHAB,
          F1_CONTSOC * -1                        AS VL_FUNRURAL,
          SUBSTR(F1_TRANSP,1,25)                 AS TRANSP,
          'ENTRADA'                              AS PLACA,
          TRIM(B1_GRUPO)                         AS B1_GRUPO,
          CASE
            WHEN TRIM(B1_GRUPO) = '0203003' THEN 'Pecuária'
            WHEN TRIM(B1_GRUPO) = '0402008' THEN 'Agricultura'
            ELSE 'Outros'
          END                                    AS TIPO_NEGOCIO
        FROM protheus11.sf1020 f1,
             protheus11.sd1020 d1,
             protheus11.sb1020 b1
        WHERE D1.D1_FILIAL  = f1.f1_filial
          AND d1.d1_cod     = b1.b1_cod
          AND f1.f1_doc     = d1.d1_doc
          AND f1.f1_serie   = d1.d1_serie
          AND f1.f1_fornece = d1.d1_fornece
          AND f1.f1_loja    = d1.d1_loja
          AND f1.d_e_l_e_t_ <> '*'
          AND d1.d_e_l_e_t_ <> '*'
          AND b1.d_e_l_e_t_ <> '*'
          AND F1_EMISSAO >= REPLACE(:data_de, '-', '')
          AND F1_EMISSAO <= REPLACE(:data_ate, '-', '')
          AND D1_CF NOT IN ('1906','1151','1101','1933','1356','1922','1910','1209')
          AND f1.f1_filial IN ('028501','028503')
      ) MID_Q
    ) OUTER_Q
  `;
}

// Helper: formata Date para string 'YYYY-MM-DD' (bind variable seguro para Oracle)
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: datas do mês como strings para bind seguro
function getMonthRange(ano, mes) {
  return {
    dataDe:  dateToStr(new Date(ano, mes - 1, 1)),
    dataAte: dateToStr(new Date(ano, mes, 0))  // último dia do mês
  };
}

// Helper: determinar ano safra a partir de hoje
function getSafraYear(hoje = new Date()) {
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();
  return mes >= 9 ? ano + 1 : ano;
}

// Helper: lista de meses do calendário agrícola (safra) ou contábil
function getMesesSafra(anoSafra) {
  // Safra: Set(ano-1) → Ago(anoSafra)
  return [
    { ano: anoSafra - 1, mes: 9  }, { ano: anoSafra - 1, mes: 10 },
    { ano: anoSafra - 1, mes: 11 }, { ano: anoSafra - 1, mes: 12 },
    { ano: anoSafra,     mes: 1  }, { ano: anoSafra,     mes: 2  },
    { ano: anoSafra,     mes: 3  }, { ano: anoSafra,     mes: 4  },
    { ano: anoSafra,     mes: 5  }, { ano: anoSafra,     mes: 6  },
    { ano: anoSafra,     mes: 7  }, { ano: anoSafra,     mes: 8  }
  ];
}

function getMesesCalendario(ano) {
  return Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1 }));
}

// Agrega linhas do SQL em totais por mês/empresa (BRL + USD)
function agregarPorMes(rows) {
  const map = {};
  for (const r of rows) {
    const emissao = r.EMISSAO;
    if (!emissao) continue;
    const d = emissao instanceof Date ? emissao : new Date(emissao);
    const key = `${r.EMPRESA}_${d.getFullYear()}_${d.getMonth() + 1}`;
    if (!map[key]) {
      map[key] = {
        empresa: r.EMPRESA,
        ano: d.getFullYear(),
        mes: d.getMonth() + 1,
        receita: 0, sacas: 0, qtdNfs: new Set(),
        funrural: 0, fethab: 0, vlrFacs: 0,
        // Campos USD
        receitaUsd: 0, funruralUsd: 0, fethabUsd: 0, vlrFacsUsd: 0
      };
    }
    map[key].receita     += Number(r.TOTAL         || 0);
    map[key].sacas       += Number(r.SACAS         || 0);
    map[key].funrural    += Number(r.VL_FUNRURAL   || 0);
    map[key].fethab      += Number(r.VLR_FETHAB    || 0);
    map[key].vlrFacs     += Number(r.VLR_FACS      || 0);
    map[key].receitaUsd  += Number(r.TOTAL_USD     || 0);
    map[key].funruralUsd += Number(r.VL_FUNRURAL_USD || 0);
    map[key].fethabUsd   += Number(r.VLR_FETHAB_USD  || 0);
    map[key].vlrFacsUsd  += Number(r.VLR_FACS_USD    || 0);
    if (r.NF) map[key].qtdNfs.add(r.NF);
  }
  return Object.values(map).map(v => ({ ...v, qtdNfs: v.qtdNfs.size }));
}

// GET /api/receita/dados — dados brutos para o cubo pivot
app.get('/api/receita/dados', async (req, res) => {
  try {
    const hoje = new Date();
    const anoSafra = parseInt(req.query.ano_safra) || getSafraYear(hoje);

    // Intervalo: Set(anoSafra-1) → Ago(anoSafra) — ou parâmetros customizados
    // Datas como string 'YYYY-MM-DD' para bind seguro com TO_DATE no Oracle
    const dataDe  = req.query.data_de  || dateToStr(new Date(anoSafra - 1, 8,  1));
    const dataAte = req.query.data_ate || dateToStr(new Date(anoSafra,     7, 31));

    const sql = buildReceitaSQL();
    const binds = { data_de: dataDe, data_ate: dataAte };
    const rows = await db.execute(sql, binds);

    // Filtro opcional por tipo negocio (cliente-side pode filtrar, mas suportamos server-side também)
    const tipoNegocio = req.query.tipo_negocio;
    const result = tipoNegocio && tipoNegocio !== 'todos'
      ? rows.filter(r => r.TIPO_NEGOCIO === tipoNegocio)
      : rows;

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    console.error('[receita/dados]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/receita/resumo-anual — resumo de 12 meses (safra ou calendário)
app.get('/api/receita/resumo-anual', async (req, res) => {
  try {
    const hoje = new Date();
    const anoSafra    = parseInt(req.query.ano_safra) || getSafraYear(hoje);
    const tipoCalend  = req.query.tipo || 'safra'; // 'safra' | 'calendario'
    const anoCalend   = parseInt(req.query.ano)    || hoje.getFullYear();

    const meses = tipoCalend === 'calendario'
      ? getMesesCalendario(anoCalend)
      : getMesesSafra(anoSafra);

    const mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    const prevDate  = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

    // 1. Buscar meses fechados na tabela FECHAMENTO_RECEITA
    const fechadosSQL = `
      SELECT FR_EMPRESA, FR_ANO, FR_MES, FR_RECEITA_TOTAL, FR_SACAS,
             FR_QTD_NFS, FR_FUNRURAL, FR_FETHAB, FR_VLR_FACS,
             FR_AGRO_RECEITA, FR_AGRO_SACAS, FR_PEC_RECEITA, FR_PEC_SACAS,
             FR_OUTROS_RECEITA, FR_OUTROS_SACAS, FR_DT_FECHAMENTO
      FROM FECHAMENTO_RECEITA
      WHERE FR_RUBRICA = 'RECEITA'
      ORDER BY FR_ANO, FR_MES
    `;
    let fechados = [];
    try {
      fechados = await db.execute(fechadosSQL);
    } catch(e) {
      // tabela pode não existir ainda
      console.warn('[resumo-anual] FECHAMENTO_RECEITA não encontrada:', e.message);
    }
    const fechadosMap = {};
    for (const f of fechados) {
      fechadosMap[`${f.FR_EMPRESA}_${f.FR_ANO}_${f.FR_MES}`] = f;
    }

    // 2. Identificar meses dinâmicos (atual + anterior)
    const dinâmicos = meses.filter(m => {
      if (m.ano === mesAtual.ano     && m.mes === mesAtual.mes)     return true;
      if (m.ano === mesAnterior.ano  && m.mes === mesAnterior.mes)  return true;
      return false;
    });

    // 3. Buscar dados dinâmicos (um único SQL para ambos os meses)
    let dadosDinamicos = [];
    if (dinâmicos.length > 0) {
      // Calcular intervalo cobrindo todos os meses dinâmicos — strings 'YYYY-MM-DD'
      const timestamps = dinâmicos.map(m => new Date(m.ano, m.mes - 1, 1).getTime());
      const timestampsAte = dinâmicos.map(m => new Date(m.ano, m.mes, 0).getTime());
      const dataDe  = dateToStr(new Date(Math.min(...timestamps)));
      const dataAte = dateToStr(new Date(Math.max(...timestampsAte)));
      const sqlDin = buildReceitaSQL();
      const rowsDin = await db.execute(sqlDin, { data_de: dataDe, data_ate: dataAte });
      dadosDinamicos = agregarPorMes(rowsDin);
    }

    // 4. Montar array de 12 meses
    const empresas = ['028501', '028503', 'TOTAL'];
    const resultado = meses.map(m => {
      const isMesAtual    = m.ano === mesAtual.ano    && m.mes === mesAtual.mes;
      const isMesAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      const isFuturo = new Date(m.ano, m.mes - 1, 1) > hoje;

      let status = 'futuro';
      if (isMesAtual)    status = 'dinamico_atual';
      else if (isMesAnterior) status = 'dinamico_anterior';
      else if (!isFuturo) status = 'aguardando'; // passado mas não fechado / não dinâmico

      const porEmpresa = {};
      for (const emp of ['028501','028503']) {
        const keyFech = `${emp}_${m.ano}_${m.mes}`;
        if (fechadosMap[keyFech]) {
          const f = fechadosMap[keyFech];
          porEmpresa[emp] = {
            receita: f.FR_RECEITA_TOTAL, sacas: f.FR_SACAS, qtdNfs: f.FR_QTD_NFS,
            funrural: f.FR_FUNRURAL, fethab: f.FR_FETHAB, vlrFacs: f.FR_VLR_FACS,
            agroReceita: f.FR_AGRO_RECEITA, pecReceita: f.FR_PEC_RECEITA, outrosReceita: f.FR_OUTROS_RECEITA,
            status: 'fechado', dtFechamento: f.FR_DT_FECHAMENTO
          };
        } else if (isMesAtual || isMesAnterior) {
          const din = dadosDinamicos.find(d => d.empresa === emp && d.ano === m.ano && d.mes === m.mes);
          porEmpresa[emp] = din
            ? { receita: din.receita, sacas: din.sacas, qtdNfs: din.qtdNfs,
                funrural: din.funrural, fethab: din.fethab, vlrFacs: din.vlrFacs, status }
            : { receita: 0, sacas: 0, qtdNfs: 0, funrural: 0, fethab: 0, vlrFacs: 0, status };
        } else {
          porEmpresa[emp] = { receita: 0, sacas: 0, qtdNfs: 0, funrural: 0, fethab: 0, vlrFacs: 0, status };
        }
      }

      // Total consolidado das duas filiais
      const total = { receita: 0, sacas: 0, qtdNfs: 0, funrural: 0, fethab: 0, vlrFacs: 0 };
      for (const emp of ['028501','028503']) {
        total.receita  += porEmpresa[emp].receita  || 0;
        total.sacas    += porEmpresa[emp].sacas    || 0;
        total.qtdNfs   += porEmpresa[emp].qtdNfs   || 0;
        total.funrural += porEmpresa[emp].funrural || 0;
        total.fethab   += porEmpresa[emp].fethab   || 0;
        total.vlrFacs  += porEmpresa[emp].vlrFacs  || 0;
      }
      porEmpresa['TOTAL'] = { ...total, status };

      return { ano: m.ano, mes: m.mes, status, porEmpresa };
    });

    res.json({ success: true, anoSafra, tipoCalend, meses: resultado });
  } catch (err) {
    console.error('[receita/resumo-anual]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/receita/fechar-mes — grava fechamento do mês na tabela FECHAMENTO_RECEITA
app.post('/api/receita/fechar-mes', async (req, res) => {
  try {
    const { empresa, mes, ano } = req.body;
    if (!empresa || !mes || !ano) {
      return res.status(400).json({ success: false, error: 'empresa, mes e ano são obrigatórios' });
    }

    // Buscar dados do mês a fechar
    const { dataDe, dataAte } = getMonthRange(parseInt(ano), parseInt(mes));
    const sql = buildReceitaSQL();
    const rows = await db.execute(sql, { data_de: dataDe, data_ate: dataAte });

    // Filtrar pela empresa solicitada
    const rowsEmp = empresa === 'TODAS'
      ? rows
      : rows.filter(r => r.EMPRESA === empresa);

    // Agregar totais
    let receita = 0, sacas = 0, funrural = 0, fethab = 0, vlrFacs = 0;
    let agroReceita = 0, agroSacas = 0, pecReceita = 0, pecSacas = 0, outrosReceita = 0, outrosSacas = 0;
    const nfsSet = new Set();

    for (const r of rowsEmp) {
      const tot = Number(r.TOTAL || 0);
      const sac = Number(r.SACAS || 0);
      receita  += tot;
      sacas    += sac;
      funrural += Number(r.VL_FUNRURAL || 0);
      fethab   += Number(r.VLR_FETHAB  || 0);
      vlrFacs  += Number(r.VLR_FACS    || 0);
      if (r.NF) nfsSet.add(r.NF);

      if (r.TIPO_NEGOCIO === 'Agricultura') { agroReceita += tot; agroSacas += sac; }
      else if (r.TIPO_NEGOCIO === 'Pecuária') { pecReceita += tot; pecSacas += sac; }
      else { outrosReceita += tot; outrosSacas += sac; }
    }
    const qtdNfs = nfsSet.size;

    // MERGE INTO FECHAMENTO_RECEITA
    const mergeSql = `
      MERGE INTO FECHAMENTO_RECEITA fr
      USING DUAL ON (fr.FR_EMPRESA = :empresa AND fr.FR_ANO = :ano AND fr.FR_MES = :mes AND fr.FR_RUBRICA = 'RECEITA')
      WHEN MATCHED THEN UPDATE SET
        fr.FR_RECEITA_TOTAL  = :receita,
        fr.FR_SACAS          = :sacas,
        fr.FR_QTD_NFS        = :qtdNfs,
        fr.FR_FUNRURAL       = :funrural,
        fr.FR_FETHAB         = :fethab,
        fr.FR_VLR_FACS       = :vlrFacs,
        fr.FR_AGRO_RECEITA   = :agroReceita,
        fr.FR_AGRO_SACAS     = :agroSacas,
        fr.FR_PEC_RECEITA    = :pecReceita,
        fr.FR_PEC_SACAS      = :pecSacas,
        fr.FR_OUTROS_RECEITA = :outrosReceita,
        fr.FR_OUTROS_SACAS   = :outrosSacas,
        fr.FR_DT_FECHAMENTO  = SYSDATE
      WHEN NOT MATCHED THEN INSERT
        (FR_EMPRESA, FR_ANO, FR_MES, FR_RUBRICA, FR_RECEITA_TOTAL, FR_SACAS, FR_QTD_NFS,
         FR_FUNRURAL, FR_FETHAB, FR_VLR_FACS,
         FR_AGRO_RECEITA, FR_AGRO_SACAS, FR_PEC_RECEITA, FR_PEC_SACAS,
         FR_OUTROS_RECEITA, FR_OUTROS_SACAS, FR_DT_FECHAMENTO)
      VALUES
        (:empresa, :ano, :mes, 'RECEITA', :receita, :sacas, :qtdNfs,
         :funrural, :fethab, :vlrFacs,
         :agroReceita, :agroSacas, :pecReceita, :pecSacas,
         :outrosReceita, :outrosSacas, SYSDATE)
    `;

    await db.execute(mergeSql, {
      empresa, ano: parseInt(ano), mes: parseInt(mes),
      receita, sacas, qtdNfs,
      funrural, fethab, vlrFacs,
      agroReceita, agroSacas, pecReceita, pecSacas, outrosReceita, outrosSacas
    }, { autoCommit: true });

    res.json({
      success: true,
      mensagem: `Mês ${mes}/${ano} para empresa ${empresa} fechado com sucesso.`,
      dados: { empresa, ano, mes, receita, sacas, qtdNfs, funrural, fethab }
    });
  } catch (err) {
    console.error('[receita/fechar-mes]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/receita/fechados — lista de meses fechados gravados
app.get('/api/receita/fechados', async (req, res) => {
  try {
    const sql = `
      SELECT FR_EMPRESA, FR_ANO, FR_MES, FR_RUBRICA,
             FR_RECEITA_TOTAL, FR_SACAS, FR_QTD_NFS, FR_FUNRURAL, FR_FETHAB, FR_VLR_FACS,
             FR_AGRO_RECEITA, FR_AGRO_SACAS, FR_PEC_RECEITA, FR_PEC_SACAS,
             FR_OUTROS_RECEITA, FR_OUTROS_SACAS,
             FR_DT_FECHAMENTO, FR_USUARIO
      FROM FECHAMENTO_RECEITA
      WHERE FR_RUBRICA = 'RECEITA'
      ORDER BY FR_ANO, FR_MES, FR_EMPRESA
    `;
    let rows = [];
    try {
      rows = await db.execute(sql);
    } catch(e) {
      console.warn('[receita/fechados] tabela não existe ainda:', e.message);
    }
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[receita/fechados]', err);
    res.status(500).json({ success: false, error: err.message });
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

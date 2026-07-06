const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

// ─── Parâmetros persistidos em arquivo (params.json) ───────────────────────
const PARAMS_FILE = path.join(__dirname, 'params.json');

function loadParamsFile() {
  try {
    return JSON.parse(fs.readFileSync(PARAMS_FILE, 'utf8'));
  } catch {
    return { insumos: { za5_safra: '20251', za5_filial: '0285', descricao: '' } };
  }
}

function saveParamsFile(data) {
  fs.writeFileSync(PARAMS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

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
        (SELECT MIN(XDP_VENCTO) FROM PROTHEUS11.CONDORXMLDUPL XD WHERE XD.XDP_CHAVE = XM.XML_CHAVE) as XML_DTRVLD,
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
      D1_NFORI, XIT_CFNFE, FT_TES, FT_CFOP, TRIM(D1_TES) as D1_TES, TRIM(D1_CF) as D1_CF, TRIM(D1_CC) as D1_CC, TRIM(D1_LOCAL) as D1_LOCAL, XIT_NCM, FT_POSIPI, XIT_QTENFE, FT_QUANT, XIT_TOTNFE, FT_TOTAL, FT_DESPESA, FT_SEGURO,
      FT_FRETE, FT_VALPEDG, XIT_CSTORI, XIT_BASICM, XIT_PICM, XIT_VALICM, XIT_PREDBC, FT_CLASFIS, FT_BASEICM, FT_ALIQICM, FT_VALICM, FT_ISENICM, FT_OUTRICM, FT_OBSICM, D1_VALICM, D1_ICMSCOM, XIT_BASRET,
      XIT_PMVA, XIT_PICMST, XIT_VALRET, XIT_BRETAN, XIT_VRETAN, XIT_ICMSUB, XIT_PRETST, FT_BASERET, FT_MARGEM, FT_ICMSRET, FT_OBSSOL, FT_SOLTRIB, XIT_CSTIPI, XIT_BASIPI, XIT_PIPI, XIT_VALIPI, FT_CTIPI,
      FT_BASEIPI, FT_VALIPI, FT_ISENIPI, FT_OUTRIPI, D1_VALIPI, XIT_CSTPIS, XIT_BASPIS, XIT_PPIS, XIT_VALPIS, FT_CSTPIS, FT_BASEPIS, FT_ALIQPIS, FT_VALPIS, XIT_CSTCOF, XIT_BASCOF, XIT_PCOF, XIT_VALCOF,
      FT_CSTCOF, FT_BASECOF, FT_ALIQCOF, FT_VALCOF, FT_BASEIRR, FT_ALIQIRR, FT_VALIRR, FT_BRETCOF, FT_ARETCOF, FT_VRETCOF, FT_BRETPIS, FT_ARETPIS, FT_VRETPIS, FT_BRETCSL, FT_ARETCSL, FT_VRETCSL, XML_VRETIR,
      XML_VRETCF, XML_VRETPS, XML_VRETCS, XIT_KEYSD1, XML_KEYF1, XML_CONFCO, XML_CONFIS, XML_DTRCTO, XML_DTENTG, COALESCE(FT.R_E_C_N_O_,0) FTRECNO   
    FROM PROTHEUS11.CONDORXMLITENS XI  
    INNER JOIN PROTHEUS11.CONDORXML XM   ON XM.D_E_L_E_T_ =' '   
                             AND XML_CHAVE = XIT_CHAVE   
    LEFT JOIN PROTHEUS11.SFT020 FT       ON FT.D_E_L_E_T_ =' '   
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
                             AND FT_ESPECIE in ('SPED','NFPS')     
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
      D1_NFORI, XML_NATOPE XIT_CFNFE, FT_TES, FT_CFOP, TRIM(D1_TES) as D1_TES, TRIM(D1_CF) as D1_CF, TRIM(D1_CC) as D1_CC, TRIM(D1_LOCAL) as D1_LOCAL, ' ' XIT_NCM,
      FT_POSIPI, 0 AS XIT_QTENFE, FT_QUANT, XML_VLRDOC AS XIT_TOTNFE, FT_TOTAL, FT_DESPESA, FT_SEGURO, FT_FRETE, FT_VALPEDG, XIM_CST XIT_CSTORI, XIM_BASICM AS XIT_BASICM, XIM_ALQICM AS XIT_PICM,
      XIM_VALICM AS XIT_VALICM, XIM_PICRED AS XIT_PREDBC, FT_CLASFIS, FT_BASEICM, FT_ALIQICM, FT_VALICM, FT_ISENICM, FT_OUTRICM, FT_OBSICM, D1_VALICM, D1_ICMSCOM, XIM_BRICMS AS XIT_BASRET,
      0 AS XIT_PMVA, XIM_PICRET AS XIT_PICMST, XIM_ICMRET AS XIT_VALRET, 0 AS XIT_BRETAN, 0 AS XIT_VRETAN, 0 AS XIT_ICMSUB, 0 AS XIT_PRETST, FT_BASERET, FT_MARGEM, FT_ICMSRET, FT_OBSSOL, FT_SOLTRIB,
      ' ' AS XIT_CSTIPI, 0 AS XIT_BASIPI, 0 AS XIT_PIPI, 0 AS XIT_VALIPI, FT_CTIPI, FT_BASEIPI, FT_VALIPI, FT_ISENIPI, FT_OUTRIPI, D1_VALIPI, ' ' AS XIT_CSTPIS, 0 AS XIT_BASPIS, 0 AS XIT_PPIS,
      0 AS XIT_VALPIS, FT_CSTPIS, FT_BASEPIS, FT_ALIQPIS, FT_VALPIS, ' ' AS XIT_CSTCOF, 0 AS XIT_BASCOF, 0 AS XIT_PCOF, 0 AS XIT_VALCOF, FT_CSTCOF, FT_BASECOF, FT_ALIQCOF, FT_VALCOF, FT_BASEIRR,
      FT_ALIQIRR, FT_VALIRR, FT_BRETCOF, FT_ARETCOF, FT_VRETCOF, FT_BRETPIS, FT_ARETPIS, FT_VRETPIS, FT_BRETCSL, FT_ARETCSL, FT_VRETCSL, XML_VRETIR, XML_VRETCF, XML_VRETPS, XML_VRETCS, ' ' AS XIT_KEYSD1,
      XML_KEYF1, XML_CONFCO, XML_CONFIS, XML_DTRCTO, XML_DTENTG, COALESCE(FT.R_E_C_N_O_,0) FTRECNO   
    FROM PROTHEUS11.CONDORXML XM   
    LEFT JOIN PROTHEUS11.SFT020 FT     ON FT.D_E_L_E_T_ =' '   
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

// Rota de API para buscar dados financeiros de uma nota fiscal específica (filtrada por XML_CHAVE)
app.get('/api/notas/:chave/financeiro', async (req, res) => {
  const chave = req.params.chave ? req.params.chave.trim() : '';

  if (!chave) {
    return res.json({ success: true, method: 'sft', data: [] });
  }

  try {
    // 1. Buscar no CONDORXML pela chave para extrair o relacionamento único (XML_KEYF1)
    const sqlXML = `
      SELECT XML_KEYF1 
      FROM PROTHEUS11.CONDORXML 
      WHERE TRIM(XML_CHAVE) = :chave 
        AND D_E_L_E_T_ = ' '
    `;
    const xmlRows = await db.execute(sqlXML, { chave });

    if (xmlRows.length === 0 || !xmlRows[0].XML_KEYF1 || xmlRows[0].XML_KEYF1.trim() === '') {
      return res.json({ success: true, method: 'condor', data: [], message: 'Nota fiscal não localizada no Condor ou sem relacionamento estabelecido (XML_KEYF1 vazio).' });
    }

    const xmlKey = xmlRows[0].XML_KEYF1;
    const filial = xmlKey.substring(0, 6);
    const nfiscal = xmlKey.substring(6, 15);
    const serie = xmlKey.substring(15, 18);
    const fornec = xmlKey.substring(18, 24);
    const loja = xmlKey.substring(24, 26);

    // 2. Buscar dados financeiros no contas a pagar (SE2020) com os campos chave extraídos
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
      WHERE E2_FILIAL = :filial
        AND E2_PREFIXO = :prefixo
        AND E2_NUM = :num
        AND E2_FORNECE = :fornece
        AND E2_LOJA = :loja
        AND D_E_L_E_T_ = ' '
      ORDER BY E2_PARCELA ASC, E2_VENCREA ASC
    `;

    const binds = {
      filial: filial,
      prefixo: serie,
      num: nfiscal,
      fornece: fornec,
      loja: loja
    };

    const financeRows = await db.execute(sqlSE2, binds);
    res.json({ success: true, method: 'condor', data: financeRows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados financeiros: ' + err.message });
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
function buildReceitaSQL(cfopFiltro = '', produtoFiltro = '') {
  let extraD2 = '';
  let extraD1 = '';
  if (cfopFiltro) {
    const cf = cfopFiltro.replace(/'/g, '');
    extraD2 += ` AND UPPER(TRIM(D2_CF)) LIKE '%${cf.toUpperCase()}%'`;
    extraD1 += ` AND UPPER(TRIM(D1_CF)) LIKE '%${cf.toUpperCase()}%'`;
  }
  if (produtoFiltro) {
    const pr = produtoFiltro.replace(/'/g, '');
    extraD2 += ` AND UPPER(SUBSTR(B1_desc,1,35)) LIKE '%${pr.toUpperCase()}%'`;
    extraD1 += ` AND UPPER(SUBSTR(B1_desc,1,35)) LIKE '%${pr.toUpperCase()}%'`;
  }

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
          CASE WHEN TRIM(D2_CF)='5151' THEN 'Intercompany' ELSE 'Faturamento' END AS TIPOFECHA,
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
          CASE WHEN TRIM(B1_GRUPO) = '0402008' THEN D2_QUANT/60 ELSE 0 END AS SACAS,
          CASE WHEN TRIM(B1_GRUPO) = '0203003' THEN D2_QUANT ELSE 0 END AS CABECAS,
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
          AND D2_CF NOT IN ('5949','5905','5910','5201','5208')
          AND F2.F2_FILIAL IN ('028501','028503')
          AND TRIM(B1_GRUPO) IN ('0203003', '0402008')
          ${extraD2}

        UNION

        SELECT distinct
          f1_filial                              AS EMPRESA,
          CASE WHEN TRIM(D1_CF) IN ('1151','1209') THEN 'Intercompany' ELSE 'Faturamento' END AS TIPOFECHA,
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
          CASE WHEN TRIM(B1_GRUPO) = '0402008' THEN D1_QUANT/60 ELSE 0 END * -1 AS SACAS,
          CASE WHEN TRIM(B1_GRUPO) = '0203003' THEN D1_QUANT ELSE 0 END * -1 AS CABECAS,
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
          AND D1_CF NOT IN ('1906','1101','1933','1356','1922','1910')
          AND f1.f1_filial IN ('028501','028503')
          AND TRIM(B1_GRUPO) IN ('0203003', '0402008')
          ${extraD1}

        UNION

        SELECT distinct
          SE5.E5_FILIAL                          AS EMPRESA,
          'Faturamento'                          AS TIPOFECHA,
          CASE 
            WHEN LENGTH(TRIM(SE5.E5_DTDISPO)) = 8 AND SE5.E5_DTDISPO <> '00000000' AND SE5.E5_DTDISPO <> '        ' AND REGEXP_LIKE(SE5.E5_DTDISPO, '^[0-9]{8}$')
            THEN TO_DATE(SE5.E5_DTDISPO, 'yyyymmdd')
            ELSE NULL
          END                                    AS EMISSAO,
          TRIM(SE5.E5_NUMERO)                    AS NF,
          (select SUBSTR(a2.a2_nome,1,30) from protheus11.sa2020 a2
              where a2.a2_cod=SE5.E5_CLIFOR and a2.a2_loja=SE5.E5_LOJA and a2.d_e_l_e_t_<>'*') AS NOME_CLIENTE,
          'GTA'                                  AS CONTRPAI,
          'GTA'                                  AS CONTRFILHO,
          TRIM(SE5.E5_NATUREZ)                   AS CFOP,
          0                                      AS QUANT,
          CASE SE5.E5_RECPAG 
              WHEN 'P' THEN SE5.E5_VALOR * -1
              WHEN 'R' THEN SE5.E5_VALOR 
          END                                    AS TOTAL,
          'GTA'                                  AS PRODUTO,
          TRIM(SE5.E5_TIPO)                      AS TPDOC,
          0                                      AS SACAS,
          0                                      AS CABECAS,
          0                                      AS VLR_UNIT,
          0                                      AS VLR_FACS,
          0                                      AS VLR_FETHAB,
          0                                      AS VL_FUNRURAL,
          ' '                                    AS TRANSP,
          ' '                                    AS PLACA,
          '0203003'                              AS B1_GRUPO,
          'Pecuária'                             AS TIPO_NEGOCIO
        FROM protheus11.SE5020 SE5
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
          AND SE5.E5_FILIAL IN ('028501','028503')
          AND SE5.E5_TPGER='DIMP'
          AND SE5.E5_DTDISPO >= REPLACE(:data_de, '-', '')
          AND SE5.E5_DTDISPO <= REPLACE(:data_ate, '-', '')
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
    dataDe: dateToStr(new Date(ano, mes - 1, 1)),
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
    { ano: anoSafra - 1, mes: 9 }, { ano: anoSafra - 1, mes: 10 },
    { ano: anoSafra - 1, mes: 11 }, { ano: anoSafra - 1, mes: 12 },
    { ano: anoSafra, mes: 1 }, { ano: anoSafra, mes: 2 },
    { ano: anoSafra, mes: 3 }, { ano: anoSafra, mes: 4 },
    { ano: anoSafra, mes: 5 }, { ano: anoSafra, mes: 6 },
    { ano: anoSafra, mes: 7 }, { ano: anoSafra, mes: 8 }
  ];
}

function getMesesCalendario(ano) {
  return Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1 }));
}

// Agrega linhas do SQL em totais por mês/empresa (BRL + USD)
function agregarPorMes(rows) {
  const map = {};

  function initSegment() {
    return {
      receita: 0, sacas: 0, cabecas: 0, funrural: 0, fethab: 0, vlrFacs: 0, gta: 0, intercompany: 0,
      receitaUsd: 0, funruralUsd: 0, fethabUsd: 0, vlrFacsUsd: 0, dolarMedio: 0, gtaUsd: 0, intercompanyUsd: 0
    };
  }

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
        Pecuaria: initSegment(),
        Agricola: initSegment(),
        Outros: initSegment(),
        Total: initSegment(),
        qtdNfs: new Set()
      };
    }

    const negocio = r.TIPO_NEGOCIO === 'Pecuária' ? 'Pecuaria' : r.TIPO_NEGOCIO === 'Agricultura' ? 'Agricola' : 'Outros';
    const target = map[key][negocio];
    const tot = map[key].Total;

    const valBrl = Number(r.TOTAL || 0);
    const valUsd = Number(r.TOTAL_USD || 0);
    const sac = Number(r.SACAS || 0);
    const cab = Number(r.CABECAS || 0);
    const fun = Number(r.VL_FUNRURAL || 0);
    const funUsd = Number(r.VL_FUNRURAL_USD || 0);
    const fet = Number(r.VLR_FETHAB || 0);
    const fetUsd = Number(r.VLR_FETHAB_USD || 0);
    const fac = Number(r.VLR_FACS || 0);
    const facUsd = Number(r.VLR_FACS_USD || 0);

    // Adicionar ao segmento específico
    if (r.PRODUTO === 'GTA') {
      const gtaVal = Math.abs(valBrl);
      const gtaUsdVal = Math.abs(valUsd);
      target.gta += gtaVal;
      target.gtaUsd += gtaUsdVal;
      tot.gta += gtaVal;
      tot.gtaUsd += gtaUsdVal;
    } else if (r.TIPOFECHA === 'Intercompany') {
      target.intercompany += valBrl;
      target.intercompanyUsd += valUsd;
      tot.intercompany += valBrl;
      tot.intercompanyUsd += valUsd;
    } else {
      target.receita += valBrl;
      target.receitaUsd += valUsd;
      tot.receita += valBrl;
      tot.receitaUsd += valUsd;
    }

    target.sacas += sac;
    target.cabecas += cab;
    target.funrural += fun;
    target.funruralUsd += funUsd;
    target.fethab += fet;
    target.fethabUsd += fetUsd;
    target.vlrFacs += fac;
    target.vlrFacsUsd += facUsd;

    // Adicionar ao total (receita e gta já foram adicionados acima)
    tot.sacas += sac;
    tot.cabecas += cab;
    tot.funrural += fun;
    tot.funruralUsd += funUsd;
    tot.fethab += fet;
    tot.fethabUsd += fetUsd;
    tot.vlrFacs += fac;
    tot.vlrFacsUsd += facUsd;

    if (r.NF) map[key].qtdNfs.add(r.NF);
  }

  return Object.values(map).map(v => {
    for (const seg of ['Pecuaria', 'Agricola', 'Outros', 'Total']) {
      const segment = v[seg];
      segment.dolarMedio = segment.receitaUsd > 0 ? (segment.receita / segment.receitaUsd) : 0;
    }
    return {
      empresa: v.empresa,
      ano: v.ano,
      mes: v.mes,
      Pecuaria: v.Pecuaria,
      Agricola: v.Agricola,
      Outros: v.Outros,
      Total: v.Total,
      qtdNfs: v.qtdNfs.size
    };
  });
}

// GET /api/receita/dados — dados brutos para o cubo pivot
app.get('/api/receita/dados', async (req, res) => {
  try {
    const hoje = new Date();
    const anoSafra = parseInt(req.query.ano_safra) || getSafraYear(hoje);

    // Por padrão, trazer apenas o mês anterior e o mês corrente
    const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const currLastDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    // Datas como string 'YYYY-MM-DD' para bind seguro com TO_DATE no Oracle
    const dataDe = req.query.data_de || dateToStr(prevDate);
    const dataAte = req.query.data_ate || dateToStr(currLastDate);

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
    const anoSafra = parseInt(req.query.ano_safra) || getSafraYear(hoje);
    const tipoCalend = req.query.tipo || 'safra'; // 'safra' | 'calendario'
    const anoCalend = parseInt(req.query.ano) || hoje.getFullYear();
    const cfopFilter = (req.query.cfop || '').trim();
    const produtoFilter = (req.query.produto || '').trim();
    const hasDetailFilter = !!(cfopFilter || produtoFilter);

    const meses = tipoCalend === 'calendario'
      ? getMesesCalendario(anoCalend)
      : getMesesSafra(anoSafra);

    const mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

    // 1. Buscar meses fechados na tabela FECHAMENTO_RECEITA
    const fechadosSQL = `
      SELECT FR_EMPRESA, FR_ANO, FR_MES, FR_RECEITA_TOTAL, FR_INTERCOMPANY, FR_SACAS,
             FR_QTD_NFS, FR_FUNRURAL, FR_GTA, FR_FETHAB, FR_VLR_FACS,
             FR_DOLAR_MEDIO, FR_NEGOCIO, FR_DT_FECHAMENTO
      FROM FECHAMENTO_RECEITA
      WHERE FR_RUBRICA = 'RECEITA'
      ORDER BY FR_ANO, FR_MES
    `;
    let fechados = [];
    try {
      fechados = await db.execute(fechadosSQL);
    } catch (e) {
      console.warn('[resumo-anual] FECHAMENTO_RECEITA não encontrada:', e.message);
    }

    function initSegment() {
      return {
        receita: 0, sacas: 0, cabecas: 0, funrural: 0, gta: 0, fethab: 0, vlrFacs: 0, intercompany: 0,
        receitaUsd: 0, funruralUsd: 0, gtaUsd: 0, fethabUsd: 0, vlrFacsUsd: 0, dolarMedio: 0, intercompanyUsd: 0
      };
    }

    const fechadosMap = {};
    for (const f of fechados) {
      const key = `${f.FR_EMPRESA}_${f.FR_ANO}_${f.FR_MES}`;
      if (!fechadosMap[key]) {
        fechadosMap[key] = {
          Pecuaria: initSegment(),
          Agricola: initSegment(),
          Outros: initSegment(),
          Total: initSegment(),
          dtFechamento: f.FR_DT_FECHAMENTO
        };
      }

      if (f.FR_NEGOCIO) {
        // Formato multi-linhas por negócio (Histórico segmentado)
        const negocio = f.FR_NEGOCIO === 'Pecuária' ? 'Pecuaria' : f.FR_NEGOCIO === 'Agricultura' ? 'Agricola' : 'Outros';
        const target = fechadosMap[key][negocio];
        const tot = fechadosMap[key].Total;

        const valBrl = Number(f.FR_RECEITA_TOTAL || 0);
        const qtdSacas = Number(f.FR_SACAS || 0);

        let sac = 0;
        let cab = 0;
        if (negocio === 'Pecuaria') {
          cab = qtdSacas;
        } else {
          sac = qtdSacas;
        }

        const fun = Number(f.FR_FUNRURAL || 0);
        const gta = Number(f.FR_GTA || 0);
        const fet = Number(f.FR_FETHAB || 0);
        const fac = Number(f.FR_VLR_FACS || 0);
        const inc = Number(f.FR_INTERCOMPANY || 0);
        const dm = Number(f.FR_DOLAR_MEDIO || 0);

        target.receita += valBrl;
        target.intercompany += inc;
        target.sacas += sac;
        target.cabecas += cab;
        target.funrural += fun;
        target.gta += gta;
        target.fethab += fet;
        target.vlrFacs += fac;
        if (dm > 0) target.dolarMedio = dm;

        tot.receita += valBrl;
        tot.intercompany += inc;
        tot.sacas += sac;
        tot.cabecas += cab;
        tot.funrural += fun;
        tot.gta += gta;
        tot.fethab += fet;
        tot.vlrFacs += fac;
        if (dm > 0) tot.dolarMedio = dm;
      } else {
        // Formato consolidado de linha única (Legado sem segmentação)
        const tot = fechadosMap[key].Total;
        tot.receita = Number(f.FR_RECEITA_TOTAL || 0);
        tot.sacas = Number(f.FR_SACAS || 0); // Assumimos tudo sacas já que não sabemos
        tot.cabecas = 0;
        tot.funrural = Number(f.FR_FUNRURAL || 0);
        tot.gta = Number(f.FR_GTA || 0);
        tot.fethab = Number(f.FR_FETHAB || 0);
        tot.vlrFacs = Number(f.FR_VLR_FACS || 0);
        tot.dolarMedio = Number(f.FR_DOLAR_MEDIO || 0);
      }
    }

    // Calcular valores em USD para os fechadosMap
    for (const key in fechadosMap) {
      const monthData = fechadosMap[key];
      const tot = monthData.Total;
      for (const seg of ['Pecuaria', 'Agricola', 'Outros', 'Total']) {
        const s = monthData[seg];
        const dm = s.dolarMedio || tot.dolarMedio || 0;
        s.receitaUsd = dm > 0 ? s.receita / dm : 0;
        s.funruralUsd = dm > 0 ? s.funrural / dm : 0;
        s.gtaUsd = dm > 0 ? s.gta / dm : 0;
        s.fethabUsd = dm > 0 ? s.fethab / dm : 0;
        s.vlrFacsUsd = dm > 0 ? s.vlrFacs / dm : 0;
      }
    }

    // 2. Identificar meses dinâmicos
    const dinâmicos = meses.filter(m => {
      const isFuturo = new Date(m.ano, m.mes - 1, 1) > hoje;
      if (isFuturo) return false; // Se tem filtro de detalhe, todos os meses passados/atuais são dinâmicos!
      if (m.ano === mesAtual.ano && m.mes === mesAtual.mes) return true;
      if (m.ano === mesAnterior.ano && m.mes === mesAnterior.mes) return true;
      return false;
    });

    // 3. Buscar dados dinâmicos (um único SQL para todos os meses dinâmicos)
    let dadosDinamicos = [];
    if (dinâmicos.length > 0) {
      const timestamps = dinâmicos.map(m => new Date(m.ano, m.mes - 1, 1).getTime());
      const timestampsAte = dinâmicos.map(m => new Date(m.ano, m.mes, 0).getTime());
      const dataDe = dateToStr(new Date(Math.min(...timestamps)));
      const dataAte = dateToStr(new Date(Math.max(...timestampsAte)));
      const sqlDin = buildReceitaSQL(cfopFilter, produtoFilter);
      const rowsDin = await db.execute(sqlDin, { data_de: dataDe, data_ate: dataAte });
      dadosDinamicos = agregarPorMes(rowsDin);
    }

    // 4. Montar array de 12 meses
    const resultado = meses.map(m => {
      const isMesAtual = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
      const isMesAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      const isFuturo = new Date(m.ano, m.mes - 1, 1) > hoje;

      let defaultStatus = 'futuro';
      if (isMesAtual) defaultStatus = 'dinamico_atual';
      else if (isMesAnterior) defaultStatus = 'dinamico_anterior';
      else if (!isFuturo) defaultStatus = 'aguardando';

      const keyTodas = `TODAS_${m.ano}_${m.mes}`;
      const isTodasClosed = !!fechadosMap[keyTodas];
      const fTodas = fechadosMap[keyTodas];

      const porEmpresa = {};
      for (const emp of ['028501', '028503']) {
        const keyFech = `${emp}_${m.ano}_${m.mes}`;
        const f = fechadosMap[keyFech];

        if (f) {
          porEmpresa[emp] = {
            Pecuaria: { ...f.Pecuaria },
            Agricola: { ...f.Agricola },
            Outros: { ...f.Outros },
            Total: { ...f.Total },
            status: 'fechado',
            dtFechamento: f.dtFechamento
          };
        } else {
          const din = dadosDinamicos.find(d => d.empresa === emp && d.ano === m.ano && d.mes === m.mes);
          let empStatus = defaultStatus;
          let pec = initSegment(), agr = initSegment(), out = initSegment(), tot = initSegment();

          if (isTodasClosed) {
            empStatus = 'fechado';
            const tTot = fTodas.Total;
            const dinTotalBrl = din ? din.Total.receita : 0;
            if (dinTotalBrl > 0) {
              const ratioPec = din.Pecuaria.receita / dinTotalBrl;
              const ratioAgr = din.Agricola.receita / dinTotalBrl;
              const ratioOut = din.Outros.receita / dinTotalBrl;

              pec.receita = tTot.receita * ratioPec;
              pec.funrural = tTot.funrural * ratioPec;
              pec.gta = tTot.gta * ratioPec;
              pec.fethab = tTot.fethab * ratioPec;
              pec.vlrFacs = tTot.vlrFacs * ratioPec;
              pec.intercompany = tTot.intercompany * ratioPec;
              pec.intercompanyUsd = tTot.intercompanyUsd * ratioPec;

              agr.receita = tTot.receita * ratioAgr;
              agr.funrural = tTot.funrural * ratioAgr;
              agr.gta = tTot.gta * ratioAgr;
              agr.fethab = tTot.fethab * ratioAgr;
              agr.vlrFacs = tTot.vlrFacs * ratioAgr;
              agr.intercompany = tTot.intercompany * ratioAgr;
              agr.intercompanyUsd = tTot.intercompanyUsd * ratioAgr;

              out.receita = tTot.receita * ratioOut;
              out.funrural = tTot.funrural * ratioOut;
              out.gta = tTot.gta * ratioOut;
              out.fethab = tTot.fethab * ratioOut;
              out.vlrFacs = tTot.vlrFacs * ratioOut;
              out.intercompany = tTot.intercompany * ratioOut;
              out.intercompanyUsd = tTot.intercompanyUsd * ratioOut;
            } else {
              out = { ...tTot };
            }
            tot = { ...tTot };
          } else if (din) {
            pec = { ...din.Pecuaria };
            agr = { ...din.Agricola };
            out = { ...din.Outros };
            tot = { ...din.Total };
          }

          porEmpresa[emp] = {
            Pecuaria: pec,
            Agricola: agr,
            Outros: out,
            Total: tot,
            status: empStatus
          };
        }
      }

      // Total consolidado das duas filiais
      let statusTotal = defaultStatus;
      let total = {
        Pecuaria: initSegment(),
        Agricola: initSegment(),
        Outros: initSegment(),
        Total: initSegment()
      };

      const hasFilial1 = !!fechadosMap[`028501_${m.ano}_${m.mes}`];
      const hasFilial2 = !!fechadosMap[`028503_${m.ano}_${m.mes}`];

      if (hasFilial1 && hasFilial2) {
        statusTotal = 'fechado';
        const f1 = fechadosMap[`028501_${m.ano}_${m.mes}`];
        const f2 = fechadosMap[`028503_${m.ano}_${m.mes}`];

        for (const seg of ['Pecuaria', 'Agricola', 'Outros', 'Total']) {
          const s1 = f1[seg];
          const s2 = f2[seg];
          const st = total[seg];
          st.receita = s1.receita + s2.receita;
          st.intercompany = (s1.intercompany || 0) + (s2.intercompany || 0);
          st.intercompany = (s1.intercompany || 0) + (s2.intercompany || 0);
          st.sacas = s1.sacas + s2.sacas;
          st.cabecas = s1.cabecas + s2.cabecas;
          st.funrural = s1.funrural + s2.funrural;
          st.gta = s1.gta + s2.gta;
          st.fethab = s1.fethab + s2.fethab;
          st.vlrFacs = s1.vlrFacs + s2.vlrFacs;
          st.receitaUsd = s1.receitaUsd + s2.receitaUsd;
          st.intercompanyUsd = (s1.intercompanyUsd || 0) + (s2.intercompanyUsd || 0);
          st.intercompanyUsd = (s1.intercompanyUsd || 0) + (s2.intercompanyUsd || 0);
          st.funruralUsd = s1.funruralUsd + s2.funruralUsd;
          st.gtaUsd = s1.gtaUsd + s2.gtaUsd;
          st.fethabUsd = s1.fethabUsd + s2.fethabUsd;
          st.vlrFacsUsd = s1.vlrFacsUsd + s2.vlrFacsUsd;
          st.dolarMedio = st.receitaUsd > 0 ? st.receita / st.receitaUsd : 0;
        }
        total.status = 'fechado';
        total.dtFechamento = f1.dtFechamento || f2.dtFechamento;
      } else if (isTodasClosed) {
        statusTotal = 'fechado';
        total = {
          Pecuaria: { ...fTodas.Pecuaria },
          Agricola: { ...fTodas.Agricola },
          Outros: { ...fTodas.Outros },
          Total: { ...fTodas.Total },
          status: 'fechado',
          dtFechamento: fTodas.dtFechamento
        };
      } else {
        for (const seg of ['Pecuaria', 'Agricola', 'Outros', 'Total']) {
          const s1 = porEmpresa['028501'][seg];
          const s2 = porEmpresa['028503'][seg];
          const st = total[seg];
          st.receita = s1.receita + s2.receita;
          st.intercompany = (s1.intercompany || 0) + (s2.intercompany || 0);
          st.sacas = s1.sacas + s2.sacas;
          st.cabecas = s1.cabecas + s2.cabecas;
          st.funrural = s1.funrural + s2.funrural;
          st.gta = s1.gta + s2.gta;
          st.fethab = s1.fethab + s2.fethab;
          st.vlrFacs = s1.vlrFacs + s2.vlrFacs;
          st.receitaUsd = s1.receitaUsd + s2.receitaUsd;
          st.intercompanyUsd = (s1.intercompanyUsd || 0) + (s2.intercompanyUsd || 0);
          st.funruralUsd = s1.funruralUsd + s2.funruralUsd;
          st.gtaUsd = s1.gtaUsd + s2.gtaUsd;
          st.fethabUsd = s1.fethabUsd + s2.fethabUsd;
          st.vlrFacsUsd = s1.vlrFacsUsd + s2.vlrFacsUsd;
          st.dolarMedio = st.receitaUsd > 0 ? st.receita / st.receitaUsd : 0;
        }

        const f1Closed = porEmpresa['028501'].status === 'fechado';
        const f2Closed = porEmpresa['028503'].status === 'fechado';

        const f1HasData = porEmpresa['028501'].Total.receita > 0 || porEmpresa['028501'].Total.sacas > 0 || porEmpresa['028501'].Total.cabecas > 0;
        const f2HasData = porEmpresa['028503'].Total.receita > 0 || porEmpresa['028503'].Total.sacas > 0 || porEmpresa['028503'].Total.cabecas > 0;

        if ((f1Closed || !f1HasData) && (f2Closed || !f2HasData) && (f1HasData || f2HasData)) {
          statusTotal = 'fechado';
        } else if (total.Total.receita > 0 || total.Total.sacas > 0 || total.Total.cabecas > 0) {
          if (statusTotal === 'aguardando') {
            statusTotal = 'dinamico_anterior';
          }
        }

        total.status = statusTotal;
      }
      porEmpresa['TOTAL'] = total;

      return { ano: m.ano, mes: m.mes, status: statusTotal, porEmpresa };
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

    // Filtrar pela empresa solicitada (ou manter todas se for consolidado)
    const rowsEmp = empresa === 'TODAS'
      ? rows
      : rows.filter(r => r.EMPRESA === empresa);

    // Calcular o dólar médio ponderado mensal do lote fechado
    let totalBrl = 0;
    let totalUsd = 0;
    for (const r of rowsEmp) {
      totalBrl += Number(r.TOTAL || 0);
      totalUsd += Number(r.TOTAL_USD || 0);
    }
    const dolarMedio = totalUsd > 0 ? (totalBrl / totalUsd) : null;

    // Agregar totais consolidados para a empresa solicitada
    let receita = 0, intercompany = 0, sacas = 0, cabecas = 0, funrural = 0, gta = 0, fethab = 0, vlrFacs = 0;
    const nfsSet = new Set();

    for (const r of rowsEmp) {
      const tot = Number(r.TOTAL || 0);
      if (r.TIPOFECHA === 'Intercompany') {
        intercompany += Math.abs(tot);
      } else {
        receita += tot;
      }
      const sac = Number(r.SACAS || 0);
      const cab = Number(r.CABECAS || 0);
      sacas += sac;
      cabecas += cab;
      funrural += Number(r.VL_FUNRURAL || 0);
      gta += 0; // GTA não vem da view de fechamento dinâmico
      fethab += Number(r.VLR_FETHAB || 0);
      vlrFacs += Number(r.VLR_FACS || 0);
      if (r.NF) nfsSet.add(r.NF);
    }
    const qtdNfs = nfsSet.size;

    // MERGE INTO FECHAMENTO_RECEITA
    const mergeSql = `
      MERGE INTO FECHAMENTO_RECEITA fr
      USING DUAL ON (fr.FR_EMPRESA = :empresa AND fr.FR_ANO = :ano AND fr.FR_MES = :mes AND fr.FR_RUBRICA = 'RECEITA')
      WHEN MATCHED THEN UPDATE SET
        fr.FR_RECEITA_TOTAL  = :receita,
        fr.FR_INTERCOMPANY   = :intercompany,
        fr.FR_SACAS          = :sacas,
        fr.FR_QTD_NFS        = :qtdNfs,
        fr.FR_FUNRURAL       = :funrural,
        fr.FR_GTA            = :gta,
        fr.FR_FETHAB         = :fethab,
        fr.FR_VLR_FACS       = :vlrFacs,
        fr.FR_DOLAR_MEDIO    = :dolarMedio,
        fr.FR_DT_FECHAMENTO  = SYSDATE
      WHEN NOT MATCHED THEN INSERT
        (FR_EMPRESA, FR_ANO, FR_MES, FR_RUBRICA, FR_RECEITA_TOTAL, FR_INTERCOMPANY, FR_SACAS, FR_QTD_NFS,
         FR_FUNRURAL, FR_GTA, FR_FETHAB, FR_VLR_FACS, FR_DOLAR_MEDIO, FR_DT_FECHAMENTO)
      VALUES
        (:empresa, :ano, :mes, 'RECEITA', :receita, :intercompany, :sacas, :qtdNfs,
         :funrural, :gta, :fethab, :vlrFacs, :dolarMedio, SYSDATE)
    `;

    await db.execute(mergeSql, {
      empresa, ano: parseInt(ano), mes: parseInt(mes),
      receita, intercompany, sacas, qtdNfs,
      funrural, gta, fethab, vlrFacs,
      dolarMedio
    }, { autoCommit: true });

    res.json({
      success: true,
      mensagem: `Mês ${mes}/${ano} fechado com sucesso para empresa ${empresa}.`,
      dados: { empresa, ano, mes, dolarMedio }
    });
  } catch (err) {
    console.error('[receita/fechar-mes]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/receita/fechados — lista de meses fechados gravados
app.get('/api/receita/fechados', async (req, res) => {
  try {
    const { ano, mes, filial, negocio } = req.query;
    let whereClause = "WHERE FR_RUBRICA = 'RECEITA'";
    let binds = {};

    if (ano) {
      whereClause += " AND FR_ANO = :ano";
      binds.ano = parseInt(ano);
    }
    if (mes) {
      whereClause += " AND FR_MES = :mes";
      binds.mes = parseInt(mes);
    }
    if (filial) {
      whereClause += " AND FR_EMPRESA = :filial";
      binds.filial = filial;
    }
    if (negocio) {
      whereClause += " AND FR_NEGOCIO = :negocio";
      binds.negocio = negocio;
    }

    const sql = `
      SELECT FR_ID, FR_EMPRESA, FR_ANO, FR_MES, FR_RUBRICA,
             FR_RECEITA_TOTAL, FR_INTERCOMPANY, FR_SACAS, FR_QTD_NFS, FR_FUNRURAL, FR_GTA, FR_FETHAB, FR_VLR_FACS,
             FR_DOLAR_MEDIO, FR_NEGOCIO,
             FR_DT_FECHAMENTO, FR_USUARIO, FR_OBS
      FROM FECHAMENTO_RECEITA
      ${whereClause}
      ORDER BY FR_ANO DESC, FR_MES DESC, FR_EMPRESA
    `;
    let rows = [];
    try {
      rows = await db.execute(sql, binds);
    } catch (e) {
      console.warn('[receita/fechados] tabela não existe ainda:', e.message);
    }
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[receita/fechados]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/receita/fechamento/:id — atualiza dados de um fechamento gravado
app.put('/api/receita/fechamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      receitaTotal, intercompany, sacas, qtdNfs, funrural, gta, fethab, vlrFacs,
      dolarMedio, obs
    } = req.body;

    const sql = `
      UPDATE FECHAMENTO_RECEITA SET
        FR_RECEITA_TOTAL  = :receitaTotal,
        FR_INTERCOMPANY   = :intercompany,
        FR_SACAS          = :sacas,
        FR_QTD_NFS        = :qtdNfs,
        FR_FUNRURAL       = :funrural,
        FR_GTA            = :gta,
        FR_FETHAB         = :fethab,
        FR_VLR_FACS       = :vlrFacs,
        FR_DOLAR_MEDIO    = :dolarMedio,
        FR_OBS            = :obs,
        FR_DT_FECHAMENTO  = SYSDATE
      WHERE FR_ID = :id
    `;

    await db.execute(sql, {
      id: parseInt(id),
      receitaTotal: Number(receitaTotal || 0),
      intercompany: Number(intercompany || 0),
      sacas: Number(sacas || 0),
      qtdNfs: parseInt(qtdNfs || 0),
      funrural: Number(funrural || 0),
      gta: Number(gta || 0),
      fethab: Number(fethab || 0),
      vlrFacs: Number(vlrFacs || 0),
      dolarMedio: dolarMedio ? Number(dolarMedio) : null,
      obs: obs || ''
    }, { autoCommit: true });

    res.json({ success: true, mensagem: 'Fechamento updated com sucesso.' });
  } catch (err) {
    console.error('[receita/fechamento/update]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/receita/fechamento — inclui um novo fechamento manual
app.post('/api/receita/fechamento', async (req, res) => {
  try {
    const {
      periodo, filial, negocio, // "periodo" = YYYY-MM
      receitaTotal, intercompany, sacas, qtdNfs, funrural, gta, fethab, vlrFacs,
      dolarMedio, obs
    } = req.body;

    if (!periodo || !filial || !negocio) {
      return res.status(400).json({ success: false, error: 'Período, filial e negócio são obrigatórios.' });
    }

    const [ano, mes] = periodo.split('-');

    // Controle de integridade
    const checkSql = `
      SELECT COUNT(*) as QTD FROM FECHAMENTO_RECEITA
      WHERE FR_EMPRESA = :filial AND FR_ANO = :ano AND FR_MES = :mes AND FR_NEGOCIO = :negocio AND FR_RUBRICA = 'RECEITA'
    `;
    const checkResult = await db.execute(checkSql, { filial, ano: parseInt(ano), mes: parseInt(mes), negocio });
    if (checkResult[0] && checkResult[0].QTD > 0) {
      return res.status(400).json({ success: false, error: 'Já existe um fechamento para esta Filial, Mês/Ano e Negócio.' });
    }

    const sql = `
      INSERT INTO FECHAMENTO_RECEITA (
        FR_EMPRESA, FR_ANO, FR_MES, FR_NEGOCIO, FR_RUBRICA,
        FR_RECEITA_TOTAL, FR_INTERCOMPANY, FR_SACAS, FR_QTD_NFS, FR_FUNRURAL, FR_GTA, FR_FETHAB, FR_VLR_FACS,
        FR_DOLAR_MEDIO, FR_OBS, FR_DT_FECHAMENTO
      ) VALUES (
        :filial, :ano, :mes, :negocio, 'RECEITA',
        :receitaTotal, :intercompany, :sacas, :qtdNfs, :funrural, :gta, :fethab, :vlrFacs,
        :dolarMedio, :obs, SYSDATE
      )
    `;

    await db.execute(sql, {
      filial, ano: parseInt(ano), mes: parseInt(mes), negocio,
      receitaTotal: Number(receitaTotal || 0),
      intercompany: Number(intercompany || 0),
      sacas: Number(sacas || 0),
      qtdNfs: parseInt(qtdNfs || 0),
      funrural: Number(funrural || 0),
      gta: Number(gta || 0),
      fethab: Number(fethab || 0),
      vlrFacs: Number(vlrFacs || 0),
      dolarMedio: dolarMedio ? Number(dolarMedio) : null,
      obs: obs || ''
    }, { autoCommit: true });

    res.json({ success: true, mensagem: 'Fechamento incluído com sucesso.' });
  } catch (err) {
    console.error('[receita/fechamento/insert]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/receita/fechamento/:id — exclui um fechamento manual
app.delete('/api/receita/fechamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `DELETE FROM FECHAMENTO_RECEITA WHERE FR_ID = :id`;
    await db.execute(sql, { id: parseInt(id) }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Fechamento excluído com sucesso.' });
  } catch (err) {
    console.error('[receita/fechamento/delete]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// ROTAS DE PARÂMETROS — params.json
// ============================================================

// GET /api/params — retorna parâmetros do arquivo
app.get('/api/params', (req, res) => {
  try {
    const data = loadParamsFile();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/params — salva parâmetros no arquivo
app.post('/api/params', (req, res) => {
  try {
    const current = loadParamsFile();
    const updated = { ...current, ...req.body };
    saveParamsFile(updated);
    res.json({ success: true, mensagem: 'Parâmetros salvos com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/insumos/tipos - Busca os tipos de insumo dinamicamente na sbm020
app.get('/api/insumos/tipos', async (req, res) => {
  const sql = `
    SELECT trim(bm_grupo) as bm_grupo, trim(bm_desc) as bm_desc 
    FROM protheus11.sbm020  
    WHERE bm_grupo like '02%'
      AND length(trim(bm_grupo)) = 4
  `;
  try {
    const rows = await db.execute(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Erro ao buscar tipos de insumo:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// MÓDULO FECHAMENTO FINANCEIRO — INSUMOS
// ============================================================

// Builder do SQL de Insumos — com outer join na ZA5020
// Retorna VLR_RS (valor em R$, independente da moeda do produto) e PTAX
// VLR_RS: se za5_moeda='1' (Real) → za5_vcompr; se '2' (Dólar) → za5_vcompr × za5_ptax
// Custo final: CONSUMO × VLR_RS  (sempre em BRL)
// USD display: CUSTO_BRL / PTAX  (calculado no JavaScript)
function buildInsumosSQL(opts = {}) {
  const { fazendaFiltro = '', produtoFiltro = '', tipoInsumoFiltro = '', za5_safra = '20251', za5_filial = '0285' } = opts;

  let extraWhere = '';
  if (fazendaFiltro) {
    const fz = fazendaFiltro.replace(/'/g, '');
    extraWhere += ` AND UPPER(u1.de_upnivel1) LIKE '%${fz.toUpperCase()}%'`;
  }
  if (produtoFiltro) {
    const pr = produtoFiltro.replace(/'/g, '');
    extraWhere += ` AND UPPER(b1.b1_desc) LIKE '%${pr.toUpperCase()}%'`;
  }
  if (tipoInsumoFiltro && tipoInsumoFiltro !== 'todos') {
    const tipoVal = tipoInsumoFiltro.replace(/'/g, '');
    extraWhere += ` AND substr(b1_grupo, 1, 4) = '${tipoVal}'`;
  }

  const sf_za5 = String(za5_safra).replace(/'/g, '');
  const fi_za5 = String(za5_filial).replace(/'/g, '');

  const baseSafra = parseInt(sf_za5.substring(0, 4)) || 2025;
  const safraList = `'${baseSafra}1', '${baseSafra}2', '${baseSafra}3'`;

  return `
    SELECT DISTINCT
      TRIM(e.cd_empresa)            AS EMPRESA_COD,
      ua.regiao                     AS REGIAO,
      u1.de_upnivel1                AS FAZENDA,
      u3.cd_upnivel3                AS TALHAO,
      ps.de_per_safra               AS PERIODO_SAFRA,
      vr.de_variedade               AS VARIEDADE,
      z0.zo0_anoagr                 AS SAFRA,
      TO_DATE(z0.zo0_data, 'yyyy/mm/dd') AS DDATA,
      z0.zo0_codigo                 AS O_S,
      TRIM(bm.bm_desc)              AS TIPO_PRODUTO,
      substr(b1_grupo, 1, 4)        AS GRUPO,
      TRIM(bm.bm_desc)              AS SUBGRUPO,
      z1.zo1_codpro                 AS CODPROD,
      b1.b1_desc                    AS PRODUTO,
      u3.qt_area_prod               AS AREA_PLAN,
      z4.zo4_haapli                 AS AREA_APLIC,
      (SELECT SUM(z41.zo4_haapli)
         FROM protheus11.zo4020 z41
        WHERE z41.zo4_codigo = z0.zo0_codigo
          AND z41.d_e_l_e_t_ <> '*') AS AREA_APLT,
      z1.zo1_qtdcon                 AS CONSUMO,
      za.za5_moeda                  AS ZA5_MOEDA,
      CASE za.za5_moeda
        WHEN '1' THEN NVL(za.za5_vcompr, 0)
        ELSE NVL(za.za5_vcompr, 0) * NVL(za.za5_ptax, 1)
      END                           AS VLR_RS,
      NVL(za.za5_ptax, 0)           AS PTAX
    FROM protheus11.zo4020         z4,
         protheus11.zo1020         z1,
         protheus11.zo0020         z0,
         protheus11.sb1020         b1,
         protheus11.sbm020         bm,
         protheus11.za5020         za,
         unidadeadm@PIMSGRAOSAGR   ua,
         upnivel2@PIMSGRAOSAGR     u2,
         upnivel1@PIMSGRAOSAGR     u1,
         filial@PIMSGRAOSAGR       f,
         empresa@PIMSGRAOSAGR      e,
         upnivel3@PIMSGRAOSAGR     u3,
         variedade@PIMSGRAOSAGR    vr,
         periodosafra@PIMSGRAOSAGR ps,
         safra@PIMSGRAOSAGR        sf
   WHERE z4.zo4_codigo = z0.zo0_codigo
     AND z0.zo0_codemp = '85'
     AND z0.zo0_anoagr in (${safraList})
     AND z0.zo0_codigo = z1.zo1_codigo
     AND z1.zo1_codpro = b1.b1_cod
     AND substr(b1.b1_grupo, 1, 4) || '   ' = bm.bm_grupo
     AND ua.id_filial = f.id_filial
     AND f.id_empresa = e.id_empresa
     AND CAST(TRIM(z0.zo0_codagl) AS VARCHAR(6)) = ua.cd_int_erp
     AND CAST(TRIM(z4.zo4_codset) AS VARCHAR(6)) = u2.cd_upnivel2
     AND u2.id_upnivel1 = u1.id_upnivel1
     AND u1.id_unidadeadm = ua.id_unidadeadm
     AND u3.id_upnivel2 = u2.id_upnivel2
     AND u3.id_periodosafra = ps.id_periodosafra
     AND trim(TO_CHAR(ps.cd_per_safra)) = TRIM(z0.zo0_perpro)
     AND ps.id_safra = sf.id_safra
     AND TRIM(sf.da_safra) = TRIM(z0.zo0_anoagr)
     AND TRIM(e.cd_empresa) = TRIM(z0.zo0_codemp)
     AND u3.id_variedade = vr.id_variedade
     AND z1.zo1_qtdcon <> 0
     AND ((trim(TO_CHAR(nvl(u3.cd_upnivel3, 0))) = trim(nvl(z4.zo4_codtal, ' ')))
          OR (TRIM(u3.id_upnivel3) = TRIM(z4.zo4_idupn3)))
     AND ' '         = za.d_e_l_e_t_(+)
     AND '${sf_za5}' = za.za5_safra(+)
     AND '${fi_za5}' = za.za5_filial(+)
     AND z1.zo1_codpro = za.za5_produt(+)
     AND z4.d_e_l_e_t_ = ' '
     AND z1.d_e_l_e_t_ = ' '
     AND z0.d_e_l_e_t_ = ' '
     AND b1.d_e_l_e_t_ = ' '
     AND bm.d_e_l_e_t_ = ' '
     AND b1_grupo like '02%'
     AND z0.zo0_data >= REPLACE(:data_de, '-', '')
     AND z0.zo0_data <= REPLACE(:data_ate, '-', '')
     ${extraWhere}
  `;
}

// Mapeia EMPRESA_COD do Protheus (ex: '85') para filial ERP (ex: '028501')
// Como o SQL retorna cd_empresa do PIMS mas não a filial Protheus diretamente,
// usaremos a lógica: todos os registros filtrados pelo zo0_codemp='85' pertencem
// à empresa 028501 por padrão (Futurazy Agrícola). Empresas múltiplas serão
// diferenciadas por ua.cd_int_erp quando disponível.
// Por ora, EMPRESA_COD retorna o código Protheus. Mapeamos:
function mapEmpresaCod(cod) {
  // Ajustar conforme necessidade do banco
  const str = String(cod || '').trim();
  if (str === '85' || str === '085') return '028501';
  if (str === '8503') return '028503';
  // Se o campo retornar diretamente '028501' ou similar, retorna como está
  return str || '028501';
}

// Calcula custo em BRL: consumo × VLR_RS (já convertido para R$ no SQL)
// USD display: custo_brl / ptax (calculado dinamicamente no frontend)
function calcCustos(rows) {
  return rows.map(r => {
    const consumo = Number(r.CONSUMO || 0);
    const vlrRs = Number(r.VLR_RS || 0);
    const ptax = Number(r.PTAX || 0);
    const custoBrl = consumo * vlrRs;
    const custoUsd = (ptax > 0) ? (custoBrl / ptax) : 0;
    return {
      ...r,
      EMPRESA: mapEmpresaCod(r.EMPRESA_COD),
      CUSTO_BRL: custoBrl,
      CUSTO_USD: custoUsd,
      PTAX: ptax,
    };
  });
}

// Agrega por mês/empresa/tipo/subgrupo para o resumo anual
// Guarda totalBrl (gravado no fechamento) e ptaxMedio (ponderado pelo custo)
function agregarInsumosPorMes(rows) {
  const map = {};

  for (const r of rows) {
    const ddata = r.DDATA instanceof Date ? r.DDATA : (r.DDATA ? new Date(r.DDATA) : null);
    if (!ddata || isNaN(ddata)) continue;

    const emp = r.EMPRESA || '028501';
    const ano = ddata.getFullYear();
    const mes = ddata.getMonth() + 1;
    const tipo = r.TIPO_PRODUTO || 'OUTROS';
    const subgrp = r.SUBGRUPO || '(sem subgrupo)';

    const key = `${emp}_${ano}_${mes}`;
    if (!map[key]) {
      map[key] = {
        empresa: emp, ano, mes,
        totalBrl: 0, totalUsd: 0, ptaxSumPeso: 0, ptaxPeso: 0, // para média ponderada
        porTipo: {}, subgrupos: {}
      };
    }
    const M = map[key];

    const brl = Number(r.CUSTO_BRL || 0);
    const usd = Number(r.CUSTO_USD || 0);
    const ptax = Number(r.PTAX || 0);

    M.totalBrl += brl;
    M.totalUsd = (M.totalUsd || 0) + usd;
    // Média ponderada de PTAX pelo custo BRL
    if (ptax > 0 && brl > 0) {
      M.ptaxSumPeso += brl;       // soma dos pesos
      M.ptaxPeso += brl * ptax; // soma ponderada
    }

    if (!M.porTipo[tipo]) M.porTipo[tipo] = { custoBrl: 0, custoUsd: 0 };
    M.porTipo[tipo].custoBrl += brl;
    M.porTipo[tipo].custoUsd += usd;

    if (!M.subgrupos[tipo]) M.subgrupos[tipo] = {};
    if (!M.subgrupos[tipo][subgrp]) M.subgrupos[tipo][subgrp] = { custoBrl: 0 };
    M.subgrupos[tipo][subgrp].custoBrl += brl;
  }

  // Calcular ptaxMedio para cada mês
  return Object.values(map).map(m => ({
    ...m,
    ptaxMedio: m.ptaxSumPeso > 0 ? (m.ptaxPeso / m.ptaxSumPeso) : 0,
    totalUsd: m.ptaxSumPeso > 0 ? (m.totalBrl / (m.ptaxPeso / m.ptaxSumPeso)) : 0,
  }));
}

// Helper safra year (já existe no módulo Receitas, repetimos para independência)
function getSafraYearIns(hoje = new Date()) {
  return hoje.getMonth() + 1 >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}
function getMesesSafraIns(anoSafra) {
  return [
    { ano: anoSafra - 1, mes: 9 }, { ano: anoSafra - 1, mes: 10 },
    { ano: anoSafra - 1, mes: 11 }, { ano: anoSafra - 1, mes: 12 },
    { ano: anoSafra, mes: 1 }, { ano: anoSafra, mes: 2 },
    { ano: anoSafra, mes: 3 }, { ano: anoSafra, mes: 4 },
    { ano: anoSafra, mes: 5 }, { ano: anoSafra, mes: 6 },
    { ano: anoSafra, mes: 7 }, { ano: anoSafra, mes: 8 }
  ];
}
function getMesesCalendarioIns(ano) {
  return Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1 }));
}
function dateToStrIns(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function getMonthRangeIns(ano, mes) {
  return {
    dataDe: dateToStrIns(new Date(ano, mes - 1, 1)),
    dataAte: dateToStrIns(new Date(ano, mes, 0))
  };
}

// GET /api/insumos/dados — dados brutos para o cubo drill-down
app.get('/api/insumos/dados', async (req, res) => {
  try {
    const hoje = new Date();
    const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const currLast = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const dataDe = req.query.data_de || dateToStrIns(prevDate);
    const dataAte = req.query.data_ate || dateToStrIns(currLast);

    const params = loadParamsFile();
    const p = params.insumos || {};

    const sql = buildInsumosSQL({
      fazendaFiltro: (req.query.fazenda || '').trim(),
      produtoFiltro: (req.query.produto || '').trim(),
      tipoInsumoFiltro: (req.query.tipo_insumo || '').trim(),
      za5_safra: p.za5_safra || '20251',
      za5_filial: p.za5_filial || '0285',
    });

    const rows = await db.execute(sql, { data_de: dataDe, data_ate: dataAte });
    const result = calcCustos(rows);

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    console.error('[insumos/dados]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/insumos/resumo-anual — resumo de 12 meses (safra ou calendário)
app.get('/api/insumos/resumo-anual', async (req, res) => {
  try {
    const hoje = new Date();
    const anoSafra = parseInt(req.query.ano_safra) || getSafraYearIns(hoje);
    const tipoCalend = req.query.tipo || 'safra';
    const anoCalend = parseInt(req.query.ano) || hoje.getFullYear();

    const meses = tipoCalend === 'calendario'
      ? getMesesCalendarioIns(anoCalend)
      : getMesesSafraIns(anoSafra);

    const mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

    // 1. Buscar fechados na tabela FECHAMENTO_INSUMOS
    const fechadosSQL = `
      SELECT FI_EMPRESA, FI_ANO, FI_MES, FI_TIPO_INSUMO, FI_CUSTO_TOTAL, FI_PTAX, FI_DT_FECHAMENTO
      FROM FECHAMENTO_INSUMOS
      ORDER BY FI_ANO, FI_MES
    `;
    let fechados = [];
    try {
      fechados = await db.execute(fechadosSQL);
    } catch (e) {
      console.warn('[insumos/resumo-anual] FECHAMENTO_INSUMOS não encontrada:', e.message);
    }

    // Montar mapa de fechados
    const fechadosMap = {}; // key: empresa_ano_mes → { totalBrl, ptaxMedio, porTipo, subgrupos, dtFechamento }
    for (const f of fechados) {
      const key = `${f.FI_EMPRESA}_${f.FI_ANO}_${f.FI_MES}`;
      if (!fechadosMap[key]) {
        fechadosMap[key] = { totalBrl: 0, ptaxMedio: 0, porTipo: {}, subgrupos: {}, dtFechamento: f.FI_DT_FECHAMENTO };
      }
      const M = fechadosMap[key];
      const brl = Number(f.FI_CUSTO_TOTAL || 0);
      const ptax = Number(f.FI_PTAX || 0);
      const usd = ptax > 0 ? (brl / ptax) : 0;
      const tipo = (f.FI_TIPO_INSUMO || 'TOTAL').toUpperCase();

      if (tipo !== 'TOTAL') {
        M.totalBrl += brl;
        M.totalUsd = (M.totalUsd || 0) + usd;
        if (!M.porTipo[tipo]) M.porTipo[tipo] = { custoBrl: 0, custoUsd: 0 };
        M.porTipo[tipo].custoBrl += brl;
        M.porTipo[tipo].custoUsd += usd;
        if (!M.subgrupos[tipo]) M.subgrupos[tipo] = {};
      } else {
        M.totalBrl = brl;
        M.totalUsd = usd;
        M.ptaxMedio = ptax;
      }
    }

    // 2. Identificar meses dinâmicos
    const hasDetailFilter = !!(req.query.fazenda || req.query.produto || req.query.tipo_insumo);
    const dinamicos = meses.filter(m => {
      const isFuturo = new Date(m.ano, m.mes - 1, 1) > hoje;
      if (isFuturo) return false;
      if (m.ano === mesAtual.ano && m.mes === mesAtual.mes) return true;
      if (m.ano === mesAnterior.ano && m.mes === mesAnterior.mes) return true;
      return false;
    });

    // 3. Buscar dados dinâmicos
    let dadosDinamicos = [];
    if (dinamicos.length > 0) {
      const timestamps = dinamicos.map(m => new Date(m.ano, m.mes - 1, 1).getTime());
      const timestampsAte = dinamicos.map(m => new Date(m.ano, m.mes, 0).getTime());
      const dataDe = dateToStrIns(new Date(Math.min(...timestamps)));
      const dataAte = dateToStrIns(new Date(Math.max(...timestampsAte)));

      const params = loadParamsFile();
      const p = params.insumos || {};
      const sql = buildInsumosSQL({
        fazendaFiltro: (req.query.fazenda || '').trim(),
        produtoFiltro: (req.query.produto || '').trim(),
        tipoInsumoFiltro: (req.query.tipo_insumo || '').trim(),
        za5_safra: p.za5_safra || '20251',
        za5_filial: p.za5_filial || '0285',
      });

      try {
        const rowsDin = await db.execute(sql, { data_de: dataDe, data_ate: dataAte });
        dadosDinamicos = agregarInsumosPorMes(calcCustos(rowsDin));
      } catch (e) {
        console.error('[insumos/resumo-anual] SQL dinâmico:', e.message);
      }
    }

    // 4. Montar array de 12 meses
    function initPorEmpresa() {
      return { totalBrl: 0, totalUsd: 0, porTipo: {}, subgrupos: {}, status: 'aguardando' };
    }

    const resultado = meses.map(m => {
      const isMesAtual = m.ano === mesAtual.ano && m.mes === mesAtual.mes;
      const isMesAnterior = m.ano === mesAnterior.ano && m.mes === mesAnterior.mes;
      const isFuturo = new Date(m.ano, m.mes - 1, 1) > hoje;

      let defaultStatus = 'futuro';
      if (isMesAtual) defaultStatus = 'dinamico_atual';
      else if (isMesAnterior) defaultStatus = 'dinamico_anterior';
      else if (!isFuturo) defaultStatus = 'aguardando';

      const porEmpresa = {};

      for (const emp of ['028501', '028503']) {
        const keyFech = `${emp}_${m.ano}_${m.mes}`;
        const f = fechadosMap[keyFech];

        if (f) {
          porEmpresa[emp] = {
            totalBrl: f.totalBrl,
            totalUsd: f.totalUsd || 0,
            ptaxMedio: f.ptaxMedio,
            porTipo: { ...f.porTipo },
            subgrupos: { ...f.subgrupos },
            status: 'fechado',
            dtFechamento: f.dtFechamento
          };
        } else {
          const din = dadosDinamicos.find(d => d.empresa === emp && d.ano === m.ano && d.mes === m.mes);
          if (din) {
            porEmpresa[emp] = {
              totalBrl: din.totalBrl,
              totalUsd: din.totalUsd,
              porTipo: din.porTipo,
              subgrupos: din.subgrupos,
              status: defaultStatus
            };
          } else {
            porEmpresa[emp] = { ...initPorEmpresa(), status: defaultStatus };
          }
        }
      }

      // Consolidado TOTAL
      const t = initPorEmpresa();
      for (const emp of ['028501', '028503']) {
        const e = porEmpresa[emp];
        t.totalBrl += e.totalBrl;
        t.totalUsd = (t.totalUsd || 0) + (e.totalUsd || 0);
        if (e.ptaxMedio > 0 && e.totalBrl > 0) {
          // para média ponderada global (usando var auxiliar para acumular pesos)
          if (!t._ptaxSumPeso) t._ptaxSumPeso = 0;
          if (!t._ptaxPeso) t._ptaxPeso = 0;
          t._ptaxSumPeso += e.totalBrl;
          t._ptaxPeso += e.totalBrl * e.ptaxMedio;
        }
        // Merge porTipo
        for (const [tipo, v] of Object.entries(e.porTipo || {})) {
          if (!t.porTipo[tipo]) t.porTipo[tipo] = { custoBrl: 0, custoUsd: 0 };
          t.porTipo[tipo].custoBrl += v.custoBrl || 0;
          t.porTipo[tipo].custoUsd += v.custoUsd || 0;
        }
        // Merge subgrupos
        for (const [tipo, subs] of Object.entries(e.subgrupos || {})) {
          if (!t.subgrupos[tipo]) t.subgrupos[tipo] = {};
          for (const [sg, sv] of Object.entries(subs)) {
            if (!t.subgrupos[tipo][sg]) t.subgrupos[tipo][sg] = { custoBrl: 0 };
            t.subgrupos[tipo][sg].custoBrl += sv.custoBrl || 0;
          }
        }
      }
      if (t._ptaxSumPeso > 0) t.ptaxMedio = t._ptaxPeso / t._ptaxSumPeso;
      const statusSet = new Set(Object.values(porEmpresa).map(e => e.status));
      t.status = statusSet.has('fechado') && statusSet.size === 1 ? 'fechado'
        : statusSet.has('dinamico_atual') ? 'dinamico_atual'
          : statusSet.has('dinamico_anterior') ? 'dinamico_anterior'
            : defaultStatus;
      porEmpresa['TOTAL'] = t;

      return { ano: m.ano, mes: m.mes, status: t.status, porEmpresa };
    });

    res.json({ success: true, anoSafra, tipoCalend, meses: resultado });
  } catch (err) {
    console.error('[insumos/resumo-anual]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/insumos/fechar-mes — grava fechamento na tabela FECHAMENTO_INSUMOS
app.post('/api/insumos/fechar-mes', async (req, res) => {
  try {
    const { empresa, mes, ano } = req.body;
    if (!empresa || !mes || !ano) {
      return res.status(400).json({ success: false, error: 'empresa, mes e ano são obrigatórios' });
    }

    const { dataDe, dataAte } = getMonthRangeIns(parseInt(ano), parseInt(mes));
    const params = loadParamsFile();
    const p = params.insumos || {};

    const sql = buildInsumosSQL({ za5_safra: p.za5_safra || '20251', za5_filial: p.za5_filial || '0285' });
    const rows = calcCustos(await db.execute(sql, { data_de: dataDe, data_ate: dataAte }));

    const rowsEmp = empresa === 'TODAS' ? rows : rows.filter(r => r.EMPRESA === empresa);

    // Agregar por tipo + calcular PTAX médio ponderado
    const totalMap = {};
    let grandBrl = 0, grandPtaxSumPeso = 0, grandPtaxPeso = 0;

    for (const r of rowsEmp) {
      const tipo = r.TIPO_PRODUTO || 'OUTROS';
      const brl = Number(r.CUSTO_BRL || 0);
      const ptax = Number(r.PTAX || 0);
      if (!totalMap[tipo]) totalMap[tipo] = { brl: 0, ptaxSumPeso: 0, ptaxPeso: 0 };
      totalMap[tipo].brl += brl;
      grandBrl += brl;
      if (ptax > 0 && brl > 0) {
        totalMap[tipo].ptaxSumPeso += brl;
        totalMap[tipo].ptaxPeso += brl * ptax;
        grandPtaxSumPeso += brl;
        grandPtaxPeso += brl * ptax;
      }
    }
    const grandPtax = grandPtaxSumPeso > 0 ? (grandPtaxPeso / grandPtaxSumPeso) : 0;

    const empresaGravar = empresa === 'TODAS' ? 'TODAS' : empresa;

    // Gravar um registro por tipo + um TOTAL (com FI_PTAX)
    const tipos_gravar = [...Object.keys(totalMap).filter(t => (totalMap[t]?.brl || 0) > 0), 'TOTAL'];

    for (const tipo of tipos_gravar) {
      const brl = tipo === 'TOTAL' ? grandBrl : (totalMap[tipo]?.brl || 0);
      const ptaxT = tipo === 'TOTAL' ? grandPtax
        : (totalMap[tipo]?.ptaxSumPeso > 0 ? (totalMap[tipo].ptaxPeso / totalMap[tipo].ptaxSumPeso) : 0);

      const mergeSql = `
        MERGE INTO FECHAMENTO_INSUMOS fi
        USING DUAL ON (fi.FI_EMPRESA = :empresa AND fi.FI_ANO = :ano AND fi.FI_MES = :mes AND fi.FI_TIPO_INSUMO = :tipo)
        WHEN MATCHED THEN UPDATE SET
          fi.FI_CUSTO_TOTAL    = :custoBrl,
          fi.FI_PTAX           = :ptaxVal,
          fi.FI_DT_FECHAMENTO  = SYSDATE
        WHEN NOT MATCHED THEN INSERT
          (FI_EMPRESA, FI_ANO, FI_MES, FI_TIPO_INSUMO, FI_CUSTO_TOTAL, FI_PTAX, FI_DT_FECHAMENTO)
        VALUES
          (:empresa, :ano, :mes, :tipo, :custoBrl, :ptaxVal, SYSDATE)
      `;
      await db.execute(mergeSql, {
        empresa: empresaGravar,
        ano: parseInt(ano),
        mes: parseInt(mes),
        tipo,
        custoBrl: brl,
        ptaxVal: ptaxT || null
      }, { autoCommit: true });
    }

    res.json({
      success: true,
      mensagem: `Mês ${mes}/${ano} fechado com sucesso para empresa ${empresaGravar}.`,
      dados: { empresa: empresaGravar, ano, mes, grandBrl, grandPtax }
    });
  } catch (err) {
    console.error('[insumos/fechar-mes]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/insumos/fechados — lista registros de FECHAMENTO_INSUMOS
app.get('/api/insumos/fechados', async (req, res) => {
  try {
    const { ano, mes, filial, tipo } = req.query;
    let where = 'WHERE 1=1';
    const binds = {};
    if (ano) { where += ' AND FI_ANO = :ano'; binds.ano = parseInt(ano); }
    if (mes) { where += ' AND FI_MES = :mes'; binds.mes = parseInt(mes); }
    if (filial) { where += ' AND FI_EMPRESA = :filial'; binds.filial = filial; }
    if (tipo) { where += ' AND FI_TIPO_INSUMO = :tipo'; binds.tipo = tipo; }

    const sql = `
      SELECT FI_ID, FI_EMPRESA, FI_ANO, FI_MES, FI_TIPO_INSUMO,
             FI_CUSTO_TOTAL, FI_PTAX, FI_DT_FECHAMENTO, FI_USUARIO, FI_OBS
      FROM FECHAMENTO_INSUMOS
      ${where}
      ORDER BY FI_ANO DESC, FI_MES DESC, FI_EMPRESA, FI_TIPO_INSUMO
    `;
    let rows = [];
    try {
      rows = await db.execute(sql, binds);
    } catch (e) {
      console.warn('[insumos/fechados] tabela não existe ainda:', e.message);
    }
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[insumos/fechados]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/insumos/fechamento/:id — atualiza registro manual
app.put('/api/insumos/fechamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { custoBrl, ptaxVal, obs } = req.body;
    const sql = `
      UPDATE FECHAMENTO_INSUMOS SET
        FI_CUSTO_TOTAL   = :custoBrl,
        FI_PTAX          = :ptaxVal,
        FI_OBS           = :obs,
        FI_DT_FECHAMENTO = SYSDATE
      WHERE FI_ID = :id
    `;
    await db.execute(sql, {
      id: parseInt(id),
      custoBrl: Number(custoBrl || 0),
      ptaxVal: ptaxVal ? Number(ptaxVal) : null,
      obs: obs || ''
    }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Fechamento atualizado com sucesso.' });
  } catch (err) {
    console.error('[insumos/fechamento/update]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/insumos/fechamento — inclui novo registro manual
app.post('/api/insumos/fechamento', async (req, res) => {
  try {
    const { periodo, filial, tipo, custoBrl, ptaxVal, obs } = req.body;
    if (!periodo || !filial || !tipo) {
      return res.status(400).json({ success: false, error: 'Período, filial e tipo são obrigatórios.' });
    }
    const [ano, mes] = periodo.split('-');

    const checkSql = `
      SELECT COUNT(*) AS QTD FROM FECHAMENTO_INSUMOS
      WHERE FI_EMPRESA = :filial AND FI_ANO = :ano AND FI_MES = :mes AND FI_TIPO_INSUMO = :tipo
    `;
    const check = await db.execute(checkSql, { filial, ano: parseInt(ano), mes: parseInt(mes), tipo });
    if (check[0] && check[0].QTD > 0) {
      return res.status(400).json({ success: false, error: 'Já existe um fechamento para esta Filial, Mês/Ano e Tipo.' });
    }

    const sql = `
      INSERT INTO FECHAMENTO_INSUMOS
        (FI_EMPRESA, FI_ANO, FI_MES, FI_TIPO_INSUMO, FI_CUSTO_TOTAL, FI_PTAX, FI_OBS, FI_DT_FECHAMENTO)
      VALUES
        (:filial, :ano, :mes, :tipo, :custoBrl, :ptaxVal, :obs, SYSDATE)
    `;
    await db.execute(sql, {
      filial, ano: parseInt(ano), mes: parseInt(mes), tipo,
      custoBrl: Number(custoBrl || 0),
      ptaxVal: ptaxVal ? Number(ptaxVal) : null,
      obs: obs || ''
    }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Fechamento incluído com sucesso.' });
  } catch (err) {
    console.error('[insumos/fechamento/insert]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/insumos/fechamento/:id — exclui registro manual
app.delete('/api/insumos/fechamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM FECHAMENTO_INSUMOS WHERE FI_ID = :id', { id: parseInt(id) }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Fechamento excluído com sucesso.' });
  } catch (err) {
    console.error('[insumos/fechamento/delete]', err);
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

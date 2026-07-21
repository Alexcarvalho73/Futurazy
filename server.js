require('dotenv').config();
const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const db = require('./db');
const { autenticar, registrarLog, TODOS_PAINEIS } = require('./auth');
const { requireAuth, requireAdmin } = require('./middleware/authMiddleware');

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
const HTTPS_PORT = 443;

// ─── Configuração de Sessão ────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'futurazy_fallback_secret_mude_em_producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,       // Requer HTTPS
    maxAge: 8 * 60 * 60 * 1000  // 8 horas
  }
}));

// ─── Servir arquivos estáticos - login.html é público, demais protegidos ───
app.use(express.json());

// Permitir acesso livre apenas ao login.html e recursos estáticos (css, js, fonts)
app.use((req, res, next) => {
  const publicPaths = ['/login.html', '/style.css'];
  const isPublicStatic = req.path.match(/\.(css|js|png|jpg|svg|ico|woff|woff2|ttf)$/);
  const isLoginPage = publicPaths.includes(req.path);
  const isApiPath = req.path.startsWith('/api/');
  const isRoot = req.path === '/';

  if (isLoginPage || isPublicStatic || isApiPath) {
    return next();
  }

  // Para páginas HTML protegidas, verificar sessão
  if (req.path.endsWith('.html') || isRoot) {
    if (!req.session || !req.session.usuario) {
      return res.redirect('/login.html');
    }
  }
  next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota de API para buscar os dados de tratos consumidos
app.get('/api/tratos', async (req, res) => {
  const sql = `
    SELECT 
      TRIM(NJH_FILIAL) as NJH_FILIAL,
      TRIM(NJH_DESPRO) as NJH_DESPRO,
      TRIM(NJH_NOMENT) as NJH_NOMENT,
      NJH_DATA,
      TRIM(NJH_PLACA) as NJH_PLACA,
      NJH_HORPS1,
      NJH_HORPS2,
      NJH_PSSUBT
    FROM protheus11.njh020
    WHERE NJH_STATUS = '3'
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
  const d1_cc = req.query.d1_cc || '';

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
        XM.XML_KEYF1,
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

  // Filtro de D1_CC (Centro de Custo)
  if (d1_cc) {
    baseWhere += ` AND EXISTS (
      SELECT 1 
      FROM PROTHEUS11.CONDORXMLITENS XI
      LEFT JOIN PROTHEUS11.SD1020 D1 ON D1.D_E_L_E_T_ = ' '
        AND ((D1.D1_FILIAL = TRIM(XM.XML_FIL)    
              AND D1.D1_DOC = SUBSTR(XI.XIT_KEYSD1,7,9)    
              AND D1.D1_SERIE = SUBSTR(XI.XIT_KEYSD1,16,3)    
              AND D1.D1_FORNECE = SUBSTR(XI.XIT_KEYSD1,19,6)    
              AND D1.D1_LOJA = SUBSTR(XI.XIT_KEYSD1,25,2)    
              AND D1.D1_ITEM = SUBSTR(XI.XIT_KEYSD1,42,4)
              AND XI.XIT_KEYSD1 <> ' ' ) 
             OR (D1.D1_FILIAL = TRIM(XM.XML_FIL)    
              AND D1.D1_DOC = SUBSTR(XM.XML_KEYF1,7,9)    
              AND D1.D1_SERIE = SUBSTR(XM.XML_KEYF1,16,3)    
              AND D1.D1_FORNECE = SUBSTR(XM.XML_KEYF1,19,6)    
              AND D1.D1_LOJA = SUBSTR(XM.XML_KEYF1,25,2)    
              AND D1.D1_ITEM = XI.XIT_ITEM 
              AND XI.XIT_KEYSD1 = ' ' ))     
      WHERE XI.D_E_L_E_T_ = ' '
        AND XI.XIT_CHAVE = XM.XML_CHAVE
        AND TRIM(D1.D1_CC) LIKE :d1_cc
    )`;
    baseBinds.d1_cc = `%${d1_cc.trim()}%`;
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
          AND D1_CF NOT IN ('1906','1101','1151','1933','1356','1922','1910')
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
    const { empresa, mes, ano, negocio } = req.body;
    if (!empresa || !mes || !ano || !negocio) {
      return res.status(400).json({ success: false, error: 'empresa, mes, ano e negocio são obrigatórios' });
    }
    if (empresa === 'TODAS') {
      return res.status(400).json({ success: false, error: 'Fechamento não permitido para a filial "Todas". Selecione uma filial específica.' });
    }

    // Buscar dados do mês a fechar
    const { dataDe, dataAte } = getMonthRange(parseInt(ano), parseInt(mes));
    const sql = buildReceitaSQL();
    const rows = await db.execute(sql, { data_de: dataDe, data_ate: dataAte });

    // Filtrar pela empresa solicitada
    const rowsEmp = rows.filter(r => r.EMPRESA === empresa);

    let negociosToClose = [];
    if (negocio === 'todos') {
      negociosToClose = [...new Set(rowsEmp.map(r => r.TIPO_NEGOCIO).filter(Boolean))];
      if (negociosToClose.length === 0) negociosToClose = ['Outros'];
    } else {
      negociosToClose = [negocio];
    }

    for (const neg of negociosToClose) {
      const rowsNeg = rowsEmp.filter(r => (r.TIPO_NEGOCIO || 'Outros') === neg);

      // Calcular o dólar médio ponderado mensal do lote fechado
      let totalBrl = 0;
      let totalUsd = 0;
      for (const r of rowsNeg) {
        totalBrl += Number(r.TOTAL || 0);
        totalUsd += Number(r.TOTAL_USD || 0);
      }
      const dolarMedio = totalUsd > 0 ? (totalBrl / totalUsd) : null;

      // Agregar totais consolidados para a empresa e negocio solicitados
      let receita = 0, intercompany = 0, sacas = 0, cabecas = 0, funrural = 0, gta = 0, fethab = 0, vlrFacs = 0;
      const nfsSet = new Set();

      for (const r of rowsNeg) {
        const tot = Number(r.TOTAL || 0);

        if (r.PRODUTO === 'GTA') {
          gta += Math.abs(tot);
        } else if (r.TIPOFECHA === 'Intercompany') {
          intercompany += Math.abs(tot);
        } else {
          receita += tot;
        }

        const sac = Number(r.SACAS || 0);
        const cab = Number(r.CABECAS || 0);
        sacas += sac;
        cabecas += cab;
        funrural += Number(r.VL_FUNRURAL || 0);
        fethab += Number(r.VLR_FETHAB || 0);
        vlrFacs += Number(r.VLR_FACS || 0);
        if (r.NF) nfsSet.add(r.NF);
      }
      const qtdNfs = nfsSet.size;

      // MERGE INTO FECHAMENTO_RECEITA
      const mergeSql = `
        MERGE INTO FECHAMENTO_RECEITA fr
        USING DUAL ON (fr.FR_EMPRESA = :empresa AND fr.FR_ANO = :ano AND fr.FR_MES = :mes AND fr.FR_NEGOCIO = :negocio AND fr.FR_RUBRICA = 'RECEITA')
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
          (FR_EMPRESA, FR_ANO, FR_MES, FR_NEGOCIO, FR_RUBRICA, FR_RECEITA_TOTAL, FR_INTERCOMPANY, FR_SACAS, FR_QTD_NFS,
           FR_FUNRURAL, FR_GTA, FR_FETHAB, FR_VLR_FACS, FR_DOLAR_MEDIO, FR_DT_FECHAMENTO)
        VALUES
          (:empresa, :ano, :mes, :negocio, 'RECEITA', :receita, :intercompany, :sacas, :qtdNfs,
           :funrural, :gta, :fethab, :vlrFacs, :dolarMedio, SYSDATE)
      `;

      await db.execute(mergeSql, {
        empresa, ano: parseInt(ano), mes: parseInt(mes), negocio: neg,
        receita, intercompany, sacas, qtdNfs,
        funrural, gta, fethab, vlrFacs,
        dolarMedio
      }, { autoCommit: true });
    }

    res.json({
      success: true,
      mensagem: `Mês ${mes}/${ano} fechado com sucesso para empresa ${empresa}.`,
      dados: { empresa, ano, mes }
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
      TRIM(z0.zo0_codfil)           AS EMPRESA_COD,
      ua.regiao                     AS REGIAO,
      u1.de_upnivel1                AS FAZENDA,
      u3.cd_upnivel3                AS TALHAO,
      ps.de_per_safra               AS PERIODO_SAFRA,
      vr.de_variedade               AS VARIEDADE,
      z0.zo0_anoagr                 AS SAFRA,
      TO_DATE(z0.zo0_data, 'yyyy/mm/dd') AS DDATA,
      z0.zo0_codigo                 AS O_S,
      b1_grupo                      AS GRUPO,
      decode(b1_grupo,'0202002','CORRETIVOS',TRIM(bm.bm_desc)) AS TIPO_PRODUTO,
      TRIM(bm2.bm_desc)              AS SUBGRUPO,
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
         protheus11.sbm020         bm2,
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
     AND b1.b1_grupo = bm2.bm_grupo
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
    if (empresa === 'TODAS' || empresa === 'TOTAL') {
      return res.status(400).json({ success: false, error: 'O fechamento deve ser feito selecionando uma Filial específica.' });
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

    const empresaGravar = empresa;

    // Gravar um registro por tipo (sem o TOTAL)
    const tipos_gravar = Object.keys(totalMap).filter(t => (totalMap[t]?.brl || 0) > 0);

    for (const tipo of tipos_gravar) {
      const brl = totalMap[tipo]?.brl || 0;
      const ptaxT = totalMap[tipo]?.ptaxSumPeso > 0 ? (totalMap[tipo].ptaxPeso / totalMap[tipo].ptaxSumPeso) : 0;

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

// ============================================================
// MÓDULO FECHAMENTO FINANCEIRO — PECUÁRIA
// ============================================================

// ─── Helpers Pecuária ───────────────────────────────────────

function getPecuariaParams() {
  const data = loadParamsFile();
  if (!data.pecuaria) {
    data.pecuaria = {
      '028501': { estoque_ini_safra_qtd: 0, estoque_ini_safra_vlr: 0, meses: {} },
      '028503': { estoque_ini_safra_qtd: 0, estoque_ini_safra_vlr: 0, meses: {} }
    };
  }
  return data.pecuaria;
}

function savePecuariaParams(pecParams) {
  const data = loadParamsFile();
  data.pecuaria = pecParams;
  saveParamsFile(data);
}

function getPecuariaManualMes(pecParams, filial, ano, mes) {
  const key = `${ano}_${String(mes).padStart(2, '0')}`;
  return (pecParams[filial]?.meses?.[key]) || {
    nascimentos: 0, mortes_perda: 0, mortes_consumo: 0,
    estoque_fazenda: 0, ajuste_inv: 0, pasto: 0
  };
}

// Mapeamento de filial para 028501 ou 028503
function mapFilialPec(cod) {
  const s = String(cod || '').trim();
  if (s === '028503' || s === '028504') return '028503';
  return '028501'; // 028501, 028502 e 85x → 028501
}

// Agrega rows (EMPRESA, EMISSAO date, QUANT, TOTAL) por filial+mes
function agregarPecPorMesFilial(rows) {
  const map = {};
  for (const r of rows) {
    const emissao = r.EMISSAO instanceof Date ? r.EMISSAO : (r.EMISSAO ? new Date(r.EMISSAO) : null);
    if (!emissao || isNaN(emissao)) continue;
    const filial = mapFilialPec(r.EMPRESA);
    const ano = emissao.getFullYear();
    const mes = emissao.getMonth() + 1;
    const key = `${filial}_${ano}_${mes}`;
    if (!map[key]) map[key] = { filial, ano, mes, qtd: 0, total: 0 };
    map[key].qtd += Number(r.QUANT || 0);
    map[key].total += Number(r.TOTAL || 0);
  }
  return map;
}

// Agrega SQL5 (ValorR$) por filial+mes
function agregarSQL5PorMesFilial(rows) {
  const map = {};
  for (const r of rows) {
    const dateStr = String(r.DATA || r.NJH_DATA || '').trim().replace(/[^0-9]/g, '');
    if (dateStr.length < 8) continue;
    const ano = parseInt(dateStr.substring(0, 4));
    const mes = parseInt(dateStr.substring(4, 6));
    const filial = mapFilialPec(r.FILIAL || r.EMPRESA);
    const key = `${filial}_${ano}_${mes}`;
    if (!map[key]) map[key] = { filial, ano, mes, valor: 0 };
    map[key].valor += Number(r['VALORR$'] || r.VALORRS || 0);
  }
  return map;
}

function getSafraYearPec(hoje = new Date()) {
  return hoje.getMonth() + 1 >= 9 ? hoje.getFullYear() + 1 : hoje.getFullYear();
}
function getMesesSafraPec(anoSafra) {
  return [
    { ano: anoSafra - 1, mes: 9 }, { ano: anoSafra - 1, mes: 10 },
    { ano: anoSafra - 1, mes: 11 }, { ano: anoSafra - 1, mes: 12 },
    { ano: anoSafra, mes: 1 }, { ano: anoSafra, mes: 2 },
    { ano: anoSafra, mes: 3 }, { ano: anoSafra, mes: 4 },
    { ano: anoSafra, mes: 5 }, { ano: anoSafra, mes: 6 },
    { ano: anoSafra, mes: 7 }, { ano: anoSafra, mes: 8 }
  ];
}
function getMesesCalendarioPec(ano) {
  return Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1 }));
}
function dateToStrPec(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getMonthRangePec(ano, mes) {
  return {
    dataDe: dateToStrPec(new Date(ano, mes - 1, 1)),
    dataAte: dateToStrPec(new Date(ano, mes, 0))
  };
}

// ─── SQL Builders ───────────────────────────────────────────

function buildSQL1Pec() {
  return `
    SELECT TRIM(f2_filial) AS EMPRESA,
           TO_DATE(F2_EMISSAO,'yyyy/mm/dd') AS EMISSAO,
           TRIM(F2_DOC) AS NF,
           DECODE(f2_tipo,'D',
             (SELECT SUBSTR(a2.a2_nome,1,25) FROM protheus11.sa2020 a2 WHERE a2.a2_cod=f2_cliente AND a2.a2_loja=f2_loja AND a2.d_e_l_e_t_<>'*'),
             (SELECT SUBSTR(a1.a1_nome,1,25) FROM protheus11.sa1020 a1 WHERE a1.a1_cod=f2_cliente AND a1.a1_loja=f2_loja AND a1.d_e_l_e_t_<>'*')
           ) AS NOME,
           TRIM(D2_CF) AS CFOP, D2_QUANT*-1 AS QUANT, (d2_total+d2_valfre)*-1 AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(F2_TIPO) AS TPDOC,
           F2_VALFAC*-1 AS VLR_FACS, F2_CONTSOC*-1 AS VL_FUNRURAL
    FROM protheus11.sc5020 c5, protheus11.sc6020 c6, protheus11.sf2020 f2,
         protheus11.sd2020 d2, protheus11.sb1020 b1
    WHERE c5.c5_num=c6.c6_num AND D2.D2_PEDIDO=c5.c5_num AND c5.c5_filial=c6.c6_filial
      AND F2.F2_FILIAL=c6.c6_filial AND D2.D2_FILIAL=f2.f2_filial AND d2.d2_cod=b1.b1_cod
      AND f2.f2_doc=d2.d2_doc AND f2.f2_serie=d2.d2_serie AND f2.f2_cliente=d2.d2_cliente AND f2.f2_loja=d2.d2_loja
      AND c5.d_e_l_e_t_<>'*' AND c6.d_e_l_e_t_<>'*' AND f2.d_e_l_e_t_<>'*' AND d2.d_e_l_e_t_<>'*' AND b1.d_e_l_e_t_<>'*'
      AND F2_EMISSAO >= REPLACE(:data_de, '-', '') AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
      AND B1_grupo='0203003' AND D2_CF='5201' AND F2.F2_FILIAL IN ('028501','028503')
    UNION ALL
    SELECT TRIM(f1_filial) AS EMPRESA,
           TO_DATE(F1_DTDIGIT,'yyyy/mm/dd') AS EMISSAO,
           TRIM(D1_DOC) AS NF,
           DECODE(d1_TIPO,'D',
             (SELECT SUBSTR(a2.a2_nome,1,25) FROM protheus11.sa2020 a2 WHERE a2.a2_cod=F1_fornece AND a2.a2_loja=d1_loja AND a2.d_e_l_e_t_<>'*'),
             (SELECT SUBSTR(a1.a1_nome,1,25) FROM protheus11.sa1020 a1 WHERE a1.a1_cod=F1_fornece AND a1.a1_loja=d1_loja AND a1.d_e_l_e_t_<>'*')
           ) AS NOME,
           TRIM(D1_CF) AS CFOP, D1_QUANT AS QUANT, d1_total AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(d1_TIPO) AS TPDOC,
           D1_VALFAC AS VLR_FACS, F1_CONTSOC AS VL_FUNRURAL
    FROM protheus11.sf1020 f1, protheus11.sd1020 d1, protheus11.sb1020 b1
    WHERE D1.D1_FILIAL=f1.f1_filial AND d1.d1_cod=b1.b1_cod
      AND f1.f1_doc=d1.d1_doc AND f1.f1_serie=d1.d1_serie AND f1.f1_fornece=d1.d1_fornece AND f1.f1_loja=d1.d1_loja
      AND f1.d_e_l_e_t_<>'*' AND d1.d_e_l_e_t_<>'*' AND b1.d_e_l_e_t_<>'*'
      AND F1_DTDIGIT >= REPLACE(:data_de, '-', '') AND F1_DTDIGIT <= REPLACE(:data_ate, '-', '')
      AND D1_grupo='0203003' AND D1_CF IN ('1933','1910','1101','1356') AND F1_FILIAL IN ('028501','028503')
  `;
}

function buildSQL2Pec() {
  return `
    SELECT TRIM(f2_filial) AS EMPRESA,
           TO_DATE(F2_EMISSAO,'yyyy/mm/dd') AS EMISSAO,
           TRIM(F2_DOC) AS NF,
           DECODE(f2_tipo,'D',
             (SELECT SUBSTR(a2.a2_nome,1,25) FROM protheus11.sa2020 a2 WHERE a2.a2_cod=f2_cliente AND a2.a2_loja=f2_loja AND a2.d_e_l_e_t_<>'*'),
             (SELECT SUBSTR(a1.a1_nome,1,25) FROM protheus11.sa1020 a1 WHERE a1.a1_cod=f2_cliente AND a1.a1_loja=f2_loja AND a1.d_e_l_e_t_<>'*')
           ) AS NOME,
           TRIM(D2_CF) AS CFOP, D2_QUANT*-1 AS QUANT, (d2_total+d2_valfre)*-1 AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(F2_TIPO) AS TPDOC,
           F2_VALFAC*-1 AS VLR_FACS, F2_CONTSOC*-1 AS VL_FUNRURAL
    FROM protheus11.sc5020 c5, protheus11.sc6020 c6, protheus11.sf2020 f2,
         protheus11.sd2020 d2, protheus11.sb1020 b1
    WHERE c5.c5_num=c6.c6_num AND D2.D2_PEDIDO=c5.c5_num AND c5.c5_filial=c6.c6_filial
      AND F2.F2_FILIAL=c6.c6_filial AND D2.D2_FILIAL=f2.f2_filial AND d2.d2_cod=b1.b1_cod
      AND f2.f2_doc=d2.d2_doc AND f2.f2_serie=d2.d2_serie AND f2.f2_cliente=d2.d2_cliente AND f2.f2_loja=d2.d2_loja
      AND c5.d_e_l_e_t_<>'*' AND c6.d_e_l_e_t_<>'*' AND f2.d_e_l_e_t_<>'*' AND d2.d_e_l_e_t_<>'*' AND b1.d_e_l_e_t_<>'*'
      AND F2_EMISSAO >= REPLACE(:data_de, '-', '') AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
      AND B1_grupo='0203003' AND D2_CF='5208' AND F2.F2_FILIAL IN ('028501','028503')
    UNION ALL
    SELECT TRIM(f1_filial) AS EMPRESA,
           TO_DATE(F1_DTDIGIT,'yyyy/mm/dd') AS EMISSAO,
           TRIM(D1_DOC) AS NF,
           DECODE(d1_TIPO,'D',
             (SELECT SUBSTR(a2.a2_nome,1,25) FROM protheus11.sa2020 a2 WHERE a2.a2_cod=F1_fornece AND a2.a2_loja=d1_loja AND a2.d_e_l_e_t_<>'*'),
             (SELECT SUBSTR(a1.a1_nome,1,25) FROM protheus11.sa1020 a1 WHERE a1.a1_cod=F1_fornece AND a1.a1_loja=d1_loja AND a1.d_e_l_e_t_<>'*')
           ) AS NOME,
           TRIM(D1_CF) AS CFOP, D1_QUANT AS QUANT, d1_total AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(d1_TIPO) AS TPDOC,
           D1_VALFAC AS VLR_FACS, F1_CONTSOC AS VL_FUNRURAL
    FROM protheus11.sf1020 f1, protheus11.sd1020 d1, protheus11.sb1020 b1
    WHERE D1.D1_FILIAL=f1.f1_filial AND d1.d1_cod=b1.b1_cod
      AND f1.f1_doc=d1.d1_doc AND f1.f1_serie=d1.d1_serie AND f1.f1_fornece=d1.d1_fornece AND f1.f1_loja=d1.d1_loja
      AND f1.d_e_l_e_t_<>'*' AND d1.d_e_l_e_t_<>'*' AND b1.d_e_l_e_t_<>'*'
      AND F1_DTDIGIT >= REPLACE(:data_de, '-', '') AND F1_DTDIGIT <= REPLACE(:data_ate, '-', '')
      AND D1_grupo='0203003' AND D1_CF='1151' AND F1_FILIAL IN ('028501','028503')
  `;
}

function buildSQL3Pec() {
  return `
    SELECT TRIM(f2_filial) AS EMPRESA,
           TO_DATE(F2_EMISSAO,'yyyy/mm/dd') AS EMISSAO,
           TRIM(F2_DOC) AS NF,
           DECODE(f2_tipo,'D',
             (SELECT SUBSTR(a2.a2_nome,1,25) FROM protheus11.sa2020 a2 WHERE a2.a2_cod=f2_cliente AND a2.a2_loja=f2_loja AND a2.d_e_l_e_t_<>'*'),
             (SELECT SUBSTR(a1.a1_nome,1,25) FROM protheus11.sa1020 a1 WHERE a1.a1_cod=f2_cliente AND a1.a1_loja=f2_loja AND a1.d_e_l_e_t_<>'*')
           ) AS NOME,
           TRIM(D2_CF) AS CFOP, D2_QUANT AS QUANT, (d2_total+d2_valfre) AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(F2_TIPO) AS TPDOC,
           F2_VALFAC AS VLR_FACS, F2_CONTSOC AS VL_FUNRURAL
    FROM protheus11.sc5020 c5, protheus11.sc6020 c6, protheus11.sf2020 f2,
         protheus11.sd2020 d2, protheus11.sb1020 b1
    WHERE c5.c5_num=c6.c6_num AND D2.D2_PEDIDO=c5.c5_num AND c5.c5_filial=c6.c6_filial
      AND F2.F2_FILIAL=c6.c6_filial AND D2.D2_FILIAL=f2.f2_filial AND d2.d2_cod=b1.b1_cod
      AND f2.f2_doc=d2.d2_doc AND f2.f2_serie=d2.d2_serie AND f2.f2_cliente=d2.d2_cliente AND f2.f2_loja=d2.d2_loja
      AND c5.d_e_l_e_t_<>'*' AND c6.d_e_l_e_t_<>'*' AND f2.d_e_l_e_t_<>'*' AND d2.d_e_l_e_t_<>'*' AND b1.d_e_l_e_t_<>'*'
      AND F2_EMISSAO >= REPLACE(:data_de, '-', '') AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
      AND B1_grupo='0203003' AND D2_CF='5151' AND F2.F2_FILIAL IN ('028501','028503')
    UNION ALL
    SELECT TRIM(f1_filial) AS EMPRESA,
           TO_DATE(F1_EMISSAO,'yyyy/mm/dd') AS EMISSAO,
           TRIM(D1_DOC) AS NF,
           DECODE(d1_TIPO,'D',
             (SELECT SUBSTR(a2.a2_nome,1,25) FROM protheus11.sa2020 a2 WHERE a2.a2_cod=F1_fornece AND a2.a2_loja=d1_loja AND a2.d_e_l_e_t_<>'*'),
             (SELECT SUBSTR(a1.a1_nome,1,25) FROM protheus11.sa1020 a1 WHERE a1.a1_cod=F1_fornece AND a1.a1_loja=d1_loja AND a1.d_e_l_e_t_<>'*')
           ) AS NOME,
           TRIM(D1_CF) AS CFOP, D1_QUANT*-1 AS QUANT, d1_total*-1 AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(d1_TIPO) AS TPDOC,
           D1_VALFAC*-1 AS VLR_FACS, F1_CONTSOC*-1 AS VL_FUNRURAL
    FROM protheus11.sf1020 f1, protheus11.sd1020 d1, protheus11.sb1020 b1
    WHERE D1.D1_FILIAL=f1.f1_filial AND d1.d1_cod=b1.b1_cod
      AND f1.f1_doc=d1.d1_doc AND f1.f1_serie=d1.d1_serie AND f1.f1_fornece=d1.d1_fornece AND f1.f1_loja=d1.d1_loja
      AND f1.d_e_l_e_t_<>'*' AND d1.d_e_l_e_t_<>'*' AND b1.d_e_l_e_t_<>'*'
      AND F1_EMISSAO >= REPLACE(:data_de, '-', '') AND F1_EMISSAO <= REPLACE(:data_ate, '-', '')
      AND D1_grupo='0203003' AND D1_CF='1209' AND F1_FILIAL IN ('028501','028503')
  `;
}

function buildSQL4Pec() {
  return `
  select * from (  
  SELECT distinct TRIM(D2.D2_FILIAL) AS EMPRESA,
           TO_DATE(F2_EMISSAO,'yyyy/mm/dd') AS EMISSAO,
           TRIM(F2_DOC) AS NF, a1.a1_nome AS NOME,
           TRIM(D2_CF) AS CFOP, D2_QUANT AS QUANT, D2_TOTAL AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(F2_TIPO) AS TPDOC
    FROM protheus11.sc5020 c5, protheus11.sc6020 c6, protheus11.sf2020 f2,
         protheus11.sd2020 d2, protheus11.sb1020 b1, protheus11.sa1020 a1
    WHERE c5.c5_num=c6.c6_num AND D2.D2_PEDIDO=c5.c5_num AND c5.c5_filial=c6.c6_filial
      AND F2.F2_FILIAL=c6.c6_filial AND D2.D2_FILIAL=f2.f2_filial
      AND d2.d2_cliente=a1.a1_cod AND d2.d2_loja=a1.a1_loja
      AND f2.f2_cliente=a1.a1_cod AND f2.f2_loja=a1.a1_loja
      AND d2.d2_cod=b1.b1_cod AND f2.f2_doc=d2.d2_doc AND f2.f2_serie=d2.d2_serie
      AND f2.f2_cliente=d2.d2_cliente AND f2.f2_loja=d2.d2_loja AND d2.d2_TES<>'901'
      AND c5.d_e_l_e_t_<>'*' AND c6.d_e_l_e_t_<>'*' AND f2.d_e_l_e_t_<>'*' AND d2.d_e_l_e_t_<>'*'
      AND d2.d2_tipo NOT IN ('D','B') AND d2.d2_filial IN ('028501','028502','028503','028504')
      AND b1.b1_grupo='0203003' AND d2.d2_cf NOT IN ('5151')
      AND F2_EMISSAO >= REPLACE(:data_de, '-', '') AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
    UNION ALL
    SELECT distinct TRIM(D2.D2_FILIAL) AS EMPRESA,
           TO_DATE(F2_EMISSAO,'yyyy/mm/dd') AS EMISSAO,
           TRIM(F2_DOC) AS NF, a2.a2_nome AS NOME,
           TRIM(D2_CF) AS CFOP, D2_QUANT AS QUANT, D2_TOTAL AS TOTAL,
           SUBSTR(B1_desc,1,30) AS PRODUTO, TRIM(F2_TIPO) AS TPDOC
    FROM protheus11.sc5020 c5, protheus11.sc6020 c6, protheus11.sf2020 f2,
         protheus11.sd2020 d2, protheus11.sb1020 b1, protheus11.sa2020 a2
    WHERE c5.c5_num=c6.c6_num AND D2.D2_PEDIDO=c5.c5_num AND c5.c5_filial=c6.c6_filial
      AND F2.F2_FILIAL=c6.c6_filial AND D2.D2_FILIAL=f2.f2_filial
      AND d2.d2_cliente=a2.a2_cod AND d2.d2_loja=a2.a2_loja
      AND f2.f2_cliente=a2.a2_cod AND f2.f2_loja=a2.a2_loja
      AND d2.d2_cod=b1.b1_cod AND f2.f2_doc=d2.d2_doc AND f2.f2_serie=d2.d2_serie
      AND f2.f2_cliente=d2.d2_cliente AND f2.f2_loja=d2.d2_loja AND d2.d2_TES<>'901'
      AND c5.d_e_l_e_t_<>'*' AND c6.d_e_l_e_t_<>'*' AND f2.d_e_l_e_t_<>'*' AND d2.d_e_l_e_t_<>'*'
      AND d2.d2_tipo IN ('D','B') AND d2.d2_filial IN ('028501','028502','028503','028504')
      AND b1.b1_grupo='0203003' AND d2.d2_cf NOT IN ('5151')
      AND F2_EMISSAO >= REPLACE(:data_de, '-', '') AND F2_EMISSAO <= REPLACE(:data_ate, '-', '')
)`;
}

function buildSQL5Pec() {
  return `
    SELECT njh_filial as Filial,
           njh_codpav,
           njh_data as Data,
           njh_codsaf as Safra,
           njh_codpro as CodProduto,
           njh_despro as DescProduto,
           njh_um1pro as Unidade,
           njh_placa as Placa,
           njh_nommot as Motorista,
           njh_peso1 as Peso1,
           njh_datps1 as Hora1,
           njh_peso2 as Peso2,
           njh_datps2 as Hora2,
           njh_modps2 as ModoPeso,
           njh_pssubt as Qtde,
           dq_cm1 as CustoMedio,
           njh_pssubt*dq_cm1 as "VALORR$"
    FROM protheus11.NJH020 e,
        (SELECT dq_cod,dq_cm1
           FROM protheus11.SDQ020 c1
          where DQ_cod IN ('199473','199472','199475')
            and d_e_l_e_t_ = ' '
            and dq_data = (SELECT max(dq_data)
                             FROM protheus11.SDQ020 c2
                             where c2.dq_cod=c1.dq_cod
                               and d_e_l_e_t_ = ' ')) CM
    WHERE e.njh_codpro=cm.dq_cod
      and NJH_FILIAL = '028501'
      AND NJH_STATUS = '3'
      AND NJH_CODPRO IN ('199473','199472','199475')
      AND e.d_e_l_e_t_ = ' '
      AND njh_data >= REPLACE(:data_de,'-','')
      AND njh_data <= REPLACE(:data_ate,'-','')
  `;
}

// ─── Cálculo A-R para um mês/filial ─────────────────────────
function calcPecuariaMes({ A_qtd, J_vlr, B_qtd, K_vlr, C_qtd, L_vlr, D_qtd, E, F_perda, F_consumo, G_qtd, H, nutricao_valor, pasto }) {
  const F = F_perda + F_consumo;
  const I = A_qtd + B_qtd + C_qtd - D_qtd + E - F - G_qtd + H;
  const M_val = J_vlr + K_vlr + L_vlr;
  const N = nutricao_valor || 0;
  const P = M_val + N + pasto;
  const heads_disp = A_qtd + B_qtd + C_qtd;
  const Q_cavu = heads_disp > 0 ? P / heads_disp : 0;
  const R_cav = Q_cavu * (D_qtd + G_qtd);
  const cam_perdas = Q_cavu * F_perda;
  const cam_consumo = Q_cavu * F_consumo;
  const vl_estoque_fin = P - R_cav - cam_perdas - cam_consumo;
  return {
    A_qtd, B_qtd, C_qtd, D_qtd, E, F_perda, F_consumo, F, G_qtd, H, I,
    J_vlr, K_vlr, L_vlr, M_val, N, O: pasto, P, Q_cavu, R_cav,
    cam_perdas, cam_consumo, vl_estoque_fin
  };
}

// ─── API Routes ─────────────────────────────────────────────

// GET /api/pecuaria/params
app.get('/api/pecuaria/params', (req, res) => {
  try { res.json({ success: true, data: getPecuariaParams() }); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/pecuaria/params
app.post('/api/pecuaria/params', (req, res) => {
  try {
    const current = getPecuariaParams();
    const incoming = req.body;
    const merged = { ...current };
    for (const filial of ['028501', '028503']) {
      if (incoming[filial]) {
        merged[filial] = { ...current[filial], ...incoming[filial] };
        if (incoming[filial].meses) {
          merged[filial].meses = { ...(current[filial]?.meses || {}) };
          for (const [k, v] of Object.entries(incoming[filial].meses)) {
            merged[filial].meses[k] = { ...(current[filial]?.meses?.[k] || {}), ...v };
          }
        }
      }
    }
    savePecuariaParams(merged);
    res.json({ success: true, mensagem: 'Parâmetros de pecuária salvos.' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/pecuaria/sql1
app.get('/api/pecuaria/sql1', async (req, res) => {
  try {
    const dataDe = req.query.data_de || '2026-05-01';
    const dataAte = req.query.data_ate || '2026-07-31';
    const filial = req.query.filial;
    let sql = buildSQL1Pec();
    const binds = { data_de: dataDe, data_ate: dataAte };
    if (filial && filial !== 'TOTAL') {
      sql = `SELECT * FROM (${sql}) WHERE EMPRESA = :filial`;
      binds.filial = filial;
    }
    const rows = await db.execute(sql, binds);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) { console.error('[pec/sql1]', err); res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/pecuaria/sql2
app.get('/api/pecuaria/sql2', async (req, res) => {
  try {
    const dataDe = req.query.data_de || '2026-05-01';
    const dataAte = req.query.data_ate || '2026-07-31';
    const filial = req.query.filial;
    let sql = buildSQL2Pec();
    const binds = { data_de: dataDe, data_ate: dataAte };
    if (filial && filial !== 'TOTAL') {
      sql = `SELECT * FROM (${sql}) WHERE EMPRESA = :filial`;
      binds.filial = filial;
    }
    const rows = await db.execute(sql, binds);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) { console.error('[pec/sql2]', err); res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/pecuaria/sql3
app.get('/api/pecuaria/sql3', async (req, res) => {
  try {
    const dataDe = req.query.data_de || '2026-05-01';
    const dataAte = req.query.data_ate || '2026-07-31';
    const filial = req.query.filial;
    let sql = buildSQL3Pec();
    const binds = { data_de: dataDe, data_ate: dataAte };
    if (filial && filial !== 'TOTAL') {
      sql = `SELECT * FROM (${sql}) WHERE EMPRESA = :filial`;
      binds.filial = filial;
    }
    const rows = await db.execute(sql, binds);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) { console.error('[pec/sql3]', err); res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/pecuaria/sql4
app.get('/api/pecuaria/sql4', async (req, res) => {
  try {
    const dataDe = req.query.data_de || '2026-05-01';
    const dataAte = req.query.data_ate || '2026-07-31';
    const filial = req.query.filial;
    let sql = buildSQL4Pec();
    const binds = { data_de: dataDe, data_ate: dataAte };
    if (filial && filial !== 'TOTAL') {
      sql = `SELECT * FROM (${sql}) WHERE EMPRESA = :filial`;
      binds.filial = filial;
    }
    const rows = await db.execute(sql, binds);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) { console.error('[pec/sql4]', err); res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/pecuaria/sql5
app.get('/api/pecuaria/sql5', async (req, res) => {
  try {
    const dataDe = req.query.data_de || '2026-05-01';
    const dataAte = req.query.data_ate || '2026-07-31';
    const sql = buildSQL5Pec();
    const binds = { data_de: dataDe, data_ate: dataAte };
    const rows = await db.execute(sql, binds);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) { console.error('[pec/sql5]', err); res.status(500).json({ success: false, error: err.message }); }
});

// GET /api/pecuaria/resumo-anual — grid A-R com 12 meses, cascata de estoque
app.get('/api/pecuaria/resumo-anual', async (req, res) => {
  try {
    const hoje = new Date();
    const anoSafra = parseInt(req.query.ano_safra) || getSafraYearPec(hoje);
    const tipoCalend = req.query.tipo || 'safra';
    const anoCalend = parseInt(req.query.ano) || hoje.getFullYear();
    const meses = tipoCalend === 'calendario' ? getMesesCalendarioPec(anoCalend) : getMesesSafraPec(anoSafra);

    const mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    const prevDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesAnterior = { ano: prevDate.getFullYear(), mes: prevDate.getMonth() + 1 };

    // 1. Buscar fechados
    let fechados = [];
    try {
      fechados = await db.execute(`SELECT * FROM FECHAMENTO_PECUARIA ORDER BY FP_ANO, FP_MES`);
    } catch (e) { console.warn('[pec/resumo] FECHAMENTO_PECUARIA não existe ainda:', e.message); }
    const fechadosMap = {};
    for (const f of fechados) {
      fechadosMap[`${f.FP_EMPRESA}_${f.FP_ANO}_${f.FP_MES}`] = f;
    }

    // 2. Parâmetros manuais
    const pecParams = getPecuariaParams();

    // 3. Identificar meses dinâmicos
    const dinamicos = meses.filter(m => {
      if (new Date(m.ano, m.mes - 1, 1) > hoje) return false;
      // TEMPORÁRIO: Maio (5), Junho (6) e Julho (7) de 2026 são dinâmicos
      return (m.ano === 2026 && m.mes >= 5 && m.mes <= 7);
    });

    // 4. Buscar dados dinâmicos (batch query)
    let s1Agg = {}, s2Agg = {}, s3Agg = {}, s4Agg = {}, s5Agg = {};
    if (dinamicos.length > 0) {
      const timestamps = dinamicos.map(m => new Date(m.ano, m.mes - 1, 1).getTime());
      const timestampsAte = dinamicos.map(m => new Date(m.ano, m.mes, 0).getTime());
      const dataDe = dateToStrPec(new Date(Math.min(...timestamps)));
      const dataAte = dateToStrPec(new Date(Math.max(...timestampsAte)));
      const binds = { data_de: dataDe, data_ate: dataAte };
      try { s1Agg = agregarPecPorMesFilial(await db.execute(buildSQL1Pec(), binds)); } catch (e) { console.warn('[pec/resumo] SQL1:', e.message); }
      try { s2Agg = agregarPecPorMesFilial(await db.execute(buildSQL2Pec(), binds)); } catch (e) { console.warn('[pec/resumo] SQL2:', e.message); }
      try { s3Agg = agregarPecPorMesFilial(await db.execute(buildSQL3Pec(), binds)); } catch (e) { console.warn('[pec/resumo] SQL3:', e.message); }
      try { s4Agg = agregarPecPorMesFilial(await db.execute(buildSQL4Pec(), binds)); } catch (e) { console.warn('[pec/resumo] SQL4:', e.message); }
      try { s5Agg = agregarSQL5PorMesFilial(await db.execute(buildSQL5Pec(), binds)); } catch (e) { console.warn('[pec/resumo] SQL5:', e.message); }
    }

    // 5. Loop sequencial com cascata de estoque
    const cascata = {
      '028501': { qtd_fin: null, vlr_fin: null, cavu: null },
      '028503': { qtd_fin: null, vlr_fin: null, cavu: null }
    };

    const resultado = meses.map((m, idx) => {
      const isMesAtual = m.ano === 2026 && m.mes === 7;
      const isMesAnterior = m.ano === 2026 && (m.mes === 5 || m.mes === 6);
      const isFuturo = new Date(m.ano, m.mes - 1, 1) > hoje;
      const isDinamico = m.ano === 2026 && m.mes >= 5 && m.mes <= 7;

      let defaultStatus = isFuturo ? 'futuro' : isDinamico ? (m.mes === 7 ? 'dinamico_atual' : 'dinamico_anterior') : 'aguardando';

      const porEmpresa = {};

      for (const filial of ['028501', '028503']) {
        const fechado = fechadosMap[`${filial}_${m.ano}_${m.mes}`];

        if (fechado) {
          // Usar valores do fechamento
          const data = {
            A_qtd: Number(fechado.FP_ESTOQUE_INI || 0),
            B_qtd: Number(fechado.FP_COMPRAS_QTD || 0),
            C_qtd: Number(fechado.FP_TRANSF_ENT_QTD || 0),
            D_qtd: Number(fechado.FP_TRANSF_SAI_QTD || 0),
            E: Number(fechado.FP_NASCIMENTOS || 0),
            F_perda: Number(fechado.FP_MORTES_PERDA || 0),
            F_consumo: Number(fechado.FP_MORTES_CONSUMO || 0),
            F: Number((fechado.FP_MORTES_PERDA || 0)) + Number((fechado.FP_MORTES_CONSUMO || 0)),
            G_qtd: Number(fechado.FP_VENDAS_QTD || 0),
            H: Number(fechado.FP_AJUSTE_INV || 0),
            I: Number(fechado.FP_ESTOQUE_FIN || 0),
            estoque_fazenda: Number(fechado.FP_ESTOQUE_FAZENDA || 0),
            J_vlr: Number(fechado.FP_VL_ESTOQUE_INI || 0),
            K_vlr: Number(fechado.FP_VL_COMPRAS || 0),
            L_vlr: Number(fechado.FP_VL_TRANSF_ENT || 0),
            M_val: Number(fechado.FP_VL_ESTOQUE_INI || 0) + Number(fechado.FP_VL_COMPRAS || 0) + Number(fechado.FP_VL_TRANSF_ENT || 0),
            N: Number(fechado.FP_VL_NUTRICAO || 0),
            O: Number(fechado.FP_VL_PASTO || 0),
            Q_cavu: Number(fechado.FP_CAV_U || 0),
            R_cav: Number(fechado.FP_CAV || 0),
            cam_perdas: Number(fechado.FP_CAM_PERDAS || 0),
            cam_consumo: Number(fechado.FP_CAM_CONSUMO || 0),
            vl_estoque_fin: Number(fechado.FP_VL_ESTOQUE_FIN || 0),
            status: 'fechado',
            dtFechamento: fechado.FP_DT_FECHAMENTO
          };
          data.P = data.M_val + data.N + data.O;
          data.dif_estoque = data.I - data.estoque_fazenda;
          porEmpresa[filial] = data;
          // Atualizar cascata
          cascata[filial].qtd_fin = data.I;
          cascata[filial].vlr_fin = data.vl_estoque_fin;
          cascata[filial].cavu = data.Q_cavu;

        } else {
          // Mês não fechado (dinâmico, histórico pendente ou futuro)
          const pfil = pecParams[filial] || {};
          const manual = getPecuariaManualMes(pecParams, filial, m.ano, m.mes);

          // Regra do estoque inicial:
          // Se for o mês de início da apuração (Maio/2026), usa o parâmetro se não houver cascata anterior.
          // Se for anterior a Maio/2026, começa e acumula com base em 0.
          // Se for posterior, herda por cascata.
          const isInicioApuracao = m.ano === 2026 && m.mes === 5;
          const isAnteriorInicio = m.ano < 2026 || (m.ano === 2026 && m.mes < 5);

          let A_qtd = 0;
          let J_vlr = 0;

          if (isInicioApuracao) {
            A_qtd = (cascata[filial].qtd_fin !== null && cascata[filial].qtd_fin !== 0)
              ? cascata[filial].qtd_fin
              : (Number(pfil.estoque_ini_safra_qtd) || 0);

            J_vlr = (cascata[filial].vlr_fin !== null && cascata[filial].vlr_fin !== 0)
              ? cascata[filial].vlr_fin
              : (Number(pfil.estoque_ini_safra_vlr) || 0);
          } else {
            A_qtd = cascata[filial].qtd_fin !== null ? cascata[filial].qtd_fin : 0;
            J_vlr = cascata[filial].vlr_fin !== null ? cascata[filial].vlr_fin : 0;
          }

          const cavuPrev = cascata[filial].cavu || 0;

          // Se for dinâmico, carrega valores do Oracle. Caso contrário (meses anteriores que não fechamos ou futuro), assume 0
          const key = `${filial}_${m.ano}_${m.mes}`;
          const B_qtd = isDinamico ? Number(s1Agg[key]?.qtd || 0) : 0;
          const K_vlr = isDinamico ? Number(s1Agg[key]?.total || 0) : 0;
          const C_qtd = isDinamico ? Number(s2Agg[key]?.qtd || 0) : 0;
          const L_vlr = isDinamico ? Number(s2Agg[key]?.total || 0) : 0;
          const D_qtd = isDinamico ? Number(s3Agg[key]?.qtd || 0) : 0;
          const G_qtd = isDinamico ? Number(s4Agg[key]?.qtd || 0) : 0;
          const nutricao_valor = isDinamico ? Number(s5Agg[key]?.valor || 0) : 0;

          // Ajustes manuais só se aplicam se o mês for dinâmico (apuração ativa)
          const E_nascimentos = isDinamico ? Number(manual.nascimentos || 0) : 0;
          const F_perda = isDinamico ? Number(manual.mortes_perda || 0) : 0;
          const F_consumo = isDinamico ? Number(manual.mortes_consumo || 0) : 0;
          const H_ajuste = isDinamico ? Number(manual.ajuste_inv || 0) : 0;
          const O_pasto = isDinamico ? Number(manual.pasto || 0) : 0;
          const est_fazenda = isDinamico ? Number(manual.estoque_fazenda || 0) : 0;

          const calc = calcPecuariaMes({
            A_qtd, J_vlr, B_qtd, K_vlr, C_qtd, L_vlr, D_qtd,
            E: E_nascimentos,
            F_perda,
            F_consumo,
            G_qtd, H: H_ajuste,
            nutricao_valor,
            pasto: O_pasto
          });

          const dif = calc.I - est_fazenda;
          porEmpresa[filial] = {
            ...calc,
            estoque_fazenda: est_fazenda,
            dif_estoque: dif,
            status: defaultStatus
          };

          // Atualizar cascata para o mês seguinte
          cascata[filial].qtd_fin = calc.I;
          cascata[filial].vlr_fin = calc.vl_estoque_fin;
          cascata[filial].cavu = calc.Q_cavu;
        }
      }

      // Consolidado TOTAL
      const t = { status: 'futuro' };
      const statuses = new Set();
      for (const [fk, fv] of Object.entries(porEmpresa)) {
        statuses.add(fv.status);
        for (const k of ['A_qtd', 'B_qtd', 'C_qtd', 'D_qtd', 'E', 'F_perda', 'F_consumo', 'F', 'G_qtd', 'H', 'I',
          'estoque_fazenda', 'J_vlr', 'K_vlr', 'L_vlr', 'M_val', 'N', 'O', 'P', 'R_cav',
          'cam_perdas', 'cam_consumo', 'vl_estoque_fin']) {
          t[k] = (t[k] || 0) + (fv[k] || 0);
        }
      }
      // Recalcular Q_cavu e dif do total
      const heads_tot = t.A_qtd + t.B_qtd + t.C_qtd;
      t.Q_cavu = heads_tot > 0 ? t.P / heads_tot : 0;
      t.dif_estoque = t.I - t.estoque_fazenda;
      t.status = statuses.has('fechado') && statuses.size === 1 ? 'fechado'
        : statuses.has('dinamico_anterior') ? 'dinamico_anterior'
          : statuses.has('dinamico_atual') ? 'dinamico_atual'
            : defaultStatus;
      porEmpresa['TOTAL'] = t;

      return { ano: m.ano, mes: m.mes, status: t.status, porEmpresa };
    });

    res.json({ success: true, anoSafra, tipoCalend, meses: resultado });
  } catch (err) {
    console.error('[pec/resumo-anual]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/pecuaria/fechados — lista meses fechados para pills no hub
app.get('/api/pecuaria/fechados', async (req, res) => {
  try {
    let rows = [];
    try {
      rows = await db.execute(`SELECT DISTINCT FP_EMPRESA, FP_ANO, FP_MES, FP_DT_FECHAMENTO FROM FECHAMENTO_PECUARIA ORDER BY FP_ANO, FP_MES`);
    } catch (e) { console.warn('[pec/fechados] tabela não existe:', e.message); }
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/pecuaria/fechar-mes — grava fechamento completo na tabela
app.post('/api/pecuaria/fechar-mes', async (req, res) => {
  try {
    const { empresa, mes, ano } = req.body;
    if (!empresa || !mes || !ano) return res.status(400).json({ success: false, error: 'empresa, mes e ano são obrigatórios.' });

    const { dataDe, dataAte } = getMonthRangePec(parseInt(ano), parseInt(mes));
    const binds = { data_de: dataDe, data_ate: dataAte };
    const pecParams = getPecuariaParams();

    // Buscar dados Oracle
    let s1 = {}, s2 = {}, s3 = {}, s4 = {}, s5 = {};
    try { s1 = agregarPecPorMesFilial(await db.execute(buildSQL1Pec(), binds)); } catch (e) { }
    try { s2 = agregarPecPorMesFilial(await db.execute(buildSQL2Pec(), binds)); } catch (e) { }
    try { s3 = agregarPecPorMesFilial(await db.execute(buildSQL3Pec(), binds)); } catch (e) { }
    try { s4 = agregarPecPorMesFilial(await db.execute(buildSQL4Pec(), binds)); } catch (e) { }
    try { s5 = agregarSQL5PorMesFilial(await db.execute(buildSQL5Pec(), binds)); } catch (e) { }

    const empresas = empresa === 'TODAS' ? ['028501', '028503'] : [empresa];
    const resultados = [];

    for (const filial of empresas) {
      // Buscar fechamento do mês anterior para cascata
      const prevDate = new Date(parseInt(ano), parseInt(mes) - 2, 1);
      const prevAno = prevDate.getFullYear();
      const prevMes = prevDate.getMonth() + 1;
      let prevFechado = null;
      try {
        const rows = await db.execute(`SELECT * FROM FECHAMENTO_PECUARIA WHERE FP_EMPRESA=:emp AND FP_ANO=:ano AND FP_MES=:mes`,
          { emp: filial, ano: prevAno, mes: prevMes });
        if (rows.length > 0) prevFechado = rows[0];
      } catch (e) { }

      const pfil = pecParams[filial] || {};
      const manual = getPecuariaManualMes(pecParams, filial, parseInt(ano), parseInt(mes));

      const A_qtd = prevFechado ? Number(prevFechado.FP_ESTOQUE_FIN) : (Number(pfil.estoque_ini_safra_qtd) || 0);
      const J_vlr = prevFechado ? Number(prevFechado.FP_VL_ESTOQUE_FIN) : (Number(pfil.estoque_ini_safra_vlr) || 0);
      const cavuPrev = prevFechado ? Number(prevFechado.FP_CAV_U) : 0;

      const key = `${filial}_${ano}_${mes}`;
      const B_qtd = Number(s1[key]?.qtd || 0), K_vlr = Number(s1[key]?.total || 0);
      const C_qtd = Number(s2[key]?.qtd || 0), L_vlr = Number(s2[key]?.total || 0);
      const D_qtd = Number(s3[key]?.qtd || 0);
      const G_qtd = Number(s4[key]?.qtd || 0);
      const nutricao_valor = Number(s5[key]?.valor || 0);

      const calc = calcPecuariaMes({
        A_qtd, J_vlr, B_qtd, K_vlr, C_qtd, L_vlr, D_qtd,
        E: Number(manual.nascimentos || 0),
        F_perda: Number(manual.mortes_perda || 0),
        F_consumo: Number(manual.mortes_consumo || 0),
        G_qtd, H: Number(manual.ajuste_inv || 0),
        nutricao_valor,
        pasto: Number(manual.pasto || 0)
      });

      const mergeSql = `
        MERGE INTO FECHAMENTO_PECUARIA fp
        USING DUAL ON (fp.FP_EMPRESA=:empresa AND fp.FP_ANO=:ano AND fp.FP_MES=:mes)
        WHEN MATCHED THEN UPDATE SET
          fp.FP_ESTOQUE_INI=:estoqueIni, fp.FP_COMPRAS_QTD=:comprasQtd,
          fp.FP_TRANSF_ENT_QTD=:transfEntQtd, fp.FP_TRANSF_SAI_QTD=:transfSaiQtd,
          fp.FP_NASCIMENTOS=:nascimentos, fp.FP_MORTES_PERDA=:mortesPerda,
          fp.FP_MORTES_CONSUMO=:mortesConsumo, fp.FP_VENDAS_QTD=:vendasQtd,
          fp.FP_AJUSTE_INV=:ajusteInv, fp.FP_ESTOQUE_FIN=:estoqueFin,
          fp.FP_ESTOQUE_FAZENDA=:estoqueFazenda,
          fp.FP_VL_ESTOQUE_INI=:vlEstoqueIni, fp.FP_VL_COMPRAS=:vlCompras,
          fp.FP_VL_TRANSF_ENT=:vlTransfEnt, fp.FP_VL_NUTRICAO=:vlNutricao,
          fp.FP_VL_PASTO=:vlPasto, fp.FP_CAV_U=:cavU, fp.FP_CAV=:cav,
          fp.FP_CAM_PERDAS=:camPerdas, fp.FP_CAM_CONSUMO=:camConsumo,
          fp.FP_VL_ESTOQUE_FIN=:vlEstoqueFin, fp.FP_DT_FECHAMENTO=SYSDATE
        WHEN NOT MATCHED THEN INSERT (
          FP_EMPRESA, FP_ANO, FP_MES,
          FP_ESTOQUE_INI, FP_COMPRAS_QTD, FP_TRANSF_ENT_QTD, FP_TRANSF_SAI_QTD,
          FP_NASCIMENTOS, FP_MORTES_PERDA, FP_MORTES_CONSUMO, FP_VENDAS_QTD,
          FP_AJUSTE_INV, FP_ESTOQUE_FIN, FP_ESTOQUE_FAZENDA,
          FP_VL_ESTOQUE_INI, FP_VL_COMPRAS, FP_VL_TRANSF_ENT,
          FP_VL_NUTRICAO, FP_VL_PASTO, FP_CAV_U, FP_CAV,
          FP_CAM_PERDAS, FP_CAM_CONSUMO, FP_VL_ESTOQUE_FIN, FP_DT_FECHAMENTO
        ) VALUES (
          :empresa, :ano, :mes,
          :estoqueIni, :comprasQtd, :transfEntQtd, :transfSaiQtd,
          :nascimentos, :mortesPerda, :mortesConsumo, :vendasQtd,
          :ajusteInv, :estoqueFin, :estoqueFazenda,
          :vlEstoqueIni, :vlCompras, :vlTransfEnt,
          :vlNutricao, :vlPasto, :cavU, :cav,
          :camPerdas, :camConsumo, :vlEstoqueFin, SYSDATE
        )
      `;
      await db.execute(mergeSql, {
        empresa: filial, ano: parseInt(ano), mes: parseInt(mes),
        estoqueIni: calc.A_qtd, comprasQtd: calc.B_qtd,
        transfEntQtd: calc.C_qtd, transfSaiQtd: calc.D_qtd,
        nascimentos: calc.E, mortesPerda: calc.F_perda,
        mortesConsumo: calc.F_consumo, vendasQtd: calc.G_qtd,
        ajusteInv: calc.H, estoqueFin: calc.I,
        estoqueFazenda: Number(manual.estoque_fazenda || 0),
        vlEstoqueIni: calc.J_vlr, vlCompras: calc.K_vlr,
        vlTransfEnt: calc.L_vlr, vlNutricao: calc.N,
        vlPasto: calc.O, cavU: calc.Q_cavu,
        cav: calc.R_cav, camPerdas: calc.cam_perdas,
        camConsumo: calc.cam_consumo, vlEstoqueFin: calc.vl_estoque_fin
      }, { autoCommit: true });
      resultados.push({ filial, ...calc });
    }

    res.json({ success: true, mensagem: `Mês ${mes}/${ano} fechado com sucesso.`, dados: resultados });
  } catch (err) {
    console.error('[pec/fechar-mes]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/pecuaria/fechamentos — CRUD lista completa
app.get('/api/pecuaria/fechamentos', async (req, res) => {
  try {
    const { ano, mes, filial } = req.query;
    let where = 'WHERE 1=1';
    const binds = {};
    if (ano) { where += ' AND FP_ANO=:ano'; binds.ano = parseInt(ano); }
    if (mes) { where += ' AND FP_MES=:mes'; binds.mes = parseInt(mes); }
    if (filial) { where += ' AND FP_EMPRESA=:filial'; binds.filial = filial; }
    let rows = [];
    try { rows = await db.execute(`SELECT * FROM FECHAMENTO_PECUARIA ${where} ORDER BY FP_ANO DESC, FP_MES DESC, FP_EMPRESA`, binds); }
    catch (e) { console.warn('[pec/fechamentos]', e.message); }
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// POST /api/pecuaria/fechamento — inclui um novo fechamento manual de pecuária
app.post('/api/pecuaria/fechamento', async (req, res) => {
  try {
    const {
      periodo, filial, estoqueIni, comprasQtd, transfEntQtd, transfSaiQtd,
      nascimentos, mortesPerda, mortesConsumo, vendasQtd, ajusteInv, estoqueFin,
      estoqueFazenda, vlEstoqueIni, vlCompras, vlTransfEnt, vlNutricao, vlPasto,
      cavu, cav, camPerdas, camConsumo, vlEstoqueFin, obs
    } = req.body;

    if (!periodo || !filial) {
      return res.status(400).json({ success: false, error: 'Período e filial são obrigatórios.' });
    }

    const [ano, mes] = periodo.split('-');

    // Controle de integridade
    const checkSql = `
      SELECT COUNT(*) as QTD FROM FECHAMENTO_PECUARIA
      WHERE FP_EMPRESA = :filial AND FP_ANO = :ano AND FP_MES = :mes
    `;
    const checkResult = await db.execute(checkSql, { filial, ano: parseInt(ano), mes: parseInt(mes) });
    if (checkResult[0] && checkResult[0].QTD > 0) {
      return res.status(400).json({ success: false, error: 'Já existe um fechamento para esta Filial e Período.' });
    }

    const sql = `
      INSERT INTO FECHAMENTO_PECUARIA (
        FP_EMPRESA, FP_ANO, FP_MES, FP_ESTOQUE_INI, FP_COMPRAS_QTD, FP_TRANSF_ENT_QTD, FP_TRANSF_SAI_QTD,
        FP_NASCIMENTOS, FP_MORTES_PERDA, FP_MORTES_CONSUMO, FP_VENDAS_QTD, FP_AJUSTE_INV, FP_ESTOQUE_FIN, FP_ESTOQUE_FAZENDA,
        FP_VL_ESTOQUE_INI, FP_VL_COMPRAS, FP_VL_TRANSF_ENT, FP_VL_NUTRICAO, FP_VL_PASTO, FP_CAV_U, FP_CAV,
        FP_CAM_PERDAS, FP_CAM_CONSUMO, FP_VL_ESTOQUE_FIN, FP_OBS, FP_DT_FECHAMENTO
      ) VALUES (
        :filial, :ano, :mes, :estoqueIni, :comprasQtd, :transfEntQtd, :transfSaiQtd,
        :nascimentos, :mortesPerda, :mortesConsumo, :vendasQtd, :ajusteInv, :estoqueFin, :estoqueFazenda,
        :vlEstoqueIni, :vlCompras, :vlTransfEnt, :vlNutricao, :vlPasto, :cavu, :cav,
        :camPerdas, :camConsumo, :vlEstoqueFin, :obs, SYSDATE
      )
    `;

    await db.execute(sql, {
      filial, ano: parseInt(ano), mes: parseInt(mes),
      estoqueIni: Number(estoqueIni || 0),
      comprasQtd: Number(comprasQtd || 0),
      transfEntQtd: Number(transfEntQtd || 0),
      transfSaiQtd: Number(transfSaiQtd || 0),
      nascimentos: parseInt(nascimentos || 0),
      mortesPerda: parseInt(mortesPerda || 0),
      mortesConsumo: parseInt(mortesConsumo || 0),
      vendasQtd: Number(vendasQtd || 0),
      ajusteInv: Number(ajusteInv || 0),
      estoqueFin: Number(estoqueFin || 0),
      estoqueFazenda: Number(estoqueFazenda || 0),
      vlEstoqueIni: Number(vlEstoqueIni || 0),
      vlCompras: Number(vlCompras || 0),
      vlTransfEnt: Number(vlTransfEnt || 0),
      vlNutricao: Number(vlNutricao || 0),
      vlPasto: Number(vlPasto || 0),
      cavu: Number(cavu || 0),
      cav: Number(cav || 0),
      camPerdas: Number(camPerdas || 0),
      camConsumo: Number(camConsumo || 0),
      vlEstoqueFin: Number(vlEstoqueFin || 0),
      obs: obs || ''
    }, { autoCommit: true });

    res.json({ success: true, mensagem: 'Fechamento inserido com sucesso.' });
  } catch (err) {
    console.error('[pecuaria/fechamento/insert]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/pecuaria/fechamento/:id — atualiza fechamento manual de pecuária
app.put('/api/pecuaria/fechamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      estoqueIni, comprasQtd, transfEntQtd, transfSaiQtd,
      nascimentos, mortesPerda, mortesConsumo, vendasQtd, ajusteInv, estoqueFin,
      estoqueFazenda, vlEstoqueIni, vlCompras, vlTransfEnt, vlNutricao, vlPasto,
      cavu, cav, camPerdas, camConsumo, vlEstoqueFin, obs
    } = req.body;

    const sql = `
      UPDATE FECHAMENTO_PECUARIA SET
        FP_ESTOQUE_INI = :estoqueIni, FP_COMPRAS_QTD = :comprasQtd,
        FP_TRANSF_ENT_QTD = :transfEntQtd, FP_TRANSF_SAI_QTD = :transfSaiQtd,
        FP_NASCIMENTOS = :nascimentos, FP_MORTES_PERDA = :mortesPerda,
        FP_MORTES_CONSUMO = :mortesConsumo, FP_VENDAS_QTD = :vendasQtd,
        FP_AJUSTE_INV = :ajusteInv, FP_ESTOQUE_FIN = :estoqueFin,
        FP_ESTOQUE_FAZENDA = :estoqueFazenda,
        FP_VL_ESTOQUE_INI = :vlEstoqueIni, FP_VL_COMPRAS = :vlCompras,
        FP_VL_TRANSF_ENT = :vlTransfEnt, FP_VL_NUTRICAO = :vlNutricao,
        FP_VL_PASTO = :vlPasto, FP_CAV_U = :cavu, FP_CAV = :cav,
        FP_CAM_PERDAS = :camPerdas, FP_CAM_CONSUMO = :camConsumo,
        FP_VL_ESTOQUE_FIN = :vlEstoqueFin, FP_OBS = :obs,
        FP_DT_FECHAMENTO = SYSDATE
      WHERE FP_ID = :id
    `;

    await db.execute(sql, {
      id: parseInt(id),
      estoqueIni: Number(estoqueIni || 0),
      comprasQtd: Number(comprasQtd || 0),
      transfEntQtd: Number(transfEntQtd || 0),
      transfSaiQtd: Number(transfSaiQtd || 0),
      nascimentos: parseInt(nascimentos || 0),
      mortesPerda: parseInt(mortesPerda || 0),
      mortesConsumo: parseInt(mortesConsumo || 0),
      vendasQtd: Number(vendasQtd || 0),
      ajusteInv: Number(ajusteInv || 0),
      estoqueFin: Number(estoqueFin || 0),
      estoqueFazenda: Number(estoqueFazenda || 0),
      vlEstoqueIni: Number(vlEstoqueIni || 0),
      vlCompras: Number(vlCompras || 0),
      vlTransfEnt: Number(vlTransfEnt || 0),
      vlNutricao: Number(vlNutricao || 0),
      vlPasto: Number(vlPasto || 0),
      cavu: Number(cavu || 0),
      cav: Number(cav || 0),
      camPerdas: Number(camPerdas || 0),
      camConsumo: Number(camConsumo || 0),
      vlEstoqueFin: Number(vlEstoqueFin || 0),
      obs: obs || ''
    }, { autoCommit: true });

    res.json({ success: true, mensagem: 'Fechamento atualizado com sucesso.' });
  } catch (err) {
    console.error('[pecuaria/fechamento/update]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/pecuaria/fechamento/:id — exclui fechamento pelo ID
app.delete('/api/pecuaria/fechamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM FECHAMENTO_PECUARIA WHERE FP_ID=:id', { id: parseInt(id) }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Fechamento excluído.' });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});


// Inicialização do Servidor e do Pool de Banco de Dados


// ============================================================
// MÓDULO FECHAMENTO FINANCEIRO — CUSTOS INDIRETOS E DESPESAS
// ============================================================

function buildFinanceiroSQL(options = {}) {
  const isArr = options.isArrendamento;
  const arrFilter = isArr ? "AND ZA.ZA1_CODIGO = 'ARR '" : "AND ZA.ZA1_CODIGO <> 'ARR '";

  return `
    SELECT  
      TRIM(SUBSTR(SE5.E5_FILIAL, 3, 2)) AS EMPRESA,
      DECODE(E5_CLVLDB,'01','028501','02','028501','03','028501',E5_FILorig) AS Filial,
      TO_DATE(SE5.E5_DTDISPO, 'yyyy/mm/dd') AS DATA_PAGAMENTO,
      CASE SE5.E5_RECPAG 
          WHEN 'P' THEN SE5.E5_VALOR * -1
          WHEN 'R' THEN SE5.E5_VALOR 
      END AS VALOR_R$,
      TRIM(substr(SE5.E5_CCD,1,2)) AS C_CUSTO,
      case when E5_CCD='04.21    ' then
           'Logistica Compartilhada'
      else
      decode(za1_nature,
         '1','Custo Mão-de-Obra',
         '2','Dia-a-Dia',
         '3','Manutenção',
         '6','Arrendamentos ','Sem Classificação') 
      end as cc_grupo,
      case when E5_CLVLDB = '02' then 
           'Rateio Geral'
      else DECODE(substr(E5_CCD,1,2),'01','PECUARIA','02','SOJA','Rateio Interno')  end Tipo_rateio,
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
      ${arrFilter}

    UNION ALL

    SELECT 
      TRIM(SUBSTR(ZF2.ZF2_FILIAL, 3, 2)) AS EMPRESA,
      ZF2.ZF2_FILIAL AS Filial,
      TO_DATE(ZF2.ZF2_DTABAS, 'yyyy/mm/dd') AS DATA_PAGAMENTO,
      ZF2.ZF2_VALTOT AS VALOR_R$,
      TRIM(substr(ZF2.ZF2_CCUSTO,1,2)) AS C_CUSTO,
      'Combustíveis' AS cc_grupo,
      CASE WHEN substr(ZF2.ZF2_CCUSTO,1,2) = '05' THEN 'Rateio Geral' 
           ELSE DECODE(substr(ZF2.ZF2_CCUSTO,1,2),'01','PECUARIA','02','SOJA','Rateio Interno') 
      END AS Tipo_rateio,
      TRIM(ZF2.ZF2_YDESCO) AS CC_SUBGRUPO,
      'FROTA' AS TP_GER,
      TRIM(ZF2.ZF2_FROTA) || ' - ' || TRIM(ST9.T9_NOME) AS TIPO_GERENCIAL,
      ' ' AS CLAS,
      trim(ctt_custo) as PREFIXO,
      trim(ctt_desc01) AS NUMERO,
      ' ' AS PARCELA,
      ' ' AS TIPO,
      ' ' AS NATUREZA,
      ' ' AS CLI_FOR,
      ' ' AS BENEF,
      trim(zf2_obs) AS HISTORICO_BAIXA,
      ' ' AS MOEDA,
      SM.M2_MOEDA2 AS PTAX,
      ' ' AS NUMCHEQ,
      ' ' AS DOCUMEN,
      ' ' AS TIPODOC,
      ' ' AS FILORIG,
      'P' AS RECPAG,
      ' ' AS RECONC,
      ' ' AS SEQ,
      ZF2.R_E_C_N_O_ AS REGSE5,
      ' ' AS BANCO,
      ' ' AS AGENCIA,
      ' ' AS CONTA,
      ' ' AS AGLOM,
      ' ' AS SAFRA,
      SUBSTR(ZF2.ZF2_DTABAS, 1, 4) AS ANO,
      SUBSTR(ZF2.ZF2_DTABAS, 5, 2) AS MES,
      SUBSTR(ZF2.ZF2_DTABAS, 1, 6) AS ANO_MES
    FROM protheus11.ZF2020 ZF2
    LEFT JOIN protheus11.ST9020 ST9 
      ON ST9.T9_CODBEM = ZF2.ZF2_FROTA AND ST9.D_E_L_E_T_ <> '*'
    LEFT JOIN protheus11.SM2020 SM
      ON SM.M2_DATA = ZF2.ZF2_DTABAS - 1 AND SM.D_E_L_E_T_ <> '*'
    LEFT JOIN protheus11.ctt020 cc2
      ON cc2.ctt_filial=zf2_FILIAL
      and cc2.ctt_custo = ZF2_CCUSTO AND cc2.D_E_L_E_T_ <> '*'      
    WHERE ZF2.D_E_L_E_T_ <> '*'
      AND ZF2.ZF2_DTABAS >= REPLACE(:data_de, '-', '')
      AND ZF2.ZF2_DTABAS <= REPLACE(:data_ate, '-', '')
  `;
}

app.get('/api/financeiro/dados', async (req, res) => {
  const { data_de, data_ate } = req.query;
  if (!data_de || !data_ate) {
    return res.status(400).json({ success: false, error: 'Faltando data_de ou data_ate' });
  }

  try {
    const binds = { data_de, data_ate };
    const sql = buildFinanceiroSQL({ isArrendamento: false });
    const rows = await db.execute(sql, binds);

    // Calcular período de 12 meses para Arrendamento (11 meses atrás do mês de data_ate)
    const dateAteStr = data_ate.replace(/-/g, ''); // '20260731'
    const year = parseInt(dateAteStr.substring(0, 4), 10);
    const month = parseInt(dateAteStr.substring(4, 6), 10);

    let startMonth = month - 11;
    let startYear = year;
    if (startMonth <= 0) {
      startMonth += 12;
      startYear -= 1;
    }
    const startMonthStr = startMonth.toString().padStart(2, '0');
    const dataDeArr = `${startYear}${startMonthStr}01`;
    const dataAteArr = dateAteStr; // até a data original

    const sqlArr = buildFinanceiroSQL({ isArrendamento: true });
    const bindsArr = { data_de: dataDeArr, data_ate: dataAteArr };
    const rowsArr = await db.execute(sqlArr, bindsArr);

    // Identificar os meses consultados originais para gerar as linhas sintéticas
    const d1 = data_de.replace(/-/g, '');
    const m1_y = parseInt(d1.substring(0, 4), 10);
    const m1_m = parseInt(d1.substring(4, 6), 10);
    const m2_y = parseInt(dateAteStr.substring(0, 4), 10);
    const m2_m = parseInt(dateAteStr.substring(4, 6), 10);

    const queryMonths = [];
    let curY = m1_y, curM = m1_m;
    while (curY < m2_y || (curY === m2_y && curM <= m2_m)) {
      queryMonths.push(`${curY}${curM.toString().padStart(2, '0')}`);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    // Gerar linhas sintéticas de arrendamento rateadas em 12
    rowsArr.forEach(r => {
      const valPorMes = (r.VALOR_R$ || 0) / 12;
      queryMonths.forEach(qm => {
        const newRow = { ...r };
        newRow.VALOR_R$ = valPorMes;
        newRow.CC_GRUPO = 'Arrendamentos '; // Espaço incluído para match exato com o decode original, se necessário
        newRow.ANO_MES = qm;
        newRow.ANO = qm.substring(0, 4);
        newRow.MES = qm.substring(4, 6);
        rows.push(newRow);
      });
    });

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
    const rows = await db.execute(`SELECT ROWID AS "ID", FECHAMENTO_FINANCEIRO.* FROM FECHAMENTO_FINANCEIRO ${where} ORDER BY FF_ANO DESC, FF_MES DESC`, binds);
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
      const sql = `
        INSERT INTO FECHAMENTO_FINANCEIRO (
          FF_ANO, FF_MES, FF_EMPRESA, FF_NEGOCIO, 
          FF_CC_GRUPO, FF_CC_SUBGRUPO, FF_TIPO_RATEIO, FF_VALOR_BRL, FF_PTAX
        ) VALUES (
          :ano, :mes, :empresa, :negocio, 
          :grupo, :subgrupo, :tipoRateio, :vlrBrl, :ptax
        )
      `;
      const binds = {
        ano,
        mes,
        empresa: d.empresa || 'TOTAL',
        negocio: d.negocio || 'ND',
        grupo: d.grupo || 'ND',
        subgrupo: d.subgrupo || '',
        tipoRateio: d.tipoRateio || '',
        vlrBrl: d.vlrBrl || 0,
        ptax: d.ptax || 0
      };
      await db.execute(sql, binds, { autoCommit: false });
    }

    await db.execute('COMMIT', [], { autoCommit: true });
    res.json({ success: true, mensagem: `Mês ${mes}/${ano} fechado com sucesso!` });
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
    res.json({ success: true, mensagem: `Mês ${mes}/${ano} reaberto com sucesso.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// POST /api/financeiro/ajuste — Adiciona linha manual
app.post('/api/financeiro/ajuste', async (req, res) => {
  const { ano, mes, filial, negocio, grupo, subgrupo, tiporateio, vlrBrl, ptax } = req.body;

  if (!ano || !mes) return res.status(400).json({ success: false, error: 'Ano e Mês obrigatórios.' });

  try {
    const sql = `
      INSERT INTO FECHAMENTO_FINANCEIRO (
        FF_ANO, FF_MES, FF_EMPRESA, FF_NEGOCIO, 
        FF_CC_GRUPO, FF_CC_SUBGRUPO, FF_TIPO_RATEIO, FF_VALOR_BRL, FF_PTAX
      ) VALUES (
        :ano, :mes, :filial, :negocio, 
        :grupo, :subgrupo, :tiporateio, :vlrBrl, :ptax
      )
    `;
    const binds = {
      ano: ano,
      mes: mes,
      filial: filial || '',
      negocio: negocio || '',
      grupo: grupo || '',
      subgrupo: subgrupo || '',
      tiporateio: tiporateio || '',
      vlrBrl: vlrBrl || 0,
      ptax: ptax || 1
    };

    await db.execute(sql, binds, { autoCommit: true });
    res.json({ success: true, mensagem: 'Ajuste salvo com sucesso.' });
  } catch (err) {
    console.error('Erro POST financeiro ajuste:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/financeiro/ajuste/:id — Edita linha manual
app.put('/api/financeiro/ajuste/:id', async (req, res) => {
  const { id } = req.params;
  const { ano, mes, filial, negocio, grupo, subgrupo, tiporateio, vlrBrl, ptax } = req.body;

  try {
    const sql = `
      UPDATE FECHAMENTO_FINANCEIRO SET
        FF_ANO = :ano, FF_MES = :mes, FF_EMPRESA = :filial, FF_NEGOCIO = :negocio,
        FF_CC_GRUPO = :grupo, FF_CC_SUBGRUPO = :subgrupo, FF_TIPO_RATEIO = :tiporateio,
        FF_VALOR_BRL = :vlrBrl, FF_PTAX = :ptax
      WHERE ROWID = :id
    `;
    const binds = {
      ano: ano,
      mes: mes,
      filial: filial || '',
      negocio: negocio || '',
      grupo: grupo || '',
      subgrupo: subgrupo || '',
      tiporateio: tiporateio || '',
      vlrBrl: vlrBrl || 0,
      ptax: ptax || 1,
      id: id
    };

    await db.execute(sql, binds, { autoCommit: true });
    res.json({ success: true, mensagem: 'Ajuste atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro PUT financeiro ajuste:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/financeiro/ajuste/:id — Exclui linha manual
app.delete('/api/financeiro/ajuste/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM FECHAMENTO_FINANCEIRO WHERE ROWID = :id', { id }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Ajuste removido com sucesso.' });
  } catch (err) {
    console.error('Erro DELETE financeiro ajuste:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ROTAS PARA DRE E PROJEÇÃO
// ==========================================

// GET /api/projecao - Retorna os valores projetados de uma safra
app.get('/api/projecao', async (req, res) => {
  const { safra } = req.query;
  try {
    let sql = `SELECT PD_RUBRICA, PD_VALOR FROM PROJECAO_DRE`;
    let binds = {};
    if (safra) {
      sql += ` WHERE PD_SAFRA = :safra`;
      binds.safra = safra;
    }
    const results = await db.execute(sql, binds);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Erro ao buscar projeção:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projecao/salvar - Salva a projeção de uma rubrica
app.post('/api/projecao/salvar', async (req, res) => {
  const { safra, rubrica, valor } = req.body;
  if (!safra || !rubrica) {
    return res.status(400).json({ success: false, error: 'Safra e rubrica são obrigatórios.' });
  }
  try {
    await db.execute('DELETE FROM PROJECAO_DRE WHERE PD_SAFRA = :safra AND PD_RUBRICA = :rubrica', { safra, rubrica }, { autoCommit: false });
    
    const sqlInsert = `
      INSERT INTO PROJECAO_DRE (PD_SAFRA, PD_RUBRICA, PD_VALOR) 
      VALUES (:safra, :rubrica, :valor)
    `;
    await db.execute(sqlInsert, { safra, rubrica, valor: Number(valor || 0) }, { autoCommit: true });
    
    res.json({ success: true, mensagem: 'Projeção atualizada com sucesso.' });
  } catch (err) {
    console.error('Erro ao salvar projeção:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/projecao/deletar
app.delete('/api/projecao/deletar', async (req, res) => {
  const { safra, rubrica } = req.body;
  if (!safra || !rubrica) {
    return res.status(400).json({ success: false, error: 'Safra e rubrica são obrigatórios.' });
  }
  try {
    await db.execute('DELETE FROM PROJECAO_DRE WHERE PD_SAFRA = :safra AND PD_RUBRICA = :rubrica', { safra, rubrica }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Projeção removida com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir projeção:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dre/consolidado - Retorna os dados agregados das 4 tabelas de fechamento
app.get('/api/dre/consolidado', async (req, res) => {
  try {
    const sqlRec = `
      SELECT FR_ANO, FR_MES, FR_EMPRESA, FR_NEGOCIO,
             SUM(FR_RECEITA_TOTAL) AS VALOR_CLI,
             SUM(FR_INTERCOMPANY) AS VALOR_INT,
             SUM(COALESCE(FR_FUNRURAL,0) + COALESCE(FR_GTA,0) + COALESCE(FR_FETHAB,0) + COALESCE(FR_VLR_FACS,0)) AS VALOR_DED
      FROM FECHAMENTO_RECEITA
      GROUP BY FR_ANO, FR_MES, FR_EMPRESA, FR_NEGOCIO
    `;

    const sqlIns = `
      SELECT FI_ANO, FI_MES, FI_EMPRESA, 'Agricultura' AS FI_NEGOCIO, FI_TIPO_INSUMO, SUM(FI_CUSTO_TOTAL) AS VALOR
      FROM FECHAMENTO_INSUMOS
      GROUP BY FI_ANO, FI_MES, FI_EMPRESA, FI_TIPO_INSUMO
    `;

    const sqlPec = `
      SELECT FP_ANO, FP_MES, FP_EMPRESA, 'Pecuaria' AS FP_NEGOCIO, SUM(FP_CAV) AS VALOR
      FROM FECHAMENTO_PECUARIA
      GROUP BY FP_ANO, FP_MES, FP_EMPRESA
    `;

    const sqlFin = `
      SELECT FF_ANO, FF_MES, FF_EMPRESA, FF_NEGOCIO, FF_CC_GRUPO, FF_TIPO_RATEIO, SUM(FF_VALOR_BRL) AS VALOR
      FROM FECHAMENTO_FINANCEIRO
      GROUP BY FF_ANO, FF_MES, FF_EMPRESA, FF_NEGOCIO, FF_CC_GRUPO, FF_TIPO_RATEIO
    `;

    const [rec, ins, pec, fin] = await Promise.all([
      db.execute(sqlRec),
      db.execute(sqlIns),
      db.execute(sqlPec),
      db.execute(sqlFin)
    ]);
    
    res.json({
      success: true,
      data: {
        receitas: rec,
        insumos: ins,
        pecuaria: pec,
        financeiro: fin
      }
    });
  } catch (err) {
    console.error('Erro consolidado DRE:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) {
    return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
  }
  try {
    const resultado = await autenticar(usuario, senha);
    if (!resultado.ok) {
      await registrarLog(usuario, null, 'LOGIN_FALHOU', null, req.ip);
      return res.status(401).json({ success: false, error: resultado.erro || 'Usuário ou senha incorretos.' });
    }

    // Salvar dados na sessão
    req.session.usuario = resultado.usuario;
    req.session.nome = resultado.nome;
    req.session.grupos = resultado.grupos;
    req.session.paineis = resultado.paineis;
    req.session.isAdmin = resultado.isAdmin;

    await registrarLog(usuario, resultado.nome, 'LOGIN_OK', null, req.ip);

    res.json({
      success: true,
      usuario: resultado.usuario,
      nome: resultado.nome,
      paineis: resultado.paineis,
      isAdmin: resultado.isAdmin
    });
  } catch (err) {
    console.error('[auth] Erro no login:', err);
    res.status(500).json({ success: false, error: 'Erro interno ao autenticar.' });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  const usuario = req.session?.usuario;
  const nome = req.session?.nome;
  req.session.destroy(async () => {
    if (usuario) await registrarLog(usuario, nome, 'LOGOUT', null, req.ip);
    res.json({ success: true });
  });
});

// GET /api/auth/me - Retorna dados do usuário logado
app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ success: false, error: 'Não autenticado.' });
  }
  res.json({
    success: true,
    usuario: req.session.usuario,
    nome: req.session.nome,
    paineis: req.session.paineis,
    isAdmin: req.session.isAdmin
  });
});

// GET /api/admin/paineis - Lista todos os painéis disponíveis
app.get('/api/admin/paineis', requireAuth, requireAdmin, (req, res) => {
  res.json({ success: true, data: TODOS_PAINEIS });
});

// GET /api/admin/grupos
app.get('/api/admin/grupos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(
      `SELECT g.GR_ID, g.GR_NOME, g.GR_DESCRICAO, g.GR_ATIVO,
              (SELECT LISTAGG(p.PM_PAINEL, ',') WITHIN GROUP (ORDER BY p.PM_PAINEL)
               FROM DF_PERMISSOES p WHERE p.PM_GRUPO_ID = g.GR_ID) AS PAINEIS
       FROM DF_GRUPOS g ORDER BY g.GR_NOME ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/grupos - Criar grupo
app.post('/api/admin/grupos', requireAuth, requireAdmin, async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) return res.status(400).json({ success: false, error: 'Nome do grupo é obrigatório.' });
  try {
    await db.execute(
      `INSERT INTO DF_GRUPOS (GR_NOME, GR_DESCRICAO) VALUES (:nome, :descricao)`,
      { nome, descricao: descricao || null },
      { autoCommit: true }
    );
    // Buscar o ID criado
    const rows = await db.execute(
      `SELECT GR_ID FROM DF_GRUPOS WHERE GR_NOME = :nome ORDER BY GR_ID DESC`,
      { nome }
    );
    const grId = rows.length > 0 ? rows[0].GR_ID : null;
    res.json({ success: true, mensagem: 'Grupo criado com sucesso.', data: { GR_ID: grId } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/grupos/:id - Atualizar grupo
app.put('/api/admin/grupos/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, ativo } = req.body;
  try {
    await db.execute(
      `UPDATE DF_GRUPOS SET GR_NOME=:nome, GR_DESCRICAO=:descricao, GR_ATIVO=:ativo WHERE GR_ID=:id`,
      { nome, descricao: descricao || null, ativo: ativo || 'S', id: Number(id) },
      { autoCommit: true }
    );
    res.json({ success: true, mensagem: 'Grupo atualizado.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/grupos/:id - Excluir grupo (e suas permissões via cascade)
app.delete('/api/admin/grupos/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute(`DELETE FROM DF_GRUPOS WHERE GR_ID = :id`, { id: Number(id) }, { autoCommit: true });
    res.json({ success: true, mensagem: 'Grupo removido.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/permissoes - Salvar permissões de um grupo (substitui tudo)
app.post('/api/admin/permissoes', requireAuth, requireAdmin, async (req, res) => {
  const { grupo_id, paineis } = req.body;
  if (!grupo_id || !Array.isArray(paineis)) {
    return res.status(400).json({ success: false, error: 'grupo_id e paineis são obrigatórios.' });
  }
  try {
    // Remover permissões existentes do grupo
    await db.execute(`DELETE FROM DF_PERMISSOES WHERE PM_GRUPO_ID = :id`, { id: Number(grupo_id) }, { autoCommit: true });
    // Inserir as novas permissões
    for (const painel of paineis) {
      await db.execute(
        `INSERT INTO DF_PERMISSOES (PM_GRUPO_ID, PM_PAINEL) VALUES (:id, :painel)`,
        { id: Number(grupo_id), painel },
        { autoCommit: true }
      );
    }
    res.json({ success: true, mensagem: 'Permissões salvas com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================================
// ROTAS DE USUÁRIOS POR GRUPO
// ==========================================================================

// GET /api/admin/grupos/:id/usuarios - Listar usuários de um grupo
app.get('/api/admin/grupos/:id/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db.execute(
      `SELECT GU_ID, GU_USUARIO 
       FROM DF_GRUPO_USUARIOS 
       WHERE GU_GRUPO_ID = :grupoId 
       ORDER BY GU_USUARIO ASC`,
      { grupoId: Number(id) }
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/grupos/:id/usuarios - Adicionar usuário ao grupo
app.post('/api/admin/grupos/:id/usuarios', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { usuario } = req.body;
  if (!usuario) return res.status(400).json({ success: false, error: 'Usuário é obrigatório.' });

  try {
    await db.execute(
      `INSERT INTO DF_GRUPO_USUARIOS (GU_GRUPO_ID, GU_USUARIO) VALUES (:grupoId, :usuario)`,
      { grupoId: Number(id), usuario: usuario.trim() },
      { autoCommit: true }
    );
    res.json({ success: true, mensagem: 'Usuário adicionado com sucesso.' });
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('UQ_GU_GRUPO_USER') || err.message.includes('ORA-00001')) {
      return res.status(400).json({ success: false, error: 'Este usuário já está neste grupo.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/usuarios/:guId - Remover usuário do grupo
app.delete('/api/admin/usuarios/:guId', requireAuth, requireAdmin, async (req, res) => {
  const { guId } = req.params;
  try {
    await db.execute(
      `DELETE FROM DF_GRUPO_USUARIOS WHERE GU_ID = :guId`,
      { guId: Number(guId) },
      { autoCommit: true }
    );
    res.json({ success: true, mensagem: 'Usuário removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/logs - Log de acessos
app.get('/api/admin/logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(
      `SELECT LA_ID, LA_USUARIO, LA_NOME, LA_ACAO, LA_PAINEL, LA_IP,
              TO_CHAR(LA_DATA, 'DD/MM/YYYY HH24:MI:SS') AS LA_DATA_FMT
       FROM DF_LOG_ACESSO ORDER BY LA_ID DESC FETCH FIRST 200 ROWS ONLY`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================================
// FLUXO DE CAIXA
// ==========================================================================

/**
 * GET /api/fluxo-caixa
 * Retorna dados do fluxo de caixa para o período selecionado.
 * Params: anoMesInicio (YYYYMM), anoMesFim (YYYYMM), grupo, filial, moeda
 */
app.get('/api/fluxo-caixa', requireAuth, async (req, res) => {
  try {
    const { anoMesInicio, anoMesFim, grupo, filial } = req.query;

    if (!anoMesInicio || !anoMesFim) {
      return res.status(400).json({ success: false, error: 'anoMesInicio e anoMesFim são obrigatórios' });
    }

    // Construir filtros de filial/grupo
    let filialFilter = '';
    const binds = { anoMesInicio, anoMesFim };

    if (filial && filial !== 'TODAS') {
      filialFilter = ' AND TRIM(fv.FILIAL) = :filial';
      binds.filial = filial;
    } else if (grupo && grupo !== 'TODAS') {
      if (grupo === 'Futurazy') {
        filialFilter = " AND TRIM(fv.FILIAL) IN ('028501','028503')";
      } else {
        filialFilter = " AND TRIM(fv.FILIAL) NOT IN ('028501','028503')";
      }
    }

    // --- Parte 1: View principal AV_FLUXODECAIXAFTZ ---
    // Colunas reais da view: STATUS, FILIAL, EMISSAO, VENCIMENTO, PREFIXO, NUMERO, PARCELA,
    //   TIPO, D_C, MO, PTAX, VALOR_R$, VLR_USD, SALDO_R$, SALDO_USD, TPGER, SAFRA,
    //   CLIENTE_FORNECEDOR, PROJECAO, HISTORICO_BAIXA
    const sqlView = `
      SELECT
        TO_CHAR(fv.VENCIMENTO, 'YYYYMM')  AS ANO_MES,
        TRIM(fv.FILIAL)                   AS FILIAL,
        TRIM(fv.TPGER)                    AS TP_GER,
        pl.FP_DESC                        AS DESC_TP_GER,
        fv.STATUS,
        TRIM(fv.PREFIXO)                  AS PREFIXO,
        "VALOR_R$"                        AS VALOR_BRL,
        fv.VLR_USD                        AS VALOR_USD,
        fv.PTAX,
        fv.MO,
        TRIM(fv.SAFRA)                    AS SAFRA,
        fv.VENCIMENTO                     AS DATA_VENCIMENTO,
        pl.FP_CONTA_PL,
        pl.FP_NIVEL
      FROM PROTHEUS11.AV_FLUXODECAIXAFTZ fv
      LEFT JOIN DF_FLUXO_PL pl ON TRIM(pl.FP_TP_GER) = TRIM(fv.TPGER)
      WHERE TO_CHAR(fv.VENCIMENTO, 'YYYYMM') BETWEEN :anoMesInicio AND :anoMesFim
        AND NVL(TRIM(fv.TPGER), 'X') <> 'NFC'
        ${filialFilter}
    `;

    // --- Parte 2: SE5020 — Rendimentos Líquidos (E5_MOEDA='M1') ---
    let filialSE5Filter = '';
    if (filial && filial !== 'TODAS') {
      filialSE5Filter = ` AND TRIM(substr(SE5.E5_FILIAL,1,6)) = :filial`;
    } else if (grupo && grupo !== 'TODAS') {
      if (grupo === 'Futurazy') {
        filialSE5Filter = ` AND TRIM(substr(SE5.E5_FILIAL,1,6)) IN ('028501','028503')`;
      } else {
        filialSE5Filter = ` AND TRIM(substr(SE5.E5_FILIAL,1,6)) NOT IN ('028501','028503')`;
      }
    }

    const sqlSE5 = `
      SELECT
        substr(SE5.E5_DTDISPO,1,6)                        AS ANO_MES,
        TRIM(substr(SE5.E5_FILIAL,1,6))                   AS FILIAL,
        'FINAN'                                            AS TP_GER,
        'RENDIMENTOS LIQ. APLICACAO'                       AS DESC_TP_GER,
        CASE SE5.E5_RECPAG
          WHEN 'P' THEN 'PAGO'
          ELSE 'RECEBIDO'
        END                                                AS STATUS,
        TRIM(SE5.E5_PREFIXO)                              AS PREFIXO,
        CASE SE5.E5_RECPAG
          WHEN 'P' THEN SE5.E5_VALOR * -1
          ELSE SE5.E5_VALOR
        END                                                AS VALOR_BRL,
        SE5.E5_VLMOED2                                     AS VALOR_USD,
        NULL                                               AS PTAX,
        1                                                  AS MO,
        TRIM(SE5.E5_YPLPCO)                                AS SAFRA,
        NULL                                              AS DATA_VENCIMENTO,
        'APLICACOES FINANCEIRAS E OUTROS'                  AS FP_CONTA_PL,
        '4.1'                                             AS FP_NIVEL
      FROM PROTHEUS11.SE5020 SE5
      WHERE SE5.E5_MOEDA    = 'M1'
        AND SE5.E5_SITUACA <> 'C'
        AND SE5.D_E_L_E_T_  = ' '
        AND LENGTH(TRIM(SE5.E5_DTDISPO)) = 8
        AND substr(SE5.E5_DTDISPO,1,6) BETWEEN :anoMesInicio AND :anoMesFim
        ${filialSE5Filter}
    `;

    const [rowsView, rowsSE5] = await Promise.all([
      db.execute(sqlView, binds),
      db.execute(sqlSE5, binds)
    ]);

    // Buscar cotação atual do dólar para usar quando não houver PTAX
    let ptaxHoje = null;
    try {
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}${String(hoje.getMonth()+1).padStart(2,'0')}${String(hoje.getDate()).padStart(2,'0')}`;
      const ptaxRows = await db.execute(
        `SELECT M2_MOEDA2 FROM PROTHEUS11.SM2020
         WHERE M2_DATA <= :dt
           AND M2_DATA <> '        '
           AND D_E_L_E_T_ <> '*'
         ORDER BY M2_DATA DESC FETCH FIRST 1 ROWS ONLY`,
        { dt: hojeStr }
      );
      if (ptaxRows.length > 0) ptaxHoje = ptaxRows[0].M2_MOEDA2;
    } catch(e) {
      console.warn('[fluxo-caixa] Aviso: não foi possível buscar PTAX atual:', e.message);
    }

    const STATUS_REALIZADO = ['PAGO','RECEBIDO'];

    // Normalizar e combinar os dois conjuntos
    const allRows = [...rowsView, ...rowsSE5].map(r => {
      const ptax = r.PTAX || ptaxHoje || 1;
      const status = (r.STATUS || '').trim().toUpperCase();
      const prefixo = (r.PREFIXO || '').trim().toUpperCase();
      const isRealizado = STATUS_REALIZADO.includes(status);
      const isProjecao  = prefixo === 'PROJ';

      let contaPL = (r.FP_CONTA_PL || '').trim().toUpperCase();
      contaPL = contaPL.replace(/¿/g, 'Ç')
                       .replace(/AÇOES/g, 'AÇÕES')
                       .replace(/APLICACOES/g, 'APLICAÇÕES')
                       .replace(/AMORTIZAÇOES/g, 'AMORTIZAÇÕES')
                       .replace(/AMORTIZACOES/g, 'AMORTIZAÇÕES')
                       .replace(/CAPTAÇOES/g, 'CAPTAÇÕES')
                       .replace(/CAPTACOES/g, 'CAPTAÇÕES');

      return {
        ANO_MES:         r.ANO_MES,
        FILIAL:          r.FILIAL,
        TP_GER:          r.TP_GER,
        DESC_TP_GER:     r.DESC_TP_GER,
        STATUS:          status,
        PREFIXO:         prefixo,
        VALOR_BRL:       r.VALOR_BRL || 0,
        VALOR_USD:       r.VALOR_USD || 0,
        PTAX:            ptax,
        MO:              r.MO || 1,
        SAFRA:           r.SAFRA,
        DATA_VENCIMENTO: r.DATA_VENCIMENTO,
        FP_CONTA_PL:     contaPL,
        FP_NIVEL:        r.FP_NIVEL,
        // Campo GRUPO
        GRUPO: ['028501','028503'].includes((r.FILIAL || '').trim()) ? 'Futurazy' : 'Outras',
        // Campo BAIXA
        BAIXA: isRealizado ? 'REALIZADO' : 'A_REALIZAR',
        // Coluna de classificação
        COLUNA: isRealizado ? 'REALIZADO' : (isProjecao ? 'PROJECAO' : 'PROVISAO')
      };
    });

    res.json({ success: true, count: allRows.length, ptaxHoje, data: allRows });
  } catch (err) {
    console.error('[fluxo-caixa] Erro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /api/fluxo-caixa/saldo-inicial
 * Retorna o saldo de caixa antes do início do período (SE8020).
 * Params: anoMesInicio (YYYYMM)
 */
app.get('/api/fluxo-caixa/saldo-inicial', requireAuth, async (req, res) => {
  try {
    const { anoMesInicio, grupo, filial } = req.query;
    if (!anoMesInicio) {
      return res.status(400).json({ success: false, error: 'anoMesInicio é obrigatório' });
    }

    // Calcula o primeiro dia anterior ao dia 1 da grid (último dia do mês anterior)
    const ano = parseInt(anoMesInicio.substring(0, 4), 10);
    const mes = parseInt(anoMesInicio.substring(4, 6), 10);
    const dataAnterior = new Date(ano, mes - 1, 0); 
    const yyyy = dataAnterior.getFullYear();
    const mm = String(dataAnterior.getMonth() + 1).padStart(2, '0');
    const dd = String(dataAnterior.getDate()).padStart(2, '0');
    const dataConsulta = `${yyyy}${mm}${dd}`;

    let filtroFilial = "";
    const binds = { dataConsulta };

    if (filial && filial !== 'TODAS') {
      filtroFilial = "AND A.E8_MSFIL = :filial";
      binds.filial = filial;
    } else if (grupo && grupo !== 'TODAS') {
      if (grupo === 'Futurazy') {
        filtroFilial = "AND SUBSTR(A.E8_FILIAL, 1, 4) = '0285'";
      } else if (grupo === 'Orides') {
        filtroFilial = "AND SUBSTR(A.E8_FILIAL, 1, 4) = '0269'";
      }
    }

    const sql = `
      SELECT NVL(SUM(A.E8_SALATUA), 0) AS SALDO
        FROM PROTHEUS11.SE8020 A
       WHERE A.E8_DTSALAT = (SELECT MAX(B.E8_DTSALAT)
                               FROM PROTHEUS11.SE8020 B
                              WHERE B.E8_FILIAL   = A.E8_FILIAL
                                AND B.E8_BANCO    = A.E8_BANCO
                                AND B.E8_AGENCIA  = A.E8_AGENCIA
                                AND B.E8_CONTA    = A.E8_CONTA
                                AND B.E8_DTSALAT <= :dataConsulta
                                AND B.D_E_L_E_T_  = ' ')
         ${filtroFilial}
         AND A.D_E_L_E_T_ = ' '
    `;

    const rows = await db.execute(sql, binds);
    const saldo = rows.length > 0 ? (rows[0].SALDO || 0) : 0;

    res.json({ success: true, saldo });
  } catch (err) {
    console.error('[fluxo-caixa/saldo-inicial] Erro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/fluxo-caixa/drilldown
 * Retorna os lançamentos individuais de uma célula do fluxo de caixa
 */
app.get('/api/fluxo-caixa/drilldown', requireAuth, async (req, res) => {
  try {
    const { anoMes, tpGer, contaPL, coluna, grupo, filial } = req.query;

    if (!anoMes) {
      return res.status(400).json({ success: false, error: 'anoMes é obrigatório' });
    }

    let filialFilter = '';
    const binds = { anoMes };

    if (filial && filial !== 'TODAS') {
      filialFilter = ' AND TRIM(fv.FILIAL) = :filial';
      binds.filial = filial;
    } else if (grupo && grupo !== 'TODAS') {
      if (grupo === 'Futurazy') {
        filialFilter = " AND TRIM(fv.FILIAL) IN ('028501','028503')";
      } else {
        filialFilter = " AND TRIM(fv.FILIAL) NOT IN ('028501','028503')";
      }
    }

    let filterColuna = "";
    if (coluna === 'REALIZADO') {
      filterColuna = " AND TRIM(UPPER(fv.STATUS)) IN ('PAGO','RECEBIDO')";
    } else if (coluna === 'PROJECAO') {
      filterColuna = " AND TRIM(UPPER(fv.PREFIXO)) = 'PROJ'";
    } else if (coluna === 'PROVISAO') {
      filterColuna = " AND TRIM(UPPER(fv.STATUS)) NOT IN ('PAGO','RECEBIDO') AND NVL(TRIM(UPPER(fv.PREFIXO)), 'X') <> 'PROJ'";
    }

    let filterRubrica = "";
    if (tpGer) {
      filterRubrica = " AND TRIM(fv.TPGER) = :tpGer";
      binds.tpGer = tpGer;
    } else if (contaPL) {
      filterRubrica = " AND TRIM(pl.FP_CONTA_PL) = :contaPL";
      binds.contaPL = contaPL;
    }

    const sqlView = `
      SELECT
        TRIM(fv.FILIAL)                   AS FILIAL,
        TRIM(fv.PREFIXO)                  AS PREFIXO,
        TRIM(fv.NUMERO)                   AS NUMERO,
        TRIM(fv.PARCELA)                  AS PARCELA,
        TRIM(fv.TIPO)                     AS TIPO,
        fv.EMISSAO                        AS DATA_EMISSAO,
        fv.VENCIMENTO                     AS DATA_VENCIMENTO,
        TRIM(fv.CLIENTE_FORNECEDOR)       AS CLIENTE_FORNECEDOR,
        TRIM(fv.HISTORICO_BAIXA)          AS HISTORICO_BAIXA,
        TRIM(fv.SAFRA)                    AS SAFRA,
        "VALOR_R$"                        AS VALOR_BRL,
        fv.VLR_USD                        AS VALOR_USD,
        fv.PTAX                           AS PTAX,
        fv.MO                             AS MO,
        fv.STATUS
      FROM PROTHEUS11.AV_FLUXODECAIXAFTZ fv
      LEFT JOIN DF_FLUXO_PL pl ON TRIM(pl.FP_TP_GER) = TRIM(fv.TPGER)
      WHERE TO_CHAR(fv.VENCIMENTO, 'YYYYMM') = :anoMes
        AND NVL(TRIM(fv.TPGER), 'X') <> 'NFC'
        ${filialFilter}
        ${filterColuna}
        ${filterRubrica}
      ORDER BY fv.VENCIMENTO ASC
    `;

    const rowsView = await db.execute(sqlView, binds);

    // SE5 logic
    let rowsSE5 = [];
    if (!tpGer || tpGer === 'FINAN') {
      let bindsSE5 = { anoMes };
      let filialSE5Filter = '';
      if (filial && filial !== 'TODAS') {
        filialSE5Filter = ` AND TRIM(substr(SE5.E5_FILIAL,1,6)) = :filial`;
        bindsSE5.filial = filial;
      } else if (grupo && grupo !== 'TODAS') {
        if (grupo === 'Futurazy') {
          filialSE5Filter = ` AND TRIM(substr(SE5.E5_FILIAL,1,6)) IN ('028501','028503')`;
        } else {
          filialSE5Filter = ` AND TRIM(substr(SE5.E5_FILIAL,1,6)) NOT IN ('028501','028503')`;
        }
      }

      let filterColunaSE5 = "";
      if (coluna === 'REALIZADO') {
        filterColunaSE5 = " AND 1=1"; // SE5 is always Realizado here as it is from contas a receber/pagar baixadas
      } else if (coluna === 'PROJECAO' || coluna === 'PROVISAO') {
        filterColunaSE5 = " AND 1=0"; // Never projection or provision in this SE5 query
      }

      const sqlSE5 = `
        SELECT
          TRIM(substr(SE5.E5_FILIAL,1,6))                   AS FILIAL,
          TRIM(SE5.E5_PREFIXO)                              AS PREFIXO,
          TRIM(SE5.E5_NUMERO)                               AS NUMERO,
          TRIM(SE5.E5_PARCELA)                              AS PARCELA,
          TRIM(SE5.E5_TIPO)                                 AS TIPO,
          SE5.E5_DATA                                       AS DATA_EMISSAO,
          SE5.E5_DTDISPO                                    AS DATA_VENCIMENTO,
          'RENDIMENTOS LIQ. APLICACAO'                       AS CLIENTE_FORNECEDOR,
          TRIM(SE5.E5_HISTOR)                                AS HISTORICO_BAIXA,
          CASE SE5.E5_RECPAG
            WHEN 'P' THEN SE5.E5_VALOR * -1
            ELSE SE5.E5_VALOR
          END                                                AS VALOR_BRL,
          SE5.E5_VLMOED2                                     AS VALOR_USD,
          NULL                                               AS PTAX,
          1                                                  AS MO,
          TRIM(SE5.E5_YPLPCO)                                AS SAFRA,
          CASE SE5.E5_RECPAG
            WHEN 'P' THEN 'PAGO'
            ELSE 'RECEBIDO'
          END                                                AS STATUS
        FROM PROTHEUS11.SE5020 SE5
        WHERE SE5.D_E_L_E_T_ = ' '
          AND SE5.E5_MOEDA = 'M1'
          AND substr(SE5.E5_DTDISPO,1,6) = :anoMes
          ${filialSE5Filter}
          ${filterColunaSE5}
      `;
      rowsSE5 = await db.execute(sqlSE5, bindsSE5);
    }

    const rows = [...rowsView, ...rowsSE5];

    // Ajusta o sinal igual no backend principal
    const data = rows.map(r => {
      const status = (r.STATUS || '').trim().toUpperCase();
      let valor = r.VALOR_BRL || 0;
      
      return {
        FILIAL: r.FILIAL,
        DOCUMENTO: `${r.PREFIXO || ''}-${r.NUMERO || ''}/${r.PARCELA || ''}`.replace(/^-|\/$/g, ''),
        TIPO: r.TIPO,
        SAFRA: r.SAFRA,
        CLIENTE_FORNECEDOR: r.CLIENTE_FORNECEDOR || '—',
        DATA_EMISSAO: r.DATA_EMISSAO,
        DATA_VENCIMENTO: r.DATA_VENCIMENTO,
        HISTORICO: r.HISTORICO_BAIXA || '—',
        VALOR_BRL: valor,
        VALOR_USD: r.VALOR_USD || 0,
        PTAX: r.PTAX || 0,
        MO: r.MO || 1,
        STATUS: status
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[fluxo-caixa/drilldown] Erro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /api/fluxo-caixa/pl
 * Lista o mapeamento ProfitLoss (tabela DF_FLUXO_PL).
 */
app.get('/api/fluxo-caixa/pl', requireAuth, async (req, res) => {
  try {
    const rows = await db.execute(
      `SELECT FP_ID, FP_TP_GER, FP_DESC, FP_CONTA_PL, FP_NIVEL, FP_ATIVO
       FROM DF_FLUXO_PL ORDER BY FP_NIVEL, FP_TP_GER`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/fluxo-caixa/pl
 * Upsert de entrada na tabela DF_FLUXO_PL (apenas admin).
 */
app.post('/api/fluxo-caixa/pl', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { tpGer, descr, contaPL, nivel, ativo } = req.body;
    if (!tpGer || !contaPL || !nivel) {
      return res.status(400).json({ success: false, error: 'tpGer, contaPL e nivel são obrigatórios' });
    }

    // Verificar se já existe
    const existing = await db.execute(
      `SELECT FP_ID FROM DF_FLUXO_PL WHERE TRIM(FP_TP_GER) = TRIM(:tpGer)`,
      { tpGer }
    );

    if (existing.length > 0) {
      await db.execute(
        `UPDATE DF_FLUXO_PL SET FP_DESC=:descr, FP_CONTA_PL=:contaPL, FP_NIVEL=:nivel, FP_ATIVO=:ativo
         WHERE TRIM(FP_TP_GER) = TRIM(:tpGer)`,
        { descr: descr || '', contaPL, nivel, ativo: ativo || 'S', tpGer },
        { autoCommit: true }
      );
      res.json({ success: true, action: 'updated' });
    } else {
      await db.execute(
        `INSERT INTO DF_FLUXO_PL (FP_TP_GER, FP_DESC, FP_CONTA_PL, FP_NIVEL, FP_ATIVO)
         VALUES (:tpGer, :descr, :contaPL, :nivel, :ativo)`,
        { tpGer, descr: descr || '', contaPL, nivel, ativo: ativo || 'S' },
        { autoCommit: true }
      );
      res.json({ success: true, action: 'inserted' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================================================
// INICIALIZAÇÃO DO SERVIDOR (HTTPS)
// ==========================================================================

async function startServer() {
  try {
    await db.initialize();

    // Carregar certificado SSL
    const certPath = path.join(__dirname, 'certs', 'server.crt');
    const keyPath = path.join(__dirname, 'certs', 'server.key');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const httpsOptions = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath)
      };
      https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`✅ Servidor HTTPS rodando em https://localhost:${HTTPS_PORT}`);
        console.log(`   → Acesse: https://localhost:${HTTPS_PORT}/login.html`);
      });
    } else {
      console.warn('⚠️  Certificado SSL não encontrado. Rodando em HTTP (execute: node scripts/gerar_cert.js)');
      app.listen(PORT, () => {
        console.log(`Servidor HTTP rodando em http://localhost:${PORT}`);
      });
    }
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

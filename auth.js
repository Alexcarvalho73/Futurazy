/**
 * Módulo de Autenticação - FuturazyBI
 *
 * Fase 1: Autenticação via usuário Admin hardcoded (temporário para testes)
 * Fase 2: Quando LDAP_ENABLED=true no .env, autenticação via Active Directory
 */
require('dotenv').config();
const db = require('./db');

// Lista de todos os painéis disponíveis no sistema
const TODOS_PAINEIS = [
  'analise_trato',
  'central_xml',
  'fechamento_dre',
  'fechamento_financeiro',
  'fechamento_receita',
  'fechamento_insumos',
  'fechamento_pecuaria',
  'fluxo_caixa',
  'admin_permissoes'
];

/**
 * Autenticação via usuário hardcoded (temporário)
 * Retorna os grupos LDAP simulados do usuário.
 */
async function autenticarHardcoded(usuario, senha) {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || '123123';

  if (usuario === adminUser && senha === adminPass) {
    // Simula o grupo AD do admin
    return { ok: true, grupos: ['DF_FUTURAZY_ADMIN'], nome: 'Administrador (Local)' };
  }
  return { ok: false, grupos: [], nome: null };
}

/**
 * Autenticação via LDAP/AD (ativada quando LDAP_ENABLED=true)
 */
async function autenticarLDAP(usuario, senha) {
  const { Client } = require('ldapts');

  const url = process.env.LDAP_URL;
  const bindDN = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;
  const baseDN = process.env.LDAP_USER_BASE_DN;
  const prefix = process.env.LDAP_GROUP_PREFIX || 'DF_';

  const client = new Client({ url });

  try {
    // 1. Bind com o service account para buscar o DN do usuário
    await client.bind(bindDN, bindPassword);

    // 2. Buscar o usuário no AD
    const { searchEntries } = await client.search(baseDN, {
      scope: 'sub',
      filter: `(sAMAccountName=${usuario})`,
      attributes: ['dn', 'cn', 'displayName', 'memberOf']
    });

    if (!searchEntries || searchEntries.length === 0) {
      return { ok: false, grupos: [], nome: null, erro: 'Usuário não encontrado no AD' };
    }

    const userEntry = searchEntries[0];
    const userDN = userEntry.dn;
    const nome = userEntry.displayName || userEntry.cn || usuario;

    // 3. Autenticar com as credenciais do usuário
    await client.bind(userDN, senha);

    // 4. Extrair grupos DF_* do usuário
    const memberOf = userEntry.memberOf || [];
    const grupos = (Array.isArray(memberOf) ? memberOf : [memberOf])
      .map(g => {
        const match = g.match(/CN=([^,]+)/i);
        return match ? match[1] : null;
      })
      .filter(g => g && g.startsWith(prefix));

    return { ok: true, grupos, nome };
  } catch (e) {
    if (e.code === 49) {
      return { ok: false, grupos: [], nome: null, erro: 'Usuário ou senha incorretos' };
    }
    throw e;
  } finally {
    try { await client.unbind(); } catch (e) {}
  }
}

/**
 * Busca os painéis permitidos para um usuário de acordo com sua associação local na tabela DF_GRUPO_USUARIOS
 */
async function buscarPaineisPermitidos(usuario) {
  // admin local sempre tem acesso total
  if (usuario.toLowerCase() === 'admin') {
    return TODOS_PAINEIS;
  }

  try {
    // 1. Verificar se o usuário está em algum grupo ativo que possui a permissão
    const rows = await db.execute(
      `SELECT DISTINCT p.PM_PAINEL
       FROM DF_PERMISSOES p
       JOIN DF_GRUPOS g ON g.GR_ID = p.PM_GRUPO_ID
       JOIN DF_GRUPO_USUARIOS gu ON gu.GU_GRUPO_ID = g.GR_ID
       WHERE UPPER(gu.GU_USUARIO) = UPPER(:usuario)
         AND g.GR_ATIVO = 'S'`,
      { usuario }
    );

    // Se o usuário estiver no grupo 'Admin' local, ele também tem acesso total
    const isAdminGroup = await db.execute(
      `SELECT 1 FROM DF_GRUPO_USUARIOS gu
       JOIN DF_GRUPOS g ON g.GR_ID = gu.GU_GRUPO_ID
       WHERE UPPER(gu.GU_USUARIO) = UPPER(:usuario)
         AND g.GR_NOME = 'Admin'
         AND g.GR_ATIVO = 'S'`,
      { usuario }
    );

    if (isAdminGroup.length > 0) {
      return TODOS_PAINEIS;
    }

    return rows.map(r => r.PM_PAINEL);
  } catch (e) {
    console.error('[auth] Erro ao buscar permissões do usuário:', e.message);
    return [];
  }
}

/**
 * Função principal de autenticação.
 * Escolhe entre hardcoded (teste) ou LDAP (produção) automaticamente.
 */
async function autenticar(usuario, senha) {
  const ldapEnabled = process.env.LDAP_ENABLED === 'true';

  let resultado;
  if (ldapEnabled) {
    resultado = await autenticarLDAP(usuario, senha);
  } else {
    resultado = await autenticarHardcoded(usuario, senha);
  }

  if (!resultado.ok) {
    return { ok: false, erro: resultado.erro || 'Usuário ou senha incorretos', paineis: [] };
  }

  const paineis = await buscarPaineisPermitidos(usuario);

  // Verificar se o usuário pertence ao grupo Admin local
  let isAdmin = false;
  try {
    const adminCheck = await db.execute(
      `SELECT 1 FROM DF_GRUPO_USUARIOS gu
       JOIN DF_GRUPOS g ON g.GR_ID = gu.GU_GRUPO_ID
       WHERE UPPER(gu.GU_USUARIO) = UPPER(:usuario)
         AND g.GR_NOME = 'Admin'
         AND g.GR_ATIVO = 'S'`,
      { usuario }
    );
    if (adminCheck.length > 0 || usuario.toLowerCase() === 'admin') {
      isAdmin = true;
    }
  } catch(e) {}

  return {
    ok: true,
    usuario,
    nome: resultado.nome || usuario,
    paineis,
    isAdmin
  };
}

/**
 * Registra acesso no log do Oracle
 */
async function registrarLog(usuario, nome, acao, painel, ip) {
  try {
    await db.execute(
      `INSERT INTO DF_LOG_ACESSO (LA_USUARIO, LA_NOME, LA_ACAO, LA_PAINEL, LA_IP)
       VALUES (:usuario, :nome, :acao, :painel, :ip)`,
      { usuario, nome: nome || usuario, acao, painel: painel || null, ip: ip || null },
      { autoCommit: true }
    );
  } catch (e) {
    // Log silencioso — não deve quebrar o fluxo principal
    console.error('[auth] Erro ao registrar log:', e.message);
  }
}

module.exports = { autenticar, buscarPaineisPermitidos, registrarLog, TODOS_PAINEIS };

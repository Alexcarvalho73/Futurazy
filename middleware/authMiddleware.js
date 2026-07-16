/**
 * Middleware de Autenticação - FuturazyBI
 * 
 * Protege rotas e páginas verificando se há sessão ativa.
 */

/**
 * Verifica se a requisição é para uma API (retorna JSON 401)
 * ou para uma página HTML (redireciona para login).
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.usuario) {
    return next();
  }

  // APIs retornam 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Não autenticado. Faça login para continuar.' });
  }

  // Páginas HTML redirecionam para login
  return res.redirect('/login.html');
}

/**
 * Verifica se o usuário é Admin
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.usuario && req.session.isAdmin) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ success: false, error: 'Acesso negado. Necessário privilégio de administrador.' });
  }
  return res.status(403).send('<h1>403 - Acesso Negado</h1><p>Você não tem permissão para acessar esta área.</p>');
}

/**
 * Verifica se o usuário tem permissão para um painel específico
 */
function requirePainel(painel) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Não autenticado.' });
      }
      return res.redirect('/login.html');
    }

    if (req.session.isAdmin || (req.session.paineis && req.session.paineis.includes(painel))) {
      return next();
    }

    return res.status(403).json({ success: false, error: `Sem permissão para acessar o painel: ${painel}` });
  };
}

module.exports = { requireAuth, requireAdmin, requirePainel };

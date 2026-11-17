const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { pode } = require('../utils/permissoes');

// Valida o token e carrega o usuário do banco a cada requisição: bloquear um usuário ou trocar
// o perfil vale na hora, sem esperar o token expirar. Define req.user =
// { id, nome, email, role, status, empresa_id, empresa_nome, corretor_id }.
const authMiddleware = async (req, res, next) => {
  let decoded;
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.email, u.role, u.status, u.empresa_id, u.corretor_id,
              e.nome AS empresa_nome, e.ativa AS empresa_ativa, co.status AS corretor_status
       FROM usuarios u
       JOIN empresas e ON e.id = u.empresa_id
       LEFT JOIN corretores co ON co.id = u.corretor_id
       WHERE u.id = $1`,
      [decoded.id]
    );
    const user = result.rows[0];
    // Corretor com cadastro inativo perde o acesso na hora (spec 001/RN-21)
    const corretorInativo = user?.role === 'corretor' && user.corretor_status === 'inativo';
    if (!user || user.status !== 'ativo' || !user.role || !user.empresa_ativa || corretorInativo) {
      return res.status(401).json({ error: 'Acesso não autorizado' });
    }
    req.user = user;
    // Compatibilidade com código antigo
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (error) {
    console.error('Erro ao validar usuário:', error);
    res.status(500).json({ error: 'Erro ao validar usuário' });
  }
};

// Exige a permissão (ver utils/permissoes.js) para seguir
const permitir = (permissao) => (req, res, next) =>
  pode(req.user?.role, permissao) ? next() : res.status(403).json({ error: 'Sem permissão para esta ação' });

module.exports = authMiddleware;
module.exports.permitir = permitir;

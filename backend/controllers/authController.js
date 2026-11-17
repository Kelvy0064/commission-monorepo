const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const CREDENCIAIS_INVALIDAS = 'Email ou senha inválidos';
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENHA_MINIMA = 8;

const publicUser = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  role: u.role,
  empresa: { id: u.empresa_id, nome: u.empresa_nome },
  corretor_id: u.corretor_id,
});

const SELECT_USUARIO = `
  SELECT u.*, e.nome AS empresa_nome, e.ativa AS empresa_ativa, co.status AS corretor_status
  FROM usuarios u
  JOIN empresas e ON e.id = u.empresa_id
  LEFT JOIN corretores co ON co.id = u.corretor_id`;

const corretorInativo = (u) => u.role === 'corretor' && u.corretor_status === 'inativo';

const authController = {
  // POST /auth/login { email, senha } → { token, user }
  async login(req, res) {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const senha = String(req.body.senha || '');

      if (!email || !senha) {
        return res.status(400).json({ error: 'Informe email e senha' });
      }

      if (!process.env.JWT_SECRET) {
        console.error('❌ JWT_SECRET não configurado — login indisponível');
        return res.status(500).json({ error: 'Autenticação não configurada no servidor' });
      }

      const result = await pool.query(`${SELECT_USUARIO} WHERE LOWER(u.email) = $1`, [email]);
      const user = result.rows[0];

      // Mesma resposta para email inexistente e senha errada
      const senhaOk = user ? await bcrypt.compare(senha, user.senha_hash) : false;
      if (!senhaOk) {
        return res.status(401).json({ error: CREDENCIAIS_INVALIDAS });
      }

      // Situação da conta só é revelada para quem acertou a senha
      if (user.status === 'pendente') {
        return res.status(403).json({ error: 'Seu cadastro está aguardando aprovação do administrador da empresa' });
      }
      // Corretor com cadastro inativo perde o acesso (spec 001/RN-21); os repasses dele seguem com o Gestor
      if (user.status === 'bloqueado' || !user.role || !user.empresa_ativa || corretorInativo(user)) {
        return res.status(403).json({ error: 'Acesso bloqueado. Fale com o administrador da empresa' });
      }

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.json({ token, user: publicUser(user) });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: 'Erro ao fazer login' });
    }
  },

  // POST /auth/registrar { nome, email, senha, codigo_empresa } — auto-cadastro (público).
  // A conta nasce pendente; um Administrador/Gestor da empresa aprova e define o perfil.
  async registrar(req, res) {
    try {
      const nome = String(req.body.nome || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const senha = String(req.body.senha || '');
      const codigo = String(req.body.codigo_empresa || '').trim().toUpperCase();

      if (!nome) return res.status(400).json({ error: 'Informe seu nome' });
      if (!EMAIL_VALIDO.test(email)) return res.status(400).json({ error: 'Email inválido' });
      if (senha.length < SENHA_MINIMA) {
        return res.status(400).json({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres` });
      }
      if (!codigo) return res.status(400).json({ error: 'Informe o código da empresa' });

      const empresa = await pool.query('SELECT id FROM empresas WHERE codigo = $1 AND ativa', [codigo]);
      if (empresa.rows.length === 0) {
        return res.status(400).json({ error: 'Código de empresa inválido' });
      }

      const hash = await bcrypt.hash(senha, 10);
      await pool.query(
        `INSERT INTO usuarios (nome, email, senha_hash, role, status, empresa_id)
         VALUES ($1, $2, $3, NULL, 'pendente', $4)`,
        [nome, email, hash, empresa.rows[0].id]
      );

      res.status(201).json({
        message: 'Cadastro enviado! Você poderá entrar assim que o administrador da empresa aprovar.',
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Já existe um cadastro com este email' });
      }
      console.error('Erro no cadastro:', error);
      res.status(500).json({ error: 'Erro ao criar cadastro' });
    }
  },

  // GET /auth/me → usuário logado (o middleware já validou status e empresa)
  async me(req, res) {
    res.json(publicUser(req.user));
  },
};

module.exports = authController;

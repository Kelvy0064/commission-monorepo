const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const CREDENCIAIS_INVALIDAS = 'Email ou senha inválidos';

const publicUser = (user) => ({ id: user.id, nome: user.nome, email: user.email, role: user.role });

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

      const result = await pool.query('SELECT * FROM usuarios WHERE LOWER(email) = $1', [email]);
      const user = result.rows[0];

      // Mesma resposta para email inexistente e senha errada
      const senhaOk = user ? await bcrypt.compare(senha, user.senha_hash) : false;
      if (!senhaOk) {
        return res.status(401).json({ error: CREDENCIAIS_INVALIDAS });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.json({ token, user: publicUser(user) });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: 'Erro ao fazer login' });
    }
  },

  // GET /auth/me → usuário do token
  async me(req, res) {
    try {
      const result = await pool.query('SELECT * FROM usuarios WHERE id = $1', [req.userId]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Usuário não encontrado' });
      }
      res.json(publicUser(result.rows[0]));
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      res.status(500).json({ error: 'Erro ao buscar usuário' });
    }
  },
};

module.exports = authController;

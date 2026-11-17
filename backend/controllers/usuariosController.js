const pool = require('../config/database');
const { PERFIS, PERFIS_DO_GESTOR } = require('../utils/permissoes');

const STATUS = ['pendente', 'ativo', 'bloqueado'];

const usuariosController = {
  // GET /usuarios — usuários da empresa (pendentes primeiro). Para pendentes, sugere o cadastro de
  // corretor com o mesmo email que ainda não está vinculado a ninguém.
  async index(req, res) {
    try {
      const result = await pool.query(
        `SELECT u.id, u.nome, u.email, u.role, u.status, u.corretor_id, u.created_at,
                co.nome AS corretor_nome,
                (SELECT c2.id FROM corretores c2
                 WHERE c2.empresa_id = u.empresa_id AND LOWER(c2.email) = LOWER(u.email)
                   AND NOT EXISTS (SELECT 1 FROM usuarios u2 WHERE u2.corretor_id = c2.id)
                 LIMIT 1) AS corretor_sugerido_id
         FROM usuarios u
         LEFT JOIN corretores co ON co.id = u.corretor_id
         WHERE u.empresa_id = $1
         ORDER BY (u.status = 'pendente') DESC, u.nome`,
        [req.user.empresa_id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  },

  // PUT /usuarios/:id { role, status, corretor_id } — aprovar, mudar perfil, bloquear/desbloquear
  async update(req, res) {
    try {
      const alvo = await pool.query('SELECT * FROM usuarios WHERE id = $1 AND empresa_id = $2', [
        req.params.id,
        req.user.empresa_id,
      ]);
      const usuario = alvo.rows[0];
      if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

      if (usuario.id === req.user.id) {
        return res.status(400).json({ error: 'Você não pode alterar o próprio perfil ou status' });
      }

      const role = req.body.role || null;
      const status = req.body.status || usuario.status;
      if (role && !PERFIS[role]) return res.status(400).json({ error: 'Perfil inválido' });
      if (!STATUS.includes(status)) return res.status(400).json({ error: 'Status inválido' });

      // Gestor só gerencia (aprova, muda perfil, bloqueia) usuários Corretor e Pós-venda (spec 001/RN-19)
      if (req.user.role !== 'admin') {
        const alvoGerenciavel = usuario.role === null || PERFIS_DO_GESTOR.includes(usuario.role);
        const perfilPermitido = role === null || PERFIS_DO_GESTOR.includes(role);
        if (!alvoGerenciavel || !perfilPermitido) {
          return res.status(403).json({ error: 'O Gestor gerencia apenas usuários Corretor e Pós-venda' });
        }
      }

      if (status === 'ativo' && !role) {
        return res.status(400).json({ error: 'Escolha o perfil para ativar o usuário' });
      }
      if (status === 'pendente') {
        return res.status(400).json({ error: 'Use ativo ou bloqueado' });
      }

      // Corretor precisa estar ligado a um cadastro de corretor da mesma empresa
      let corretorId = null;
      if (role === 'corretor') {
        corretorId = Number(req.body.corretor_id) || null;
        if (!corretorId) return res.status(400).json({ error: 'Escolha o cadastro de corretor deste usuário' });
        const corretor = await pool.query('SELECT id FROM corretores WHERE id = $1 AND empresa_id = $2', [
          corretorId,
          req.user.empresa_id,
        ]);
        if (corretor.rows.length === 0) return res.status(400).json({ error: 'Corretor não encontrado' });
      }

      const result = await pool.query(
        `UPDATE usuarios SET role = $1, status = $2, corretor_id = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, nome, email, role, status, corretor_id`,
        [role, status, corretorId, usuario.id]
      );
      res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Este corretor já está vinculado a outro usuário' });
      }
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  },

  // DELETE /usuarios/:id — só para recusar cadastros pendentes (os demais são bloqueados)
  async delete(req, res) {
    try {
      const result = await pool.query(
        `DELETE FROM usuarios WHERE id = $1 AND empresa_id = $2 AND status = 'pendente' RETURNING id`,
        [req.params.id, req.user.empresa_id]
      );
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Só cadastros pendentes podem ser recusados. Para tirar o acesso, bloqueie o usuário.' });
      }
      res.json({ message: 'Cadastro recusado' });
    } catch (error) {
      console.error('Erro ao recusar cadastro:', error);
      res.status(500).json({ error: 'Erro ao recusar cadastro' });
    }
  },
};

module.exports = usuariosController;

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserCheck } from 'lucide-react';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';
import Modal from '../../components/common/Modal/Modal';
import Spinner from '../../components/common/Spinner/Spinner';
import { usuariosService } from '../../api/services/usuarios.service';
import { corretoresService } from '../../api/services/corretores.service';
import { useAuth } from '../../context/AuthContext';
import { PERFIS, PERFIS_DO_GESTOR } from '../../auth/permissoes';
import { formatDate } from '../../utils/formatters';

const STATUS_BADGE = {
  pendente: 'bg-amber-100 text-amber-800',
  ativo: 'bg-green-100 text-green-700',
  bloqueado: 'bg-gray-200 text-gray-700',
};
const STATUS_LABEL = { pendente: 'Aguardando aprovação', ativo: 'Ativo', bloqueado: 'Bloqueado' };
const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm';

// Aprovar / alterar perfil / bloquear um usuário
const UsuarioForm = ({ usuario, corretores, usuarios, souAdmin, onSubmit, onCancel, saving }) => {
  const [role, setRole] = useState(usuario.role || '');
  const [status, setStatus] = useState(usuario.status === 'pendente' ? 'ativo' : usuario.status);
  const [corretorId, setCorretorId] = useState(String(usuario.corretor_id ?? usuario.corretor_sugerido_id ?? ''));
  const [error, setError] = useState(null);

  // Corretores livres (sem usuário) + o atual deste usuário
  const vinculados = new Set(usuarios.filter((u) => u.corretor_id && u.id !== usuario.id).map((u) => u.corretor_id));
  const livres = corretores.filter((c) => !vinculados.has(c.id));
  // Gestor só atribui Corretor e Pós-venda (a API garante a regra)
  const perfis = Object.entries(PERFIS).filter(([id]) => souAdmin || PERFIS_DO_GESTOR.includes(id));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (status === 'ativo' && !role) return setError('Escolha o perfil');
    if (role === 'corretor' && !corretorId) return setError('Escolha qual cadastro de corretor é deste usuário');
    setError(null);
    onSubmit({ role: role || null, status, corretor_id: role === 'corretor' ? Number(corretorId) : null });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-sm text-gray-600">
        <p className="font-semibold text-gray-800">{usuario.nome}</p>
        <p>{usuario.email}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="usr-perfil">
          Perfil
        </label>
        <select id="usr-perfil" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} disabled={saving}>
          <option value="">Selecione...</option>
          {perfis.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {role === 'corretor' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="usr-corretor">
            Cadastro de corretor deste usuário
          </label>
          <select id="usr-corretor" value={corretorId} onChange={(e) => setCorretorId(e.target.value)} className={inputClass} disabled={saving}>
            <option value="">Selecione...</option>
            {livres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {String(c.id) === String(usuario.corretor_sugerido_id) ? ' (mesmo email — sugerido)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            O corretor verá só os próprios clientes, negociações, apólices e repasses. Se ele ainda não tem cadastro,
            crie em Corretores antes de aprovar.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="usr-status">
          Acesso
        </label>
        <select id="usr-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass} disabled={saving}>
          <option value="ativo">Ativo — pode entrar</option>
          <option value="bloqueado">Bloqueado — não entra</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" className="flex-1" loading={saving} disabled={saving}>
          {usuario.status === 'pendente' ? 'Aprovar' : 'Salvar'}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

const Usuarios = () => {
  const { user, pode } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [corretores, setCorretores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState(null);
  const [alert, setAlert] = useState(null);
  const souAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, opcoes] = await Promise.all([usuariosService.getAll(), corretoresService.getOpcoes()]);
      setUsuarios(lista);
      setCorretores(opcoes);
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Erro ao carregar usuários' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (type, message) => {
    setAlert({ type, message });
    if (type === 'success') setTimeout(() => setAlert(null), 3000);
  };

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      await usuariosService.update(editando.id, data);
      flash('success', editando.status === 'pendente' ? `${editando.nome} aprovado(a)` : 'Usuário atualizado');
      setEditando(null);
      await load();
    } catch (err) {
      flash('error', err.message || 'Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleRecusar = async (usuario) => {
    if (!window.confirm(`Recusar o cadastro de ${usuario.nome}? A solicitação será apagada.`)) return;
    try {
      await usuariosService.recusar(usuario.id);
      flash('success', 'Cadastro recusado');
      await load();
    } catch (err) {
      flash('error', err.message || 'Erro ao recusar cadastro');
    }
  };

  // Gestor só gerencia pendentes, corretores e pós-venda; ninguém edita a si mesmo
  const podeEditar = (u) => u.id !== user?.id && (souAdmin || !u.role || PERFIS_DO_GESTOR.includes(u.role));
  const pendentes = usuarios.filter((u) => u.status === 'pendente').length;

  if (!pode('usuarios.gerenciar')) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Usuários</h1>
          <p className="text-gray-600">
            Acessos da {user?.empresa?.nome}. Novos usuários se cadastram em "Criar conta" na tela de login, com o código
            da empresa, e aparecem aqui para aprovação.
          </p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading} loading={loading}>
          Atualizar
        </Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {pendentes > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {pendentes} cadastro(s) aguardando aprovação.
        </div>
      )}

      <Card>
        {loading && usuarios.length === 0 ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Nome', 'Email', 'Perfil', 'Corretor vinculado', 'Situação', 'Cadastro', 'Ações'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.status === 'pendente' ? 'bg-amber-50/50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {u.nome}
                      {u.id === user?.id && <span className="ml-1 text-xs text-gray-500">(você)</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{PERFIS[u.role] || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.corretor_nome || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[u.status]}`}>
                        {STATUS_LABEL[u.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {podeEditar(u) && (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditando(u)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium mr-3"
                          >
                            {u.status === 'pendente' && <UserCheck className="w-4 h-4" />}
                            {u.status === 'pendente' ? 'Aprovar' : 'Editar'}
                          </button>
                          {u.status === 'pendente' && (
                            <button
                              type="button"
                              onClick={() => handleRecusar(u)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Recusar
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={Boolean(editando)}
        onClose={() => setEditando(null)}
        title={editando?.status === 'pendente' ? 'Aprovar cadastro' : 'Editar usuário'}
        size="sm"
      >
        {editando && (
          <UsuarioForm
            key={editando.id}
            usuario={editando}
            corretores={corretores}
            usuarios={usuarios}
            souAdmin={souAdmin}
            onSubmit={handleSubmit}
            onCancel={() => setEditando(null)}
            saving={saving}
          />
        )}
      </Modal>
    </div>
  );
};

export default Usuarios;

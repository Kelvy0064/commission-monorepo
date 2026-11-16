import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, UserPlus } from 'lucide-react';
import apiClient from '../../api/client';
import Button from '../../components/common/Button/Button';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const SENHA_MINIMA = 8;

// Auto-cadastro: a conta fica pendente até um Administrador/Gestor da empresa aprovar
const Cadastro = () => {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmar: '', codigo_empresa: '' });
  const [error, setError] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.senha.length < SENHA_MINIMA) return setError(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres`);
    if (form.senha !== form.confirmar) return setError('As senhas não conferem');

    setError(null);
    setLoading(true);
    try {
      const { message } = await apiClient.post('/auth/registrar', {
        nome: form.nome.trim(),
        email: form.email.trim(),
        senha: form.senha,
        codigo_empresa: form.codigo_empresa.trim(),
      });
      setEnviado(message);
    } catch (err) {
      setError(err.message || 'Não foi possível enviar o cadastro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-800">Criar conta</h1>

        {enviado ? (
          <div className="mt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-gray-700">{enviado}</p>
            <Link to="/login" className="inline-block mt-6 font-medium text-blue-700 hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">
              Depois de enviar, o administrador da sua empresa aprova o acesso e define o seu perfil.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="cad-nome" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome completo
                </label>
                <input id="cad-nome" type="text" autoComplete="name" value={form.nome}
                  onChange={(e) => set('nome', e.target.value)} className={inputClass} required disabled={loading} />
              </div>

              <div>
                <label htmlFor="cad-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input id="cad-email" type="email" autoComplete="email" value={form.email}
                  onChange={(e) => set('email', e.target.value)} className={inputClass} required disabled={loading} />
              </div>

              <div>
                <label htmlFor="cad-senha" className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <input id="cad-senha" type="password" autoComplete="new-password" value={form.senha}
                  onChange={(e) => set('senha', e.target.value)} className={inputClass} required minLength={SENHA_MINIMA}
                  disabled={loading} />
                <p className="text-xs text-gray-500 mt-1">Mínimo de {SENHA_MINIMA} caracteres</p>
              </div>

              <div>
                <label htmlFor="cad-confirmar" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar senha
                </label>
                <input id="cad-confirmar" type="password" autoComplete="new-password" value={form.confirmar}
                  onChange={(e) => set('confirmar', e.target.value)} className={inputClass} required disabled={loading} />
              </div>

              <div>
                <label htmlFor="cad-empresa" className="block text-sm font-medium text-gray-700 mb-1">
                  Código da empresa
                </label>
                <input id="cad-empresa" type="text" autoComplete="off" value={form.codigo_empresa}
                  onChange={(e) => set('codigo_empresa', e.target.value.toUpperCase())} placeholder="Ex.: NEVITTA"
                  className={`${inputClass} uppercase`} required disabled={loading} />
                <p className="text-xs text-gray-500 mt-1">Peça o código ao administrador da sua empresa</p>
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" className="w-full" icon={UserPlus} loading={loading} disabled={loading}>
                Enviar cadastro
              </Button>
            </form>

            <p className="text-sm text-gray-600 text-center mt-6">
              Já tem conta?{' '}
              <Link to="/login" className="font-medium text-blue-700 hover:underline">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Cadastro;

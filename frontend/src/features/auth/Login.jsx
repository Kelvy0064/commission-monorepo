import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button/Button';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), senha);
    } catch (err) {
      setError(err.message || 'Não foi possível entrar');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-2xl font-bold text-gray-800">ComissõesPro</h1>
        <p className="text-gray-500 text-sm mb-6">Entre para acessar o sistema</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={inputClass}
              required
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full py-2" icon={LogIn} loading={loading} disabled={loading}>
            Entrar
          </Button>
        </form>

        <p className="text-sm text-gray-600 text-center mt-6">
          Ainda não tem acesso?{' '}
          <Link to="/cadastro" className="font-medium text-blue-700 hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

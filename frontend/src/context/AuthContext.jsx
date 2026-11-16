import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import apiClient from '../api/client';
import { TOKEN_KEY } from '../api/config';
import { pode } from '../auth/permissoes';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sem acesso ao armazenamento: a sessão dura só enquanto a página estiver aberta
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // Enquanto valida um token salvo, não mostra nem o login nem o sistema
  const [checking, setChecking] = useState(() => Boolean(readToken()));

  useEffect(() => {
    if (!readToken()) return;
    apiClient
      .get('/auth/me')
      .then(setUser)
      .catch(() => writeToken(null))
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email, senha) => {
    const { token, user: loggedUser } = await apiClient.post('/auth/login', { email, senha });
    writeToken(token);
    setUser(loggedUser);
  }, []);

  const logout = useCallback(() => {
    writeToken(null);
    setUser(null);
  }, []);

  // pode('clientes.editar') → o perfil do usuário logado tem essa permissão?
  const podeFazer = useCallback((permissao) => pode(user?.role, permissao), [user]);

  return (
    <AuthContext.Provider value={{ user, checking, login, logout, pode: podeFazer }}>{children}</AuthContext.Provider>
  );
};

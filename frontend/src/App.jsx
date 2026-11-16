import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './layouts/MainLayout/MainLayout';
import AppRoutes from './routes';
import Login from './features/auth/Login';
import Cadastro from './features/auth/Cadastro';
import Spinner from './components/common/Spinner/Spinner';

// Sem login: só a tela de login. Com login: o sistema (dados só carregam depois de autenticar).
const AppShell = () => {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <DataProvider>
      <MainLayout>
        {/* /login e rotas sem permissão redirecionam para a primeira página permitida */}
        <AppRoutes />
      </MainLayout>
    </DataProvider>
  );
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;

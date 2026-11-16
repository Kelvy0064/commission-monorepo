import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner/Spinner';
import { useAuth } from '../context/AuthContext';

// Lazy loading das páginas
const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Corretores = lazy(() => import('../features/corretores/Corretores'));
const Seguradoras = lazy(() => import('../features/seguradoras/Seguradoras'));
const Clientes = lazy(() => import('../features/clientes/Clientes'));
const Negociacoes = lazy(() => import('../features/negociacoes/Negociacoes'));
const Apolices = lazy(() => import('../features/apolices/Apolices'));
const Comissoes = lazy(() => import('../features/comissoes/Comissoes'));
const Repasses = lazy(() => import('../features/repasses/Repasses'));
const Usuarios = lazy(() => import('../features/usuarios/Usuarios'));

// Páginas e a permissão que cada uma exige (ordem = prioridade da página inicial)
export const PAGINAS = [
  { path: '/dashboard', element: <Dashboard />, permissao: 'dashboard.ver' },
  { path: '/negociacoes', element: <Negociacoes />, permissao: 'negociacoes.ver' },
  { path: '/clientes', element: <Clientes />, permissao: 'clientes.ver' },
  { path: '/apolices', element: <Apolices />, permissao: 'apolices.ver' },
  { path: '/corretores', element: <Corretores />, permissao: 'corretores.ver' },
  { path: '/seguradoras', element: <Seguradoras />, permissao: 'seguradoras.ver' },
  { path: '/comissoes', element: <Comissoes />, permissao: 'comissoes.ver' },
  { path: '/repasses', element: <Repasses />, permissao: 'repasses.ver' },
  { path: '/usuarios', element: <Usuarios />, permissao: 'usuarios.gerenciar' },
];

const AppRoutes = () => {
  const { pode } = useAuth();
  const permitidas = PAGINAS.filter((p) => pode(p.permissao));
  const inicial = permitidas[0]?.path || '/negociacoes';

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {permitidas.map((p) => (
          <Route key={p.path} path={p.path} element={p.element} />
        ))}
        {/* Raiz, /login e páginas sem permissão levam à primeira página permitida */}
        <Route path="*" element={<Navigate to={inicial} replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Spinner from '../components/common/Spinner/Spinner';

// Lazy loading das páginas
const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Corretores = lazy(() => import('../features/corretores/Corretores'));
const Seguradoras = lazy(() => import('../features/seguradoras/Seguradoras'));
const Clientes = lazy(() => import('../features/clientes/Clientes'));
const Apolices = lazy(() => import('../features/apolices/Apolices'));
const Comissoes = lazy(() => import('../features/comissoes/Comissoes'));
const Repasses = lazy(() => import('../features/repasses/Repasses'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/corretores" element={<Corretores />} />
        <Route path="/seguradoras" element={<Seguradoras />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/apolices" element={<Apolices />} />
        <Route path="/comissoes" element={<Comissoes />} />
        <Route path="/repasses" element={<Repasses />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

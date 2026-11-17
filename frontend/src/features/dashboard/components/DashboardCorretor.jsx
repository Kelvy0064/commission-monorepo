import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, CheckCircle, KanbanSquare, RefreshCw, Wallet } from 'lucide-react';
import KPICard from './KPICard';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import Spinner from '../../../components/common/Spinner/Spinner';
import { dashboardService } from '../../../api/services/dashboard.service';
import { formatCurrency } from '../../../utils/formatters';

// Painel do corretor: só os próprios números (negociações e repasses)
const DashboardCorretor = () => {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDados(await dashboardService.getKPIs());
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar o painel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !dados) return <Spinner />;

  const neg = dados?.negociacoes || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Meu painel</h1>
          <p className="text-gray-600">Suas negociações e repasses</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading} loading={loading}>
          Atualizar
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KPICard icon={KanbanSquare} title="Negociações" value={neg.em_andamento || 0} subtitle="Em andamento" color="blue" />
        <KPICard
          icon={AlertTriangle}
          title="Atenção"
          value={neg.atrasadas || 0}
          subtitle={`atrasada(s) · ${neg.sem_proxima_acao || 0} sem próxima ação`}
          color="orange"
        />
        <KPICard icon={CheckCircle} title="Vendidas" value={neg.vendidas || 0} subtitle="Negociações fechadas" color="green" />
        <KPICard
          icon={ArrowRightLeft}
          title="Repasses"
          value={formatCurrency(dados?.repasses_pendentes || 0)}
          subtitle={`a receber · ${formatCurrency(dados?.repasses_pagos || 0)} já pagos`}
          color="purple"
        />
      </div>

      {Number(dados?.saldo_pendente) > 0 && (
        <div className="mb-6 max-w-sm">
          <KPICard
            icon={Wallet}
            title="Saldo pendente"
            value={formatCurrency(dados.saldo_pendente)}
            subtitle="de estornos — descontado dos próximos repasses"
            color="orange"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to="/negociacoes" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">
          Abrir minhas negociações
        </Link>
        <Link to="/repasses" className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300">
          Ver meus repasses
        </Link>
      </div>
    </div>
  );
};

export default DashboardCorretor;

import React, { useState } from 'react';
import { Calendar, CheckCircle, ArrowRightLeft, FileText, RefreshCw } from 'lucide-react';
import { useDashboard } from './hooks/useDashboard';
import KPICard from './components/KPICard';
import ProximasComissoes from './components/ProximasComissoes';
import AcoesRapidas from './components/AcoesRapidas';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Spinner from '../../components/common/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatters';
import { comissoesService } from '../../api/services/comissoes.service';
import { repassesService } from '../../api/services/repasses.service';
import { useAuth } from '../../context/AuthContext';
import DashboardCorretor from './components/DashboardCorretor';

// Dashboard da empresa (Administrador e Gestor)
const DashboardEmpresa = () => {
  const { kpis, proximasComissoes, loading, error, refresh } = useDashboard();
  const [alert, setAlert] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleMarcarRecebida = async (id) => {
    setActionLoading(true);
    try {
      await comissoesService.marcarRecebida(id, {
        data_recebimento: new Date().toISOString().split('T')[0],
      });
      await refresh();
      setAlert({ type: 'success', message: 'Comissão marcada como recebida!' });
      setTimeout(() => setAlert(null), 3000);
    } catch (err) {
      setAlert({ type: 'error', message: 'Erro ao marcar comissão' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGerarRepasses = async () => {
    setActionLoading(true);
    try {
      const result = await repassesService.gerar();
      setAlert({
        type: 'success',
        message: `${result.repasses_gerados || 0} repasses gerados com sucesso!`,
      });
      setTimeout(() => setAlert(null), 3000);
    } catch (err) {
      setAlert({ type: 'error', message: 'Erro ao gerar repasses' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !kpis) {
    return <Spinner />;
  }

  const percentualRecebido = kpis && kpis.totalPrevisto > 0
    ? Math.round((kpis.totalRecebido / kpis.totalPrevisto) * 100)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-gray-600">Visão geral do sistema de comissões</p>
        </div>
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={refresh}
          disabled={loading}
          loading={loading}
        >
          Atualizar
        </Button>
      </div>

      {/* Alert */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Error */}
      {error && !alert && (
        <Alert
          type="error"
          message={error}
          onClose={() => setAlert(null)}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KPICard
          icon={Calendar}
          title="Mês Atual"
          value={formatCurrency(kpis?.totalPrevisto || 0)}
          subtitle="Total a Receber"
          color="blue"
        />

        <KPICard
          icon={CheckCircle}
          title="Recebido"
          value={formatCurrency(kpis?.totalRecebido || 0)}
          subtitle={`${percentualRecebido}% do previsto`}
          color="green"
        />

        <KPICard
          icon={ArrowRightLeft}
          title="Repasses"
          value={formatCurrency(kpis?.repassesPendentes || 0)}
          subtitle="Pendentes"
          color="orange"
        />

        <KPICard
          icon={FileText}
          title="Apólices"
          value={kpis?.apolicesAtivas || 0}
          subtitle="Ativas"
          color="purple"
        />
      </div>

      {/* Grid de 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProximasComissoes
          comissoes={proximasComissoes}
          loading={loading}
          onMarcarRecebida={handleMarcarRecebida}
        />

        <AcoesRapidas onGerarRepasses={handleGerarRepasses} />
      </div>

      {/* Dica */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Dica do Sistema</h3>
        <p className="text-blue-800">
          Mantenha suas comissões sempre atualizadas! Marque como recebidas assim que o pagamento for confirmado
          para garantir a precisão do seu fluxo de caixa e facilitar o processamento de repasses.
        </p>
      </div>
    </div>
  );
};

// Corretor vê só os próprios números (a API devolve { tipo: 'corretor', ... })
const Dashboard = () => {
  const { user } = useAuth();
  return user?.role === 'corretor' ? <DashboardCorretor /> : <DashboardEmpresa />;
};

export default Dashboard;
import { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '../../../api/services/dashboard.service';

export const useDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [proximasComissoes, setProximasComissoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getKPIs();
      setKpis({
        totalPrevisto: data.total_previsto || 0,
        totalRecebido: data.total_recebido || 0,
        repassesPendentes: data.repasses_pendentes || 0,
        apolicesAtivas: data.apolices_ativas || 0,
      });
      setProximasComissoes(data.proximas_comissoes || []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    kpis,
    proximasComissoes,
    loading,
    error,
    refresh: loadDashboard,
  };
};
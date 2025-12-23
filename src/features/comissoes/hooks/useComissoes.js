import { useState, useEffect, useCallback } from 'react';
import { comissoesService } from '../../../api/services/comissoes.service';

export const useComissoes = () => {
  const [comissoes, setComissoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: 'all' });

  const loadComissoes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filters.status !== 'all' ? { status: filters.status } : {};
      const data = await comissoesService.getAll(params);
      setComissoes(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar comissões');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const marcarRecebida = useCallback(async (id, dataRecebimento = null) => {
    setLoading(true);
    setError(null);
    try {
      await comissoesService.marcarRecebida(id, {
        data_recebimento: dataRecebimento || new Date().toISOString().split('T')[0],
      });
      await loadComissoes();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao marcar comissão como recebida');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadComissoes]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  useEffect(() => {
    loadComissoes();
  }, [loadComissoes]);

  return {
    comissoes,
    loading,
    error,
    filters,
    marcarRecebida,
    updateFilters,
    refresh: loadComissoes,
  };
};
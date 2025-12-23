import { useState, useEffect, useCallback } from 'react';
import { repassesService } from '../../../api/services/repasses.service';

export const useRepasses = () => {
  const [repasses, setRepasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadRepasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repassesService.getAll();
      setRepasses(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar repasses');
    } finally {
      setLoading(false);
    }
  }, []);

  const gerarRepasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await repassesService.gerar();
      await loadRepasses();
      return { success: true, data: result };
    } catch (err) {
      setError(err.message || 'Erro ao gerar repasses');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadRepasses]);

  const marcarPago = useCallback(async (id, data) => {
    setLoading(true);
    setError(null);
    try {
      await repassesService.marcarPago(id, {
        data_pagamento: data.data_pagamento || new Date().toISOString().split('T')[0],
        forma_pagamento: data.forma_pagamento || 'transferencia',
      });
      await loadRepasses();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao marcar repasse como pago');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadRepasses]);

  useEffect(() => {
    loadRepasses();
  }, [loadRepasses]);

  return {
    repasses,
    loading,
    error,
    gerarRepasses,
    marcarPago,
    refresh: loadRepasses,
  };
};
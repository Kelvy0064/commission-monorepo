import { useState, useEffect, useCallback } from 'react';
import { seguradorasService } from '../../../api/services/seguradoras.service';

export const useSeguradoras = () => {
  const [seguradoras, setSeguradoras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSeguradoras = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await seguradorasService.getAll();
      setSeguradoras(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar seguradoras');
    } finally {
      setLoading(false);
    }
  }, []);

  const createSeguradora = useCallback(async (seguradora) => {
    setLoading(true);
    setError(null);
    try {
      await seguradorasService.create(seguradora);
      await loadSeguradoras();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao criar seguradora');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadSeguradoras]);

  const updateSeguradora = useCallback(async (id, seguradora) => {
    setLoading(true);
    setError(null);
    try {
      await seguradorasService.update(id, seguradora);
      await loadSeguradoras();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao atualizar seguradora');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadSeguradoras]);

  const deleteSeguradora = useCallback(async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta seguradora?')) {
      return { success: false, cancelled: true };
    }

    setLoading(true);
    setError(null);
    try {
      await seguradorasService.delete(id);
      await loadSeguradoras();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao excluir seguradora');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadSeguradoras]);

  useEffect(() => {
    loadSeguradoras();
  }, [loadSeguradoras]);

  return {
    seguradoras,
    loading,
    error,
    createSeguradora,
    updateSeguradora,
    deleteSeguradora,
    refresh: loadSeguradoras,
  };
};
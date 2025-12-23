import { useState, useEffect, useCallback } from 'react';
import { apolicesService } from '../../../api/services/apolices.service';

export const useApolices = () => {
  const [apolices, setApolices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadApolices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apolicesService.getAll();
      setApolices(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar apólices');
    } finally {
      setLoading(false);
    }
  }, []);

  const createApolice = useCallback(async (apolice) => {
    setLoading(true);
    setError(null);
    try {
      await apolicesService.create(apolice);
      await loadApolices();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao criar apólice');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadApolices]);

  const updateApolice = useCallback(async (id, apolice) => {
    setLoading(true);
    setError(null);
    try {
      await apolicesService.update(id, apolice);
      await loadApolices();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao atualizar apólice');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadApolices]);

  const deleteApolice = useCallback(async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta apólice?')) {
      return { success: false, cancelled: true };
    }

    setLoading(true);
    setError(null);
    try {
      await apolicesService.delete(id);
      await loadApolices();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao excluir apólice');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadApolices]);

  useEffect(() => {
    loadApolices();
  }, [loadApolices]);

  return {
    apolices,
    loading,
    error,
    createApolice,
    updateApolice,
    deleteApolice,
    refresh: loadApolices,
  };
};
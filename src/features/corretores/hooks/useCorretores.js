import { useState, useEffect, useCallback } from 'react';
import { corretoresService } from '../../../api/services/corretores.service';

export const useCorretores = () => {
  const [corretores, setCorretores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadCorretores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await corretoresService.getAll();
      setCorretores(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar corretores');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCorretor = useCallback(async (corretor) => {
    setLoading(true);
    setError(null);
    try {
      await corretoresService.create(corretor);
      await loadCorretores();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao criar corretor');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadCorretores]);

  const updateCorretor = useCallback(async (id, corretor) => {
    setLoading(true);
    setError(null);
    try {
      await corretoresService.update(id, corretor);
      await loadCorretores();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao atualizar corretor');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadCorretores]);

  const deleteCorretor = useCallback(async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este corretor?')) {
      return { success: false, cancelled: true };
    }

    setLoading(true);
    setError(null);
    try {
      await corretoresService.delete(id);
      await loadCorretores();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao excluir corretor');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadCorretores]);

  useEffect(() => {
    loadCorretores();
  }, [loadCorretores]);

  return {
    corretores,
    loading,
    error,
    createCorretor,
    updateCorretor,
    deleteCorretor,
    refresh: loadCorretores,
  };
};
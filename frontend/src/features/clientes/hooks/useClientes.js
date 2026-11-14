import { useState, useEffect, useCallback } from 'react';
import { clientesService } from '../../../api/services/clientes.service';

export const useClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadClientes = useCallback(async () => {
    console.log("Passo");
    
    setLoading(true);
    setError(null);
    try {
      const data = await clientesService.getAll();
      setClientes(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  const createCliente = useCallback(async (cliente) => {
    setLoading(true);
    setError(null);
    try {
      await clientesService.create(cliente);
      await loadClientes();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao criar cliente');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadClientes]);

  const updateCliente = useCallback(async (id, cliente) => {
    setLoading(true);
    setError(null);
    try {
      await clientesService.update(id, cliente);
      await loadClientes();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao atualizar cliente');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadClientes]);

  const deleteCliente = useCallback(async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) {
      return { success: false, cancelled: true };
    }

    setLoading(true);
    setError(null);
    try {
      await clientesService.delete(id);
      await loadClientes();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Erro ao excluir cliente');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadClientes]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  return {
    clientes,
    loading,
    error,
    createCliente,
    updateCliente,
    deleteCliente,
    refresh: loadClientes,
  };
};
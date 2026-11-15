import { useState, useEffect, useCallback, useRef } from 'react';
import { clientesService } from '../../../api/services/clientes.service';

export const FILTROS_INICIAIS = { busca: '', status: '', corretor_id: '' };
const SEARCH_DEBOUNCE_MS = 300;

export const useClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Ignora respostas de requisições antigas (ex.: digitação rápida na busca)
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(filtros.busca.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filtros.busca]);

  const loadClientes = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = { page, pageSize };
      if (buscaDebounced) params.busca = buscaDebounced;
      if (filtros.status) params.status = filtros.status;
      if (filtros.corretor_id) params.corretor_id = filtros.corretor_id;

      const result = await clientesService.getAll(params);
      if (currentRequest !== requestId.current) return;

      // Página ficou fora do intervalo (ex.: excluiu o último item da última página)
      if (page > result.totalPages) {
        setPage(result.totalPages);
        return;
      }

      setClientes(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(err.message || 'Erro ao carregar clientes');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, pageSize, buscaDebounced, filtros.status, filtros.corretor_id]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  // Qualquer mudança de filtro volta para a primeira página
  const updateFiltro = useCallback((campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
    setPage(1);
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltros(FILTROS_INICIAIS);
    setBuscaDebounced('');
    setPage(1);
  }, []);

  const changePageSize = useCallback((size) => {
    setPageSize(size);
    setPage(1);
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

  return {
    clientes,
    loading,
    error,
    filtros,
    updateFiltro,
    limparFiltros,
    page,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize: changePageSize,
    createCliente,
    updateCliente,
    deleteCliente,
    refresh: loadClientes,
  };
};

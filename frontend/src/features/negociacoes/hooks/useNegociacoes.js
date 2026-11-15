import { useCallback, useEffect, useRef, useState } from 'react';
import { negociacoesService } from '../../../api/services/negociacoes.service';

export const FILTROS_INICIAIS = { busca: '', status: 'em_andamento', corretor_id: '' };
const SEARCH_DEBOUNCE_MS = 300;

export const useNegociacoes = () => {
  const [negociacoes, setNegociacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(filtros.busca.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filtros.busca]);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (buscaDebounced) params.busca = buscaDebounced;
      if (filtros.status) params.status = filtros.status;
      if (filtros.corretor_id) params.corretor_id = filtros.corretor_id;
      const data = await negociacoesService.getAll(params);
      if (current === requestId.current) setNegociacoes(data);
    } catch (err) {
      if (current === requestId.current) setError(err.message || 'Erro ao carregar negociações');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [buscaDebounced, filtros.status, filtros.corretor_id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFiltro = useCallback((campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltros(FILTROS_INICIAIS);
    setBuscaDebounced('');
  }, []);

  // Arrastar cartão: atualiza a tela na hora e desfaz se a API recusar
  const moverEtapa = useCallback(async (negociacao, etapa) => {
    const { id, etapa: anterior } = negociacao;
    if (anterior === etapa) return { success: true };
    setNegociacoes((prev) => prev.map((n) => (n.id === id ? { ...n, etapa } : n)));
    try {
      await negociacoesService.moverEtapa(id, etapa);
      return { success: true };
    } catch (err) {
      setNegociacoes((prev) => prev.map((n) => (n.id === id ? { ...n, etapa: anterior } : n)));
      return { success: false, error: err.message };
    }
  }, []);

  const save = useCallback(
    async (id, data) => {
      try {
        if (id) await negociacoesService.update(id, data);
        else await negociacoesService.create(data);
        await load();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [load]
  );

  const remove = useCallback(
    async (id) => {
      try {
        await negociacoesService.delete(id);
        await load();
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [load]
  );

  return {
    negociacoes,
    loading,
    error,
    filtros,
    updateFiltro,
    limparFiltros,
    moverEtapa,
    save,
    remove,
    refresh: load,
  };
};

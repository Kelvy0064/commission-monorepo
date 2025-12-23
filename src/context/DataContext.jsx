import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { corretoresService } from '../api/services/corretores.service';
import { seguradorasService } from '../api/services/seguradoras.service';
import { clientesService } from '../api/services/clientes.service';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const [corretores, setCorretores] = useState([]);
  const [seguradoras, setSeguradoras] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carregar dados iniciais
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [corretoresData, seguradorasData, clientesData] = await Promise.all([
        corretoresService.getAll().catch(() => []),
        seguradorasService.getAll().catch(() => []),
        clientesService.getAll().catch(() => []),
      ]);

      setCorretores(corretoresData);
      setSeguradoras(seguradorasData);
      setClientes(clientesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCorretores = useCallback((data) => setCorretores(data), []);
  const updateSeguradoras = useCallback((data) => setSeguradoras(data), []);
  const updateClientes = useCallback((data) => setClientes(data), []);

  const value = {
    corretores,
    seguradoras,
    clientes,
    loading,
    updateCorretores,
    updateSeguradoras,
    updateClientes,
    refresh: loadAllData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
import apiClient from '../client';

const ENDPOINT = '/repasses';

export const repassesService = {
  getAll: (params = {}) => apiClient.get(ENDPOINT, { params }),
  getById: (id) => apiClient.get(`${ENDPOINT}/${id}`),
  gerar: () => apiClient.post(`${ENDPOINT}/gerar`),
  marcarPago: (id, data) => apiClient.put(`${ENDPOINT}/${id}/pago`, data),
  
  // Métodos específicos
  getByStatus: (status) => apiClient.get(ENDPOINT, { params: { status } }),
  getByCorretor: (corretorId) => apiClient.get(ENDPOINT, { params: { corretor_id: corretorId } }),
  getPendentes: () => apiClient.get(ENDPOINT, { params: { status: 'pendente' } }),
  relatorioPorCorretor: (corretorId, dataInicio, dataFim) => 
    apiClient.get(`${ENDPOINT}/relatorio`, { 
      params: { corretor_id: corretorId, data_inicio: dataInicio, data_fim: dataFim } 
    }),
};

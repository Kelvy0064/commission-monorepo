import apiClient from '../client';

const ENDPOINT = '/apolices';

export const apolicesService = {
  getAll: (params = {}) => apiClient.get(ENDPOINT, { params }),
  getById: (id) => apiClient.get(`${ENDPOINT}/${id}`),
  create: (data) => apiClient.post(ENDPOINT, data),
  update: (id, data) => apiClient.put(`${ENDPOINT}/${id}`, data),
  delete: (id) => apiClient.delete(`${ENDPOINT}/${id}`),
  
  // Métodos específicos
  getByCliente: (clienteId) => apiClient.get(`${ENDPOINT}?cliente_id=${clienteId}`),
  getByCorretor: (corretorId) => apiClient.get(`${ENDPOINT}?corretor_id=${corretorId}`),
  getAtivas: () => apiClient.get(`${ENDPOINT}?status=ativa`),
};

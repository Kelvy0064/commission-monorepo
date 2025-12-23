import apiClient from '../client';

const ENDPOINT = '/clientes';

export const clientesService = {
  getAll: (params = {}) => apiClient.get(ENDPOINT, { params }),
  getById: (id) => apiClient.get(`${ENDPOINT}/${id}`),
  create: (data) => apiClient.post(ENDPOINT, data),
  update: (id, data) => apiClient.put(`${ENDPOINT}/${id}`, data),
  delete: (id) => apiClient.delete(`${ENDPOINT}/${id}`),
};

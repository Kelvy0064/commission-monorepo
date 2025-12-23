import apiClient from '../client';

const ENDPOINT = '/seguradoras';

export const seguradorasService = {
  getAll: (params = {}) => apiClient.get(ENDPOINT, { params }),
  getById: (id) => apiClient.get(`${ENDPOINT}/${id}`),
  create: (data) => apiClient.post(ENDPOINT, data),
  update: (id, data) => apiClient.put(`${ENDPOINT}/${id}`, data),
  delete: (id) => apiClient.delete(`${ENDPOINT}/${id}`),
};

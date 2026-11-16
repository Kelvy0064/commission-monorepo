import apiClient from '../client';

const ENDPOINT = '/corretores';

export const corretoresService = {
  getAll: (params) => apiClient.get(ENDPOINT, { params }),
  // Só id/nome/status, liberado para todos os perfis (selects e filtros)
  getOpcoes: () => apiClient.get(`${ENDPOINT}/opcoes`),
  getById: (id) => apiClient.get(`${ENDPOINT}/${id}`),
  create: (data) => apiClient.post(ENDPOINT, data),
  update: (id, data) => apiClient.put(`${ENDPOINT}/${id}`, data),
  delete: (id) => apiClient.delete(`${ENDPOINT}/${id}`),
};
import apiClient from '../client';

const ENDPOINT = '/usuarios';

export const usuariosService = {
  getAll: () => apiClient.get(ENDPOINT),
  // { role, status, corretor_id }
  update: (id, data) => apiClient.put(`${ENDPOINT}/${id}`, data),
  // Só para recusar cadastros pendentes
  recusar: (id) => apiClient.delete(`${ENDPOINT}/${id}`),
};

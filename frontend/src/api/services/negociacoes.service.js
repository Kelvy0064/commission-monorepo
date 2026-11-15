import apiClient from '../client';

const ENDPOINT = '/negociacoes';

export const negociacoesService = {
  getAll: (params = {}) => apiClient.get(ENDPOINT, { params }),
  create: (data) => apiClient.post(ENDPOINT, data),
  update: (id, data) => apiClient.put(`${ENDPOINT}/${id}`, data),
  moverEtapa: (id, etapa) => apiClient.patch(`${ENDPOINT}/${id}/etapa`, { etapa }),
  delete: (id) => apiClient.delete(`${ENDPOINT}/${id}`),
  distribuir: (negociacaoIds, corretorIds) =>
    apiClient.post(`${ENDPOINT}/distribuir`, { negociacao_ids: negociacaoIds, corretor_ids: corretorIds }),
};

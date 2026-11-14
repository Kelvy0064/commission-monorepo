import apiClient from '../client';

const ENDPOINT = '/comissoes';

export const comissoesService = {
  getAll: (params = {}) => apiClient.get(ENDPOINT, { params }),
  getById: (id) => apiClient.get(`${ENDPOINT}/${id}`),
  marcarRecebida: (id, data) => apiClient.put(`${ENDPOINT}/${id}/recebida`, data),
  
  // Métodos específicos
  getByStatus: (status) => apiClient.get(ENDPOINT, { params: { status } }),
  getByCompetencia: (competencia) => apiClient.get(ENDPOINT, { params: { competencia } }),
  getByCorretor: (corretorId) => apiClient.get(ENDPOINT, { params: { corretor_id: corretorId } }),
  getPrevistas: () => apiClient.get(ENDPOINT, { params: { status: 'prevista' } }),
  getAtrasadas: () => apiClient.get(ENDPOINT, { params: { status: 'atrasada' } }),
};

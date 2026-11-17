import apiClient from '../client';

// Estorno (spec 005): aviso de cancelamento, conclusão, dívida com a plataforma, saldos e relatório
export const estornosService = {
  avisarCancelamento: (apoliceId, data) => apiClient.post(`/apolices/${apoliceId}/cancelamento`, data),
  monitoramento: () => apiClient.get('/monitoramento-estorno'),

  getAll: (params = {}) => apiClient.get('/estornos', { params }),
  concluir: (id, data) => apiClient.put(`/estornos/${id}/concluir`, data),
  liquidar: (id, data) => apiClient.put(`/estornos/${id}/liquidar`, data),

  getSaldos: (params = {}) => apiClient.get('/saldos-corretor', { params }),
  acordo: (id, data) => apiClient.put(`/saldos-corretor/${id}/acordo`, data),
  quitar: (id, data) => apiClient.post(`/saldos-corretor/${id}/quitacoes`, data),

  relatorioPlataforma: (competencia) => apiClient.get('/relatorios/plataforma', { params: { competencia } }),
};

import apiClient from '../client';

export const dashboardService = {
  getKPIs: () => apiClient.get('/dashboard'),
  getProximasComissoes: (days = 7) => 
    apiClient.get('/dashboard/proximas-comissoes', { params: { days } }),
};

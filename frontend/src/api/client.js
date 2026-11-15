import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT, TOKEN_KEY } from './config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    let token = null;
    try {
      token = localStorage.getItem(TOKEN_KEY);
    } catch {
      // armazenamento indisponível
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const { response } = error;
    
    // Sessão expirada/inválida: volta para o login (exceto na própria tentativa de login)
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (response?.status === 401 && !isLoginRequest) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        // armazenamento indisponível
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // A API devolve { error: '...' }
    const errorMessage =
      response?.data?.error || response?.data?.message || error.message || 'Erro desconhecido';
    console.error('API Error:', errorMessage);
    
    return Promise.reject({
      status: response?.status,
      message: errorMessage,
      data: response?.data,
    });
  }
);

export default apiClient;
import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from './config';

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
    const token = localStorage.getItem('auth_token');
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
    
    if (response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    
    const errorMessage = response?.data?.message || error.message || 'Erro desconhecido';
    console.error('API Error:', errorMessage);
    
    return Promise.reject({
      status: response?.status,
      message: errorMessage,
      data: response?.data,
    });
  }
);

export default apiClient;
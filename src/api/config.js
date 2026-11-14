export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://commission-backend-production-02e1.up.railway.app/api';

export const API_TIMEOUT = 10000;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

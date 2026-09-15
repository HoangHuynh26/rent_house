import axios from 'axios';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const TIMEOUT_MS = 15000;

// Resolve API base URL from environment (VITE_API_URL) or fallback to '/api'
const rawApiUrl = import.meta.env.VITE_API_URL || '/api';
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    // FormData uploads may take longer
    config.timeout = 60000;
  }
  return config;
});

// Auto-retry logic for failed/timeout requests
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config;

    // Don't retry if no config or already exhausted retries
    if (!config) {
      return Promise.reject(createCustomError(error));
    }

    // Initialize retry counter
    config.__retryCount = config.__retryCount || 0;

    // Determine if we should retry
    const isRetryable =
      !error.response || // Network error / timeout (no response at all)
      error.code === 'ECONNABORTED' || // Timeout
      error.code === 'ERR_NETWORK' || // Network error
      error.response?.status === 502 || // Bad Gateway
      error.response?.status === 503 || // Service Unavailable
      error.response?.status === 504 || // Gateway Timeout
      error.response?.status === 429;   // Too Many Requests

    // Only retry GET requests or explicitly marked safe requests
    const isSafeToRetry = config.method === 'get' || config.__forceRetry;

    if (isRetryable && isSafeToRetry && config.__retryCount < MAX_RETRIES) {
      config.__retryCount++;
      const delay = RETRY_DELAY_MS * config.__retryCount; // Exponential-ish backoff

      console.warn(
        `[API Retry] Attempt ${config.__retryCount}/${MAX_RETRIES} for ${config.method?.toUpperCase()} ${config.url} after ${delay}ms`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      return api.request(config);
    }

    return Promise.reject(createCustomError(error));
  }
);

function createCustomError(error) {
  const res = error.response?.data;
  let message;

  if (error.code === 'ECONNABORTED') {
    message = 'Yêu cầu bị hết thời gian chờ. Vui lòng kiểm tra kết nối mạng và thử lại.';
  } else if (!error.response) {
    message = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
  } else {
    message = res?.message || 'Có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.';
  }

  const customError = new Error(message);
  customError.code = res?.code || error.code || 'NETWORK_ERROR';
  customError.status = error.response?.status;
  return customError;
}

/**
 * Helper to build absolute URL for media/images/meter photos when API is external
 */
export function getFullApiUrl(path = '') {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    if (API_BASE_URL.endsWith('/api') && cleanPath.startsWith('/api/')) {
      return `${API_BASE_URL}${cleanPath.slice(4)}`;
    }
    return `${API_BASE_URL}${cleanPath}`;
  }
  return cleanPath;
}

export default api;

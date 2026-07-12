import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = '/api/v1';

/**
 * Custom hook for making authenticated API calls to the backend.
 * Automatically attaches Firebase ID token as Bearer token.
 */
export function useApi() {
  const { getIdToken } = useAuth();

  const request = useCallback(
    async (endpoint, options = {}) => {
      try {
        const token = await getIdToken();
        const url = `${API_BASE}${endpoint}`;
        const headers = {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        };

        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const error = new Error(errorBody.message || `API Error: ${response.status}`);
          error.status = response.status;
          error.body = errorBody;
          throw error;
        }

        // Handle 204 No Content
        if (response.status === 204) return null;

        return await response.json();
      } catch (err) {
        // If there's no backend, return null (allows demo data fallback)
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
          console.warn(`API unavailable for ${endpoint}, using demo data fallback`);
          return null;
        }
        throw err;
      }
    },
    [getIdToken]
  );

  const get = useCallback(
    (endpoint) => request(endpoint, { method: 'GET' }),
    [request]
  );

  const post = useCallback(
    (endpoint, body) =>
      request(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [request]
  );

  const put = useCallback(
    (endpoint, body) =>
      request(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    [request]
  );

  const del = useCallback(
    (endpoint) => request(endpoint, { method: 'DELETE' }),
    [request]
  );

  return { get, post, put, del, request };
}

export default useApi;

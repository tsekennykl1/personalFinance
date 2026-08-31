import { getAccessToken } from '../auth/useAuth';

const BASE_URL = 'https://s3s78soeq5.execute-api.ap-east-1.amazonaws.com/Prod';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expired — redirect to login
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return response.json();
}

// Usage:
// const reports = await apiFetch('/api/v1/reports');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';

/**
 * Service to execute REST requests with token auth
 */
export const apiRequest = async (endpoint, method = 'GET', body = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.message || 'Request failed' };
    }
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message || 'Network error' };
  }
};

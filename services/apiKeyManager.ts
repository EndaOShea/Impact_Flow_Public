/**
 * API Key Manager Service
 *
 * Manages user API keys (like Gemini) via the backend API.
 * Keys are encrypted server-side using AES-256-GCM.
 */

// API Configuration
const API_BASE = process.env.NODE_ENV === 'production'
    ? 'https://your-backend-url.com/api'
    : 'http://localhost:2001/api';

interface ApiKeyMetadata {
    createdAt: string;
    lastUsed?: string;
}

/**
 * Get authorization headers for API requests
 */
const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('sessionToken');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

/**
 * Store encrypted API key for a user
 */
export const storeApiKey = async (userId: string, apiKey: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/auth/api-key`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({
            serviceName: 'gemini',
            apiKey
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || 'Failed to store API key');
    }
};

/**
 * Get decrypted API key for a user
 */
export const getApiKey = async (userId: string): Promise<string | null> => {
    try {
        const response = await fetch(`${API_BASE}/auth/api-key/gemini`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null; // No key stored
            }
            throw new Error('Failed to retrieve API key');
        }

        const data = await response.json();
        return data.apiKey || null;
    } catch (error) {
        console.error('Error retrieving API key:', error);
        return null;
    }
};

/**
 * Check if user has an API key stored
 */
export const hasApiKey = (userId: string): boolean => {
    // For synchronous check, we use a cached value in sessionStorage
    const cacheKey = `hasApiKey_${userId}_gemini`;
    return sessionStorage.getItem(cacheKey) === 'true';
};

/**
 * Async check if user has an API key stored
 */
export const checkHasApiKey = async (userId: string): Promise<boolean> => {
    try {
        const response = await fetch(`${API_BASE}/auth/api-key/gemini/check`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();

        // Cache the result for synchronous access
        const cacheKey = `hasApiKey_${userId}_gemini`;
        sessionStorage.setItem(cacheKey, data.exists ? 'true' : 'false');

        return data.exists;
    } catch (error) {
        console.error('Error checking API key:', error);
        return false;
    }
};

/**
 * Delete stored API key for a user
 */
export const deleteApiKey = async (userId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/auth/api-key/gemini`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || 'Failed to delete API key');
    }

    // Clear cache
    const cacheKey = `hasApiKey_${userId}_gemini`;
    sessionStorage.removeItem(cacheKey);
};

/**
 * Get API key metadata (without decrypting the key)
 */
export const getApiKeyMetadata = async (userId: string): Promise<ApiKeyMetadata | null> => {
    try {
        const response = await fetch(`${API_BASE}/auth/api-key/gemini/metadata`, {
            method: 'GET',
            headers: getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting API key metadata:', error);
        return null;
    }
};

/**
 * Initialize API key check on login
 * Call this after user login to cache hasApiKey status
 */
export const initApiKeyCache = async (userId: string): Promise<void> => {
    await checkHasApiKey(userId);
};

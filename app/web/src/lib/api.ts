/**
 * API Utility Functions
 *
 * Helper functions for making authenticated API requests to the backend
 */

import { useAuthStore } from '@/stores/authStore';

// ── Insufficient-funds detection ─────────────────────────────────────────────
// Bitcoin Computer / regtest errors for low wallet balance use various phrases.
// We normalise them so the UI can show a friendly "Top up your wallet" card.
const INSUFFICIENT_FUNDS_PATTERNS = [
  /insufficient funds/i,
  /not enough funds/i,
  /insufficient balance/i,
  /not enough balance/i,
  /wallet has insufficient/i,
  /insufficient utxo/i,
  /utxo.*insufficient/i,
  /balance.*too low/i,
  /too low.*balance/i,
  /min relay fee not met/i,
  /dust.*threshold/i,
  /transaction too large/i,
  /mandatory script verify flag/i,   // sometimes appears when inputs exhausted
  /not enough satoshis/i,
  /amount exceeds balance/i,
  /UTXO.*empty/i,
];

/**
 * Returns true when an Error message matches known "not enough funds" patterns
 * from Bitcoin Computer / regtest node responses.
 */
export function isInsufficientFunds(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return INSUFFICIENT_FUNDS_PATTERNS.some(re => re.test(msg));
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Make an authenticated API request
 *
 * Automatically includes the JWT token from the auth store
 * Handles common error cases (401, network errors, etc.)
 *
 * @param endpoint - API endpoint (e.g., '/quiz/create')
 * @param options - Fetch options
 * @returns Response data
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized - token might be expired
    if (response.status === 401) {
      useAuthStore.getState().logout();
      throw new Error('Session expired. Please log in again.');
    }

    // Handle other error responses
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred');
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = any>(endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Zustand Auth Store
 *
 * Zustand is a lightweight state management library.
 * It's simpler than Redux and doesn't require providers or context.
 *
 * Features:
 * - persist middleware saves state to localStorage
 * - Automatically rehydrates on page refresh
 * - Simple API: just use the hook!
 *
 * Usage in components:
 * const { user, token, login, logout } = useAuthStore();
 */

interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'TEACHER';
  address: string;
  createdAt: string;
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role?: 'STUDENT' | 'TEACHER') => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  clearError: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isLoading: false,
      error: null,

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
          }

          const data = await response.json();

          set({
            user: data.user,
            token: data.access_token,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // Signup action
      signup: async (email: string, password: string, name: string, role: 'STUDENT' | 'TEACHER' = 'STUDENT') => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, role }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Signup failed');
          }

          const data = await response.json();

          set({
            user: data.user,
            token: data.access_token,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Signup failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // Logout action
      logout: () => {
        set({ user: null, token: null, error: null });
      },

      // Set user manually (for profile updates)
      setUser: (user) => {
        set({ user });
      },

      // Set token manually
      setToken: (token) => {
        set({ token });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage', // localStorage key
      // Only persist user and token, not loading/error states
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);

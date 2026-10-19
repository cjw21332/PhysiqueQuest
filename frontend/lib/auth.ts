import { api, ApiRequestError } from './api';
import { AUTH_STORAGE_KEY, PROFILE_STORAGE_KEY, clearAuthSession } from './session';

// Authentication utilities
export interface User {
  id: string;
  name: string;
  email: string;
  token: string;
  profile?: any; // Full profile data
}

export { AUTH_STORAGE_KEY, PROFILE_STORAGE_KEY, clearAuthSession } from './session';

export async function register(name: string, email: string, password: string): Promise<User> {
  try {
    const response = await api.register({ name, email, password });

    const user: User = {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      token: response.access_token, // Backend returns access_token
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.statusCode >= 500) {
      console.error('Register API error:', error instanceof Error ? error.message : String(error));
    }
    if (error instanceof ApiRequestError) throw error;
    throw new Error(error instanceof Error ? error.message : 'Registration failed');
  }
}

export async function login(email: string, password: string): Promise<User> {
  try {
    const response = await api.login({ email, password });

    const user: User = {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      token: response.access_token, // Backend returns access_token
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    return user;
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.statusCode >= 500) {
      console.error('Login API error:', error instanceof Error ? error.message : String(error));
    }
    if (error instanceof ApiRequestError) throw error;
    throw new Error(error instanceof Error ? error.message : 'Login failed');
  }
}

export function logout() {
  clearAuthSession();
  // The bounded device snapshot is restored only for the same authenticated account.
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;

  try {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY);
    return authData ? JSON.parse(authData) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getCurrentUser()?.token);
}

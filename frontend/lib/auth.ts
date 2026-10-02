import { api } from './api';

// Authentication utilities
export interface User {
  id: string;
  name: string;
  email: string;
  token: string;
  profile?: any; // Full profile data
}

export const AUTH_STORAGE_KEY = 'physiquequest-auth';
export const PROFILE_STORAGE_KEY = 'physiquequest-profile';

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
    throw new Error(error instanceof Error ? error.message : 'Login failed');
  }
}

export function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Keep profile data for convenience when user logs back in
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
  return getCurrentUser() !== null;
}

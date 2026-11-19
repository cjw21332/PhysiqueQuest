import { api, ApiRequestError, getApiBaseUrl } from './api';
import { clearAuthSession, session } from './session';

// Authentication utilities
export interface User {
  id: string;
  name: string;
  email: string;
  token: string;
  sessionKey?: number;
  profile?: any; // Full profile data
}

export { AUTH_STORAGE_KEY, PROFILE_STORAGE_KEY, clearAuthSession } from './session';

export async function register(name: string, email: string, password: string, requestId: string, code: string, profile: unknown): Promise<User> {
  try {
    const response = await api.register({ name, email, password, requestId, code, profile });

    const user: User = {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      token: response.access_token, // Backend returns access_token
    };

    session.set(response, getApiBaseUrl());
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

    session.set(response, getApiBaseUrl());
    return user;
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.statusCode >= 500) {
      console.error('Login API error:', error instanceof Error ? error.message : String(error));
    }
    if (error instanceof ApiRequestError) throw error;
    throw new Error(error instanceof Error ? error.message : 'Login failed');
  }
}

export async function loginWithGoogle(idToken: string): Promise<User> {
  const response = await api.googleLogin(idToken);
  session.set(response, getApiBaseUrl());
  return {
    id: response.user.id,
    name: response.user.name,
    email: response.user.email,
    token: response.access_token,
  };
}

export async function registerWithGoogle(data: {
  idToken: string;
  password: string;
  requestId: string;
  code: string;
  name: string;
  profile: unknown;
}): Promise<User> {
  const response = await api.googleRegister(data);
  session.set(response, getApiBaseUrl());
  return {
    id: response.user.id,
    name: response.user.name,
    email: response.user.email,
    token: response.access_token,
  };
}

export async function logout() {
  const deviceId = typeof window === 'undefined' ? null : localStorage.getItem('physiquequest-push-device');
  try {
    if (deviceId) {
      await api.revokePushDevice(deviceId);
      localStorage.removeItem('physiquequest-push-device');
    }
    await api.logout();
  } catch {
    // The local session must still end when the server cannot be reached.
  } finally {
    clearAuthSession();
  }
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;

  return session.current(getApiBaseUrl());
}

export function isAuthenticated(): boolean {
  const user = session.current(getApiBaseUrl());
  return Boolean(user?.token || user?.offlineOnly);
}

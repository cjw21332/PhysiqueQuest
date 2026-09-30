// Authentication utilities
export interface User {
  name: string;
  email: string;
  profile: any; // Full profile data
}

export const AUTH_STORAGE_KEY = 'physiquequest-auth';
export const PROFILE_STORAGE_KEY = 'physiquequest-profile';

export function login(email: string, password: string): Promise<User> {
  // Simulate login - in production, this would call your backend API
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
      const profile = savedProfile ? JSON.parse(savedProfile) : {};

      const user: User = {
        name: profile.name || 'User',
        email: email,
        profile: profile
      };

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      resolve(user);
    }, 500);
  });
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

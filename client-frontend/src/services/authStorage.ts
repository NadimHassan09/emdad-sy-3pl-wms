const BEARER_KEY = 'client_portal_access_token';

export function getStoredBearer(): string | null {
  try {
    return sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

export function setStoredBearer(token: string): void {
  sessionStorage.setItem(BEARER_KEY, token);
}

export function clearStoredBearer(): void {
  sessionStorage.removeItem(BEARER_KEY);
}

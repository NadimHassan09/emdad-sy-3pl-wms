const ACCESS_TOKEN_KEY = 'wms.access_token';

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

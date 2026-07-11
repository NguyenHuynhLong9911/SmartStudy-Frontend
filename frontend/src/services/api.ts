import axios, { InternalAxiosRequestConfig } from 'axios';
import { cognitoStoragePrefix } from '../auth/cognito';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management helpers
const TOKEN_KEY = 'smartstudy_access_token';
const REFRESH_TOKEN_KEY = 'smartstudy_refresh_token';
const USER_KEY = 'smartstudy_user';
let currentCognitoToken: string | null = null;
let currentCognitoUser: CognitoAuthUserContext | null = null;

export interface CognitoAuthUserContext {
  readonly email?: string;
  readonly name?: string;
  readonly userId?: string;
}

export const getAccessToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);
export const getStoredUser = () => {
  const userStr = localStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setTokens = (accessToken: string, refreshToken?: string) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const setStoredUser = (user: unknown) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const setCognitoAuthToken = (token: string | null | undefined) => {
  currentCognitoToken = token || null;
  if (currentCognitoToken) {
    api.defaults.headers.common.Authorization = `Bearer ${currentCognitoToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const getCognitoAuthToken = (): string | null => getCognitoIdToken();

export const setCognitoAuthContext = (
  token: string | null | undefined,
  user: CognitoAuthUserContext | null | undefined,
) => {
  setCognitoAuthToken(token);
  currentCognitoUser = normalizeCognitoUser(user);
};

export const getCognitoAuthUser = (): CognitoAuthUserContext | null =>
  currentCognitoUser ?? readOidcUserContext(sessionStorage) ?? readOidcUserContext(localStorage);

const notifyAuthExpired = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smartstudy:auth-expired'));
  }
};

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    const cognitoToken = getCognitoIdToken();
    if (config.headers) {
      const accessToken = cognitoToken || token;
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      const cognitoUser = getCognitoAuthUser();
      if (cognitoUser?.userId) {
        config.headers['x-smartstudy-user-id'] = cognitoUser.userId;
      }
      if (cognitoUser?.email) {
        config.headers['x-smartstudy-user-email'] = cognitoUser.email;
      }
      if (cognitoUser?.name) {
        config.headers['x-smartstudy-user-name'] = cognitoUser.name;
      }
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

// Response interceptor for Cognito-protected API calls.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    // If 401 and not already retrying and not on the refresh endpoint itself
    if (
      originalRequest &&
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;
      const hasCognitoSession = Boolean(getCognitoIdToken());
      clearAuth();
      if (!hasCognitoSession) {
        notifyAuthExpired();
      }
    }

    return Promise.reject(error);
  }
);

function getCognitoIdToken(): string | null {
  if (currentCognitoToken) {
    return currentCognitoToken;
  }

  return readOidcIdToken(sessionStorage) ?? readOidcIdToken(localStorage);
}

function readOidcIdToken(storage: Storage): string | null {
  const direct = storage.getItem(cognitoStoragePrefix);
  if (direct) {
    return parseOidcIdToken(direct);
  }

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith('oidc.user:')) {
      continue;
    }

    const token = parseOidcIdToken(storage.getItem(key));
    if (token) {
      return token;
    }
  }

  return null;
}

function readOidcUserContext(storage: Storage): CognitoAuthUserContext | null {
  const direct = storage.getItem(cognitoStoragePrefix);
  const directUser = parseOidcUserContext(direct);
  if (directUser) {
    return directUser;
  }

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith('oidc.user:')) {
      continue;
    }

    const user = parseOidcUserContext(storage.getItem(key));
    if (user) {
      return user;
    }
  }

  return null;
}

function parseOidcIdToken(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      access_token?: string;
      expires_at?: number;
      id_token?: string;
    };
    if (
      (parsed.id_token || parsed.access_token) &&
      (!parsed.expires_at || parsed.expires_at > Math.floor(Date.now() / 1000))
    ) {
      return parsed.id_token || parsed.access_token || null;
    }
  } catch {
    return null;
  }

  return null;
}

function parseOidcUserContext(value: string | null): CognitoAuthUserContext | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      expires_at?: number;
      profile?: {
        email?: unknown;
        name?: unknown;
        sub?: unknown;
      };
    };

    if (parsed.expires_at && parsed.expires_at <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const email = parsed.profile?.email;
    const name = parsed.profile?.name;
    const userId = parsed.profile?.sub;

    return normalizeCognitoUser({
      ...(typeof email === 'string' ? { email } : {}),
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof userId === 'string' ? { userId } : {}),
    });
  } catch {
    return null;
  }
}

function normalizeCognitoUser(
  user: CognitoAuthUserContext | null | undefined,
): CognitoAuthUserContext | null {
  const userId = user?.userId?.trim();
  const email = user?.email?.trim().toLowerCase();
  const name = user?.name?.trim();

  if (!userId || !email) {
    return null;
  }

  return {
    email,
    ...(name ? { name } : {}),
    userId,
  };
}

import { create } from 'zustand';
import type { PublicUser } from '@tabletop/shared';
import { authApi, setAccessToken } from '../lib/api.js';

interface AuthState {
  user: PublicUser | null;
  status: 'idle' | 'loading' | 'authed' | 'anon';
  error: string | null;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>; // tenta restaurar sessão via cookie no load
  clearError: () => void;
}

// Restauração de sessão em andamento. O refresh token é rotativo e o servidor
// encerra todas as sessões se um token já trocado for reusado: duas chamadas
// simultâneas (ex.: o StrictMode do React roda o efeito duas vezes) precisam
// compartilhar a mesma requisição.
let bootstrapping: Promise<void> | null = null;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  clearError: () => set({ error: null }),

  register: async (email, displayName, password) => {
    set({ status: 'loading', error: null });
    try {
      const { accessToken, user } = await authApi.register(email, displayName, password);
      setAccessToken(accessToken);
      set({ user, status: 'authed' });
    } catch (e: any) {
      set({ status: 'anon', error: e?.message ?? 'Falha ao cadastrar.' });
      throw e;
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null });
    try {
      const { accessToken, user } = await authApi.login(email, password);
      setAccessToken(accessToken);
      set({ user, status: 'authed' });
    } catch (e: any) {
      set({ status: 'anon', error: e?.message ?? 'Falha ao entrar.' });
      throw e;
    }
  },

  logout: async () => {
    await authApi.logout().catch(() => void 0);
    setAccessToken(null);
    set({ user: null, status: 'anon' });
  },

  bootstrap: () => {
    bootstrapping ??= (async () => {
      set({ status: 'loading' });
      try {
        const { accessToken, user } = await authApi.refresh();
        setAccessToken(accessToken);
        set({ user, status: 'authed' });
      } catch {
        set({ user: null, status: 'anon' });
      }
    })().finally(() => {
      bootstrapping = null;
    });
    return bootstrapping;
  },
}));

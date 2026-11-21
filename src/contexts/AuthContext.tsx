import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '@/lib/firebase';
import { apiUrl, isNativeCapacitor } from '@/lib/runtime-config';

export type MoBussRole =
  | 'mobuss_super_admin'
  | 'operations_manager'
  | 'fleet_manager'
  | 'school_account_manager'
  | 'finance_officer'
  | 'safety_support_agent'
  | 'school_admin'
  | 'driver'
  | 'vehicle_owner'
  | 'parent_guardian';

export interface AuthDbUser {
  id: number;
  uid: string;
  username?: string | null;
  email: string;
  fullName: string;
  phone: string | null;
  primaryRole: MoBussRole;
  active: boolean;
  schoolId: number | null;
  driverId: number | null;
  ownerId: number | null;
}

export interface AuthCapabilities {
  canAccessAdmin: boolean;
  canAccessSchoolPortal: boolean;
  canAccessDriverApp: boolean;
  canManageRbac: boolean;
}

interface AuthContextValue {
  firebaseUser: User | null;
  dbUser: AuthDbUser | null;
  isAuthenticated: boolean;
  school: { id: number; name: string; municipality: string } | null;
  capabilities: AuthCapabilities;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (params: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  apiFetch: <T = unknown>(input: string, init?: RequestInit) => Promise<T>;
}

const SESSION_STORAGE_KEY = 'mobuss_cred_session_v1';

const DEFAULT_CAPABILITIES: AuthCapabilities = {
  canAccessAdmin: false,
  canAccessSchoolPortal: false,
  canAccessDriverApp: false,
  canManageRbac: false,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSessionToken(token: string | null) {
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<AuthDbUser | null>(null);
  const [school, setSchool] = useState<{ id: number; name: string; municipality: string } | null>(null);
  const [capabilities, setCapabilities] = useState<AuthCapabilities>(DEFAULT_CAPABILITIES);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(readStoredSessionToken());

  const fetchWithBearer = useCallback(async (token: string, input: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(apiUrl(input), { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Erro HTTP ${res.status}`) as Error & { status?: number; code?: string };
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  }, []);

  const syncWithToken = useCallback(
    async (token: string, isFirebase: boolean) => {
      try {
        setAuthError(null);
        const profile = await fetchWithBearer(token, '/api/v1/auth/me');
        setDbUser(profile.user);
        setSchool(profile.school ?? null);
        setCapabilities(profile.capabilities ?? DEFAULT_CAPABILITIES);
      } catch (err: unknown) {
        const errObj = err as { status?: number; message?: string };
        const message = errObj?.message || 'Falha ao sincronizar perfil.';
        if (errObj?.status === 401 || errObj?.status === 403) {
          sessionTokenRef.current = null;
          writeStoredSessionToken(null);
          setDbUser(null);
          setSchool(null);
          setCapabilities(DEFAULT_CAPABILITIES);
          if (isFirebase) {
            setAuthError(message);
            setFirebaseUser(null);
            await firebaseSignOut(auth).catch(() => null);
          }
        } else {
          setAuthError(message);
        }
      }
    },
    [fetchWithBearer]
  );

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const storedToken = sessionTokenRef.current;
      if (storedToken) {
        await syncWithToken(storedToken, false);
        if (active) setLoading(false);
        return;
      }

      void getRedirectResult(auth)
        .then(async (res) => {
          if (res?.user) {
            const tok = await res.user.getIdToken();
            await syncWithToken(tok, true);
          }
        })
        .catch(() => null);
    }

    void bootstrapSession();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      if (user) {
        sessionTokenRef.current = null;
        writeStoredSessionToken(null);
        setFirebaseUser(user);
        const tok = await user.getIdToken();
        await syncWithToken(tok, true);
      } else {
        setFirebaseUser(null);
        if (!sessionTokenRef.current) {
          setDbUser(null);
          setSchool(null);
          setCapabilities(DEFAULT_CAPABILITIES);
        }
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [syncWithToken]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    sessionTokenRef.current = null;
    writeStoredSessionToken(null);
    try {
      if (isNativeCapacitor()) {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      const cred = await signInWithPopup(auth, googleAuthProvider);
      if (cred.user) {
        const tok = await cred.user.getIdToken();
        await syncWithToken(tok, true);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      const message = err instanceof Error ? err.message : 'Falha no início de sessão.';
      setAuthError(message);
      throw err;
    }
  }, [syncWithToken]);

  const signInWithEmail = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setAuthError(null);
      const identifier = email.trim();
      try {
        const res = await fetch(apiUrl('/api/v1/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.token && data.user) {
          sessionTokenRef.current = data.token;
          writeStoredSessionToken(data.token);
          setDbUser(data.user);
          setSchool(data.school ?? null);
          setCapabilities(data.capabilities ?? DEFAULT_CAPABILITIES);
          return;
        }

        if (res.status === 403) {
          throw new Error(data.error || 'Conta desativada pelo administrador MôBuss.');
        }

        // Optional fallback to Firebase Email/Password only if identifier looks like an email
        if (identifier.includes('@')) {
          try {
            const cred = await signInWithEmailAndPassword(auth, identifier, password);
            if (cred.user) {
              const tok = await cred.user.getIdToken();
              await syncWithToken(tok, true);
              return;
            }
          } catch {
            // Surface primary server error below
          }
        }

        throw new Error(data.error || 'Utilizador ou palavra-passe inválidos.');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Credenciais inválidas.';
        setAuthError(message);
        throw err;
      }
    },
    [syncWithToken]
  );

  const signOut = useCallback(async () => {
    sessionTokenRef.current = null;
    writeStoredSessionToken(null);
    await firebaseSignOut(auth).catch(() => null);
    setFirebaseUser(null);
    setDbUser(null);
    setSchool(null);
    setCapabilities(DEFAULT_CAPABILITIES);
  }, []);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (sessionTokenRef.current) {
      return sessionTokenRef.current;
    }
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    const tok = await getAuthToken();
    if (tok) {
      await syncWithToken(tok, !sessionTokenRef.current);
    }
  }, [getAuthToken, syncWithToken]);

  const apiFetch = useCallback(
    async <T = unknown>(input: string, init?: RequestInit): Promise<T> => {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Sessão não iniciada.');
      }
      return (await fetchWithBearer(token, input, init)) as T;
    },
    [getAuthToken, fetchWithBearer]
  );

  const isAuthenticated = Boolean(dbUser);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        isAuthenticated,
        school,
        capabilities,
        loading,
        authError,
        signInWithGoogle,
        signInWithEmail,
        signOut,
        refreshProfile,
        getAuthToken,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return ctx;
}

export const ROLE_LABELS: Record<MoBussRole, string> = {
  mobuss_super_admin: 'Super Admin MôBuss',
  operations_manager: 'Gestor de Operações',
  fleet_manager: 'Gestor de Frota',
  school_account_manager: 'Gestor de Contas Escolares',
  finance_officer: 'Oficial Financeiro',
  safety_support_agent: 'Agente Segurança & SOS',
  school_admin: 'Administrador Escolar',
  driver: 'Motorista Oficial',
  vehicle_owner: 'Proprietário Parceiro',
  parent_guardian: 'Encarregado de Educação',
};

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMe } from "../api/client";

interface User {
  id: string;
  phone?: string;
  email?: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithOtp: (token: string, refreshToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>(null!);

const TOKEN_KEY = "otp_access_token";
const REFRESH_KEY = "otp_refresh_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      getMe()
        .then((r) => setUser(r.data))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_KEY);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginWithOtp = async (accessToken: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    setToken(accessToken);
    const r = await getMe();
    setUser(r.data);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

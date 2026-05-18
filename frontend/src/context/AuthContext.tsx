import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getMe } from "../api/client";

const DEV_USER: User = {
  id: "dev-user-id",
  email: "dev@kyc.local",
  role: "admin",
  is_active: true,
  mfa_enabled: false,
};
const DEV_TOKEN = "dev-bypass";

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token === DEV_TOKEN) { setUser(DEV_USER); return; }
    if (token) {
      getMe()
        .then((r) => setUser(r.data))
        .catch(() => logout());
    }
  }, [token]);

  const login = async (t: string) => {
    if (t === "dev") {
      localStorage.setItem("token", DEV_TOKEN);
      setToken(DEV_TOKEN);
      setUser(DEV_USER);
      return;
    }
    localStorage.setItem("token", t);
    setToken(t);
    const r = await getMe();
    setUser(r.data);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, type AdminInfo } from "./api";

type AdminAuthState = {
  admin: AdminInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setAdmin: (admin: AdminInfo | null) => void;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { admin } = await api.adminMe();
      setAdmin(admin);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.adminLogout();
    } finally {
      setAdmin(null);
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ admin, loading, refresh, setAdmin, logout }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}

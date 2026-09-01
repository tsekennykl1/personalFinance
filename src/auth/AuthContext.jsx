// src/auth/AuthContext.jsx
// Provides { user, signOut } to any component via useAuthContext().
// When auth is OFF, both are null.

import { createContext, useContext } from "react";

const AuthContext = createContext({ user: null, signOut: null });

export const AuthProvider = AuthContext.Provider;

export function useAuthContext() {
  return useContext(AuthContext);
}
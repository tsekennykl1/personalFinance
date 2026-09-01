import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import { AUTH_ENABLED } from "./api/api";
import { AuthProvider } from "./auth/AuthContext";

import Home from "./pages/Home.jsx";
import StockRetrieval from "./pages/StockRetrieval.jsx";
import Transactions from "./pages/Transactions.jsx";
import Dividends from "./pages/Dividends.jsx";
import Ledger from "./pages/Ledger.jsx";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stock-retrieval" element={<StockRetrieval />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/dividends" element={<Dividends />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  // ─── Auth OFF: render app directly (current behaviour) ───
  if (!AUTH_ENABLED) {
    return (
      <AuthProvider value={{ user: null, signOut: null }}>
        <AppRoutes />
      </AuthProvider>
    );
  }

  // ─── Auth ON: Amplify Authenticator wraps everything ───
  // Shows Cognito login screen if not authenticated.
  // Once logged in, renders the app with user + signOut in context.
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <AuthProvider value={{ user, signOut }}>
          <AppRoutes />
        </AuthProvider>
      )}
    </Authenticator>
  );
}
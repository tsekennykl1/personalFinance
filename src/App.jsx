import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import StockRetrieval from "./pages/StockRetrieval.jsx";
import Transactions from "./pages/Transactions.jsx";
import Dividends from "./pages/Dividends.jsx";
import Ledger from "./pages/Ledger.jsx";

export default function App() {
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
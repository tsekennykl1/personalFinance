import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import StockRetrieval from "./pages/StockRetrieval.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stock-retrieval" element={<StockRetrieval />} />
      </Routes>
    </BrowserRouter>
  );
}
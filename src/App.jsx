import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ScanInvoice from "./pages/home";

// ─── Main App Component ─────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      <Route path="/" element={<ScanInvoice />} />
      <Route path="/:labId/:invoiceId" element={<ScanInvoice />} />
    </Routes>
  );
}

export default App;

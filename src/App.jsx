import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ScanInvoice from "./pages/home";
import ReportDownload from "./pages/reportDownload";

// ─── Main App Component ─────────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      <Route path="/" element={<ScanInvoice />} />
      <Route path="/:labId/:invoiceId" element={<ScanInvoice />} />
      <Route path="/:labId/:invoiceId/report/:testId" element={<ReportDownload />} />
    </Routes>
  );
}

export default App;

// ReportDrawer.jsx
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, X } from "lucide-react";
import ReportViewer from "./ReportViewer";
import scanService from "../../api/scan";

const isNetworkError = (err) => err?.isAxiosError === true && !err.response;

const formatDate = (val) => {
  if (!val) return "";
  const d = new Date(val);
  return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function useBodyPortal() {
  const [el, setEl] = useState(null);

  useEffect(() => {
    const div = document.createElement("div");
    div.className = "fixed inset-0 w-full h-full z-[99999] overflow-hidden h-[100dvh]";
    document.body.appendChild(div);
    setEl(div);

    const savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.removeChild(div);
      document.body.style.overflow = savedOverflow;
    };
  }, []);

  return el;
}

export default function ReportDrawer({ labId, invoiceId, testId, testName, onClose }) {
  const [report, setReport] = useState(null);
  const [patient, setPatient] = useState(null);
  const [labInfo, setLabInfo] = useState(null);
  const [displayId, setDisplayId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(false);

  const portalEl = useBodyPortal();

  useEffect(() => {
    scanService
      .getReport(labId, invoiceId, testId)
      .then(({ data }) => {
        setDisplayId(data.invoiceId);
        setReport(data.report);
        setLabInfo(data.labInfo);
        setPatient({
          name: data.patient?.name ?? "",
          age: data.patient?.age != null ? `${data.patient.age} yrs` : "",
          gender: data.patient?.gender ?? "",
          contact: data.patient?.contactNumber ?? "",
          referredBy: data.referrer?.name ?? "",
          sampleDate: formatDate(data.report?.sampleCollectionDate),
          reportDate: formatDate(data.report?.reportDate),
        });
      })
      .catch((err) => {
        if (isNetworkError(err)) {
          setError("ইন্টারনেট সংযোগ নেই। দয়া করে সংযোগ চেক করুন।");
        } else {
          setError(err?.response?.data?.error || "রিপোর্ট লোড করা যায়নি।");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 250);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!portalEl) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes sr-slide-in  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes sr-slide-out { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes sr-spin { to { transform: rotate(360deg); } }
        .sr-drawer-body-scroll::-webkit-scrollbar { width: 4px; }
        .sr-drawer-body-scroll::-webkit-scrollbar-track { background: transparent; }
        .sr-drawer-body-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>

      <div
        className={`absolute inset-0 bg-[#f7f8fa] flex flex-col overflow-hidden ${closing ? "animate-[sr-slide-out_0.25s_cubic-bezier(0.32,0,0.67,0)_forwards]" : "animate-[sr-slide-in_0.3s_cubic-bezier(0.32,0.72,0,1)_forwards]"}`}
      >
        <div className="flex items-center gap-3 py-4 px-5 bg-gradient-to-br from-slate-100 via-blue-100 to-indigo-100 border-b border-slate-200 shrink-0 shadow-sm">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border bg-emerald-100 border-emerald-200">
            <Eye className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-noto text-sm font-bold text-slate-900 tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
              View — {testName}
            </h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
              {displayId ? `Invoice #${displayId}` : "Report"}
            </p>
          </div>
          <button
            className="w-9 h-9 rounded-lg bg-white/70 border border-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            onClick={handleClose}
            title="Close (Esc)"
            aria-label="Close report"
          >
            <X className="w-[17px] h-[17px]" />
          </button>
        </div>

        <div className="sr-drawer-body-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#f7f8fa]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-[80px] px-6 gap-3">
              <div className="w-7 h-7 rounded-full border-[2.5px] border-black/10 border-t-[#60a5fa] animate-[sr-spin_0.7s_linear_infinite]" />
              <span className="font-mono text-[11px] text-[#64748b] uppercase tracking-[0.07em]">Loading report…</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-[80px] px-6 gap-2 text-center">
              <p className="text-sm font-bold text-rose-600">{error}</p>
            </div>
          )}
          {!loading && !error && report && (
            <div className="py-5 px-4">
              <ReportViewer
                report={report}
                patient={patient}
                reportName={testName}
                invoiceId={displayId}
                labInfo={labInfo}
              />
            </div>
          )}
        </div>
      </div>
    </>,
    portalEl,
  );
}

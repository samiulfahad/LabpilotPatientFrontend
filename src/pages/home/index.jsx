import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import ReportDrawer from "../../components/reports/ReportDrawer";
import { pdf } from "@react-pdf/renderer";
import { ReportPDFDocument } from "../../components/reports/ReportPDF";
import scanService from "../../api/scan";

import {
  ScanLine,
  X,
  Zap,
  ZapOff,
  CheckCircle2,
  Phone,
  Stethoscope,
  UserRound,
  FlaskConical,
  WifiOff,
  Clock,
  CreditCard,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Eye,
  Download,
  MapPin,
  ShieldCheck,
  Building2,
  Mail,
  Activity,
} from "lucide-react";

const HEX24 = /^[a-fA-F0-9]{24}$/;
const SCAN_CONSTRAINTS = {
  facingMode: "environment",
  width: { ideal: 480 },
  height: { ideal: 480 },
};

function parseScanPayload(raw) {
  const text = (raw || "").trim();
  const match = text.match(/([a-fA-F0-9]{24})\/([a-fA-F0-9]{24})\/?$/);
  return match ? { labId: match[1], invoiceId: match[2] } : null;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Small building blocks ────────────────────────────────────────────── */

function InfoItem({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50/50 border border-slate-100">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-[13px] text-slate-800 font-bold leading-snug truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function BrandMark({ className = "" }) {
  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 ${className}`}>
      <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" strokeWidth={1.75} />
      <span>Secured by LabPilot Pro</span>
    </div>
  );
}

function LabHeader({ labInfo }) {
  if (!labInfo?.name) return null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 relative overflow-hidden mb-5">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-indigo-600" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{labInfo.name}</h2>
            {labInfo.tagline && <p className="text-sm text-slate-500 font-medium mt-0.5">{labInfo.tagline}</p>}
          </div>
        </div>
        <div className="hidden md:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
            <ShieldCheck className="h-4 w-4" /> যাচাইকৃত ল্যাব
          </span>
        </div>
      </div>

      {(labInfo.address || labInfo.phone || labInfo.email || labInfo.regNo) && (
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-3 gap-x-4 text-[12px] text-slate-600">
          {labInfo.address && (
            <div className="flex items-start gap-2 lg:col-span-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
              <span className="leading-relaxed">{labInfo.address}</span>
            </div>
          )}
          {labInfo.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{labInfo.phone}</span>
            </div>
          )}
          {labInfo.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>{labInfo.email}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TestItem({ test, onView }) {
  const [downloading, setDownloading] = useState(false);
  const canAccess = test.isOnline && test.isCompleted;

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const { data } = await scanService.getReport(test.labId, test.invoiceId, test.testId);
      const patient = {
        name: data.patient?.name ?? "",
        age: data.patient?.age != null ? `${data.patient.age} yrs` : "",
        gender: data.patient?.gender ?? "",
        contact: data.patient?.contactNumber ?? "",
        referredBy: data.referrer?.name ?? "",
        sampleDate: formatDate(data.report?.sampleCollectionDate),
        reportDate: formatDate(data.report?.reportDate),
      };
      const blob = await pdf(
        <ReportPDFDocument
          report={data.report}
          reportName={data.testName}
          shortId={data.invoiceId}
          patient={patient}
          labInfo={data.labInfo}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.testName.replace(/\s+/g, "_")}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="group bg-white border border-slate-200 rounded-xl p-4 transition-all hover:shadow-md hover:border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <div
          className={`mt-0.5 p-2 rounded-lg ${test.isOnline ? (test.isCompleted ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-500") : "bg-slate-50 text-slate-400"}`}
        >
          <FlaskConical className="h-5 w-5" strokeWidth={2} />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800 leading-tight mb-1">{test.name}</div>
          <div className="flex items-center gap-2">
            {test.isOnline ? (
              test.isCompleted ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> রিপোর্ট প্রস্তুত
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3" /> প্রক্রিয়াধীন
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                <WifiOff className="h-3 w-3" /> অফলাইন টেস্ট
              </span>
            )}
          </div>
        </div>
      </div>

      {canAccess && (
        <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t border-slate-100 sm:border-0 mt-2 sm:mt-0">
          <button
            onClick={() => onView(test)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[13px] font-bold rounded-lg transition-colors"
          >
            <Eye className="h-4 w-4" /> দেখুন
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-70"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "..." : "ডাউনলোড"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Scanner Modal ─────────────────────────────────────────────────────── */
const CORNER = "absolute w-6 h-6 border-white/80";

const Viewfinder = ({ locked }) => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <div className="relative w-[75%] aspect-square">
      <div className={`${CORNER} top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl`} />
      <div className={`${CORNER} top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl`} />
      <div className={`${CORNER} bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl`} />
      <div className={`${CORNER} bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl`} />
      {!locked ? (
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-[scanline_2.5s_linear_infinite]" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/20 rounded-2xl">
          <CheckCircle2 className="h-16 w-16 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
        </div>
      )}
    </div>
  </div>
);

function ScannerModal({ visible, onScan, onClose }) {
  const [error, setError] = useState(null);
  const [torch, setTorch] = useState(false);
  const [locked, setLocked] = useState(false);

  // Lock body scroll when modal opens
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
      setLocked(false);
      setError(null);
    } else {
      document.body.style.overflow = "unset";
      setTorch(false);
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [visible]);

  const handleResult = (results) => {
    if (locked || !results?.length) return;
    setLocked(true);
    setTimeout(() => {
      onScan(results[0].rawValue);
      onClose();
    }, 260);
  };

  const toggleTorch = () => setTorch((t) => !t);

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-200 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <style>{`
        @keyframes scanline { 0%,100% { top: 8%; opacity: .4; } 50% { top: 88%; opacity: 1; } }
      `}</style>
      <div
        className="relative w-full max-w-md bg-black rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2 text-white">
            <ScanLine className="h-5 w-5 text-indigo-300" />
            <span className="font-semibold text-sm">ইনভয়েস স্ক্যান করুন</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative aspect-square bg-black">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-center px-8">
              <p className="text-rose-300 text-sm font-medium">{error}</p>
            </div>
          ) : (
            <>
              <Scanner
                onScan={handleResult}
                onError={(err) =>
                  setError(err?.name === "NotAllowedError" ? "ক্যামেরার অনুমতি প্রয়োজন।" : "ক্যামেরা চালু করা যায়নি।")
                }
                formats={["qr_code"]}
                constraints={{
                  ...SCAN_CONSTRAINTS,
                  ...(torch ? { advanced: [{ torch: true }] } : {}),
                }}
                components={{ finder: false, torch: false, zoom: false }}
                styles={{ container: { width: "100%", height: "100%" } }}
                paused={locked || !visible}
                allowMultiple={false}
              />
              <Viewfinder locked={locked} />
            </>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-5 pb-6 pt-10">
          <p className="text-center text-[12px] text-white/60 mb-3">QR কোডটি ফ্রেমের মধ্যে রাখুন</p>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTorch}
              className={`flex-1 py-3 rounded-2xl text-sm font-bold backdrop-blur transition-all ${torch ? "bg-amber-400 text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {torch ? <ZapOff className="inline h-4 w-4 mr-1" /> : <Zap className="inline h-4 w-4 mr-1" />}
              {torch ? "টর্চ বন্ধ" : "টর্চ"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all"
            >
              বাতিল
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Main Page ─────────────────────────────────────────────────────────── */

export default function ScanInvoice() {
  const { labId: routeLabId, invoiceId: routeInvoiceId } = useParams();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMounted, setModalMounted] = useState(false);
  const [viewingTest, setViewingTest] = useState(null);
  const releaseTimer = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const openScanner = useCallback(() => {
    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
    setError("");
    setModalMounted(true);
    setModalOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setModalOpen(false);
    // Give exactly 300ms for CSS fade out animation, then immediately kill camera feed
    releaseTimer.current = setTimeout(() => setModalMounted(false), 300);
  }, []);

  useEffect(() => () => releaseTimer.current && clearTimeout(releaseTimer.current), []);
  useEffect(() => {
    if (routeLabId && routeInvoiceId) lookup(routeLabId, routeInvoiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLabId, routeInvoiceId]);

  async function lookup(labId, invoiceId) {
    setError("");
    if (!HEX24.test(labId) || !HEX24.test(invoiceId.trim())) {
      setError("আইডি সঠিক নয়।");
      return;
    }
    setLoading(true);
    try {
      const res = await scanService.scan(labId, invoiceId.trim());
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || "ইনভয়েস খুঁজে পাওয়া যায়নি।");
    } finally {
      setLoading(false);
    }
  }

  function handleScanResult(rawValue) {
    const parsed = parseScanPayload(rawValue);
    if (!parsed) {
      setError("QR কোডটি চেনা যায়নি।");
      return;
    }
    lookup(parsed.labId, parsed.invoiceId);
  }

  function reset() {
    setData(null);
    setError("");
    if (routeLabId || routeInvoiceId) navigate("/");
  }

  if (data) {
    const { patient, payment, tests, counts, doctor, labInfo } = data;

    return (
      <div className="min-h-screen bg-slate-50 font-sans pb-12">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <button
              onClick={reset}
              className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-900 tracking-tight">যাচাইকৃত রিপোর্ট</div>
              <div className="text-[11px] text-slate-500 font-mono tracking-wider">INV: {data.invoiceId}</div>
            </div>
            <div className="w-9"></div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6">
          {/* 1. Lab Header */}
          <LabHeader labInfo={labInfo} />

          {/* 2. Patient Info (Horizontal) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 mb-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="p-1.5 bg-indigo-50 rounded-md">
                <UserRound className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="text-[15px] font-bold text-slate-800">রোগীর তথ্য</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoItem icon={UserRound} label="নাম" value={patient.name} />
              <InfoItem
                icon={Activity}
                label="বয়স ও লিঙ্গ"
                value={patient.age != null ? `${patient.age} বছর · ${patient.gender}` : patient.gender}
              />
              <InfoItem icon={Phone} label="মোবাইল নম্বর" value={patient.contactNumber} />
              {doctor && (
                <InfoItem
                  icon={Stethoscope}
                  label="রেফার্ড বাই"
                  value={`${doctor.name}${doctor.degree ? ` (${doctor.degree})` : ""}`}
                />
              )}
            </div>
          </div>

          {/* 3. Reports Column */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 px-1 gap-3">
              <h3 className="text-lg font-bold text-slate-900">টেস্ট রিপোর্ট সমূহ</h3>

              {/* Online/Offline Counts */}
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-bold border border-indigo-100/50">
                  <span className="opacity-70">অনলাইন:</span> {counts.onlineCount}
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-bold border border-slate-200/50">
                  <span className="opacity-70">অফলাইন:</span> {counts.offlineCount}
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md font-bold border border-emerald-100/50">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="opacity-70">প্রস্তুত:</span> {counts.onlineCompletedCount}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {tests.map((t, i) => (
                <TestItem
                  key={t.testId ?? i}
                  test={{ ...t, labId: data.labId, invoiceId: data.invoiceObjectId }}
                  onView={(test) => setViewingTest({ testId: test.testId, name: test.name })}
                />
              ))}
            </div>
          </div>

          {/* 4. Payment Info (Horizontal Bottom Bar) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className={`p-3 rounded-xl ${payment.due > 0 ? "bg-amber-50" : "bg-emerald-50"}`}>
                <CreditCard className={`h-6 w-6 ${payment.due > 0 ? "text-amber-600" : "text-emerald-600"}`} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-800">পেমেন্ট স্ট্যাটাস</h3>
                <div
                  className={`text-sm font-semibold mt-0.5 ${payment.due > 0 ? "text-amber-600" : "text-emerald-600"}`}
                >
                  {payment.isFullyPaid ? "সম্পূর্ণ পরিশোধিত" : "বকেয়া রয়েছে"}
                </div>
              </div>
            </div>

            <div className="flex items-center w-full md:w-auto justify-between md:justify-end gap-6 bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-xl border border-slate-100 md:border-none">
              <div className="text-left md:text-right">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">মোট বিল</div>
                <div className="font-mono font-semibold text-slate-700 text-sm">৳ {payment.final}</div>
              </div>
              <div className="text-left md:text-right">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">জমা</div>
                <div className="font-mono font-semibold text-slate-700 text-sm">৳ {payment.paid}</div>
              </div>
              <div className="text-left md:text-right pl-4 border-l border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">বর্তমান বকেয়া</div>
                <div
                  className={`font-mono font-black text-lg leading-none ${payment.due > 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  ৳ {payment.due}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-3 bg-rose-50 text-rose-700 text-sm rounded-xl p-4 border border-rose-200">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          <div className="text-center mt-12 pb-6">
            <BrandMark />
          </div>
        </main>

        {viewingTest && (
          <ReportDrawer
            labId={data.labId}
            invoiceId={data.invoiceObjectId}
            testId={viewingTest.testId}
            testName={viewingTest.name}
            onClose={() => setViewingTest(null)}
          />
        )}
      </div>
    );
  }

  /* ── Idle / Scan View ───────────────────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center overflow-hidden relative">
      <div className="max-w-md w-full px-6 flex flex-col items-center justify-center text-center">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-indigo-300/40 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative h-32 w-32 rounded-3xl bg-white shadow-xl shadow-indigo-900/5 border border-slate-100 flex items-center justify-center rotate-3 transition-transform hover:rotate-0">
            {loading ? (
              <Loader2 className="h-14 w-14 text-indigo-500 animate-spin" strokeWidth={1.5} />
            ) : (
              <ScanLine className="h-14 w-14 text-indigo-600" strokeWidth={1.5} />
            )}
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
          {loading ? "যাচাই করা হচ্ছে..." : "রিপোর্ট স্ক্যান করুন"}
        </h1>
        <p className="text-slate-500 mb-10 max-w-sm text-[15px] leading-relaxed">
          {loading
            ? "অনুগ্রহ করে অপেক্ষা করুন, সার্ভার থেকে আপনার রিপোর্ট সংগ্রহ করা হচ্ছে।"
            : "আপনার ইনভয়েসে থাকা QR কোডটি স্ক্যান করে অনলাইনেই অরিজিনাল রিপোর্ট সংগ্রহ করুন।"}
        </p>
        <button
          onClick={openScanner}
          disabled={loading}
          className="w-full max-w-[280px] h-14 rounded-2xl bg-indigo-600 text-white font-bold text-lg shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-indigo-600/40 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ScanLine className="h-5 w-5" /> স্ক্যান শুরু করুন
        </button>
        <div className="mt-16">
          <BrandMark />
        </div>
      </div>
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-sm bg-rose-50 border border-rose-200 shadow-lg rounded-2xl px-5 py-4 flex items-center gap-3 text-sm text-rose-700 font-medium z-50">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}
      {modalMounted && <ScannerModal visible={modalOpen} onScan={handleScanResult} onClose={closeScanner} />}
    </div>
  );
}

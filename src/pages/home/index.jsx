/**
 * ScanInvoice
 * npm install @yudiel/react-qr-scanner
 *
 * Scanner UX notes (why this is fast):
 * - Camera permission/negotiation starts on pointerdown (before "click"
 *   fires), so the prompt appears the instant a finger touches the button.
 * - Constraints request 480p instead of default/max res — resolution
 *   negotiation is the single biggest chunk of camera-open latency.
 * - Torch is NOT part of the initial constraints (that forces a second
 *   negotiation on many devices); it's applied to the live track instead.
 * - The scanner modal stays mounted between opens (hidden + paused) for a
 *   short idle window so re-scanning after an error is instant. The
 *   underlying camera is only released after IDLE_RELEASE_MS of being closed.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import scanService from "../../api/scan";
import {
  ScanLine,
  X,
  Zap,
  ZapOff,
  CheckCircle2,
  User,
  Phone,
  Stethoscope,
  UserRound,
  FlaskConical,
  Wifi,
  WifiOff,
  Clock,
  Download,
  CreditCard,
  ArrowLeft,
  AlertTriangle,
  Loader2,
} from "lucide-react";

function parseScanPayload(raw) {
  const text = (raw || "").trim();
  const match = text.match(/([a-fA-F0-9]{24})\/([a-fA-F0-9]{24})\/?$/);
  if (match) return { labId: match[1], invoiceId: match[2] };
  return null;
}

const HEX24 = /^[a-fA-F0-9]{24}$/;
const IDLE_RELEASE_MS = 20_000; // keep camera warm this long after closing
const SCAN_CONSTRAINTS = {
  facingMode: "environment",
  width: { ideal: 480 },
  height: { ideal: 480 },
};

// ── Small presentational bits ───────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#1E4FA0]/60" strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 font-mono">{label}</div>
        <div className="truncate text-sm text-neutral-800">{value}</div>
      </div>
    </div>
  );
}

function TestRow({ test }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-neutral-200 py-2.5 last:border-none">
      <div className="flex min-w-0 items-center gap-2.5">
        {test.isOnline ? (
          <Wifi className="h-4 w-4 shrink-0 text-[#1E4FA0]" strokeWidth={1.75} />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
        )}
        <span className="truncate text-sm text-neutral-800">{test.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {test.isOnline &&
          (test.isCompleted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0F6E5C]/10 px-2 py-0.5 text-[11px] font-medium text-[#0F6E5C]">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
              রিপোর্ট প্রস্তুত
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <Clock className="h-3 w-3" strokeWidth={2} />
              প্রক্রিয়াধীন
            </span>
          ))}
      </div>
    </div>
  );
}

// ── Scanner modal ────────────────────────────────────────────────────────
// Overlay camera scanner, styled to LabPilot Pro's teal/ledger palette.
// visible = shown right now; mounted (controlled by parent) = kept alive
// so a second scan (e.g. after an invalid code) doesn't re-negotiate camera.

const CORNER = "absolute w-7 h-7 border-white/90";

const Viewfinder = ({ locked }) => (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <div className="relative w-[68%] aspect-square">
      <div className={`${CORNER} top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl`} />
      <div className={`${CORNER} top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl`} />
      <div className={`${CORNER} bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl`} />
      <div className={`${CORNER} bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl`} />

      {!locked ? (
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#3FD6B8] to-transparent shadow-[0_0_12px_2px_rgba(63,214,184,0.8)] animate-[scanline_2.2s_ease-in-out_infinite]" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[#0F6E5C]/20">
          <CheckCircle2 className="h-14 w-14 text-[#3FD6B8] drop-shadow-[0_0_10px_rgba(63,214,184,0.9)] animate-[pop_0.3s_ease]" />
        </div>
      )}
    </div>
  </div>
);

function ScannerModal({ visible, onScan, onClose }) {
  const [error, setError] = useState(null);
  const [torch, setTorch] = useState(false);
  const [locked, setLocked] = useState(false);

  // Reset per-open UI state (not the camera itself) whenever it's shown again
  useEffect(() => {
    if (visible) {
      setLocked(false);
      setError(null);
    } else {
      setTorch(false);
    }
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
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 transition-opacity duration-150 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <style>{`
        @keyframes scanline { 0%,100% { top: 6%; opacity: .3; } 50% { top: 92%; opacity: 1; } }
        @keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.5)] animate-[fadeUp_0.25s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-5 pb-8 pt-5">
          <div className="flex items-center gap-2 text-white">
            <ScanLine className="h-4 w-4 text-[#3FD6B8]" strokeWidth={1.75} />
            <span className="text-sm font-semibold tracking-tight">ইনভয়েস স্ক্যান করুন</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="relative aspect-square">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black px-8 text-center">
              <p className="text-xs font-medium text-rose-300">{error}</p>
            </div>
          ) : (
            <>
              <Scanner
                onScan={handleResult}
                onError={(err) =>
                  setError(
                    err?.name === "NotAllowedError"
                      ? "ক্যামেরা অনুমতি প্রয়োজন। ব্রাউজার সেটিংস থেকে অনুমতি দিন।"
                      : "ক্যামেরা চালু করা যায়নি।",
                  )
                }
                formats={["qr_code"]}
                constraints={SCAN_CONSTRAINTS}
                components={{ finder: false, torch: false, zoom: false }}
                styles={{ container: { width: "100%", height: "100%" } }}
                paused={locked || !visible}
                allowMultiple={false}
                // yudiel scanner applies this to the live track via
                // applyConstraints internally rather than re-opening the
                // stream, so flipping it is cheap.
                torch={torch}
              />
              <Viewfinder locked={locked} />
            </>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-8">
          <p className="mb-3 text-center text-[11px] font-medium text-white/60">QR কোডটি ফ্রেমের মধ্যে রাখুন</p>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTorch}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold backdrop-blur transition-all ${
                torch ? "bg-amber-400 text-black" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {torch ? (
                <ZapOff className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <Zap className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {torch ? "টর্চ বন্ধ" : "টর্চ"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-2xl bg-white py-2.5 text-xs font-bold text-black transition-all hover:bg-white/90"
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

// ── Main component ──────────────────────────────────────────────────────

export default function ScanInvoice({ onDownloadReports }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMounted, setModalMounted] = useState(false); // keeps modal (and its camera) alive between opens
  const releaseTimer = useRef(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
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

  // Fires on pointerdown/touchstart — before "click" — so camera
  // permission/negotiation starts as early as physically possible.
  const warmStart = useCallback(() => openScanner(), [openScanner]);

  const closeScanner = useCallback(() => {
    setModalOpen(false);
    // Keep the camera stream alive briefly in case the user scans again
    // (e.g. after an invalid code). Fully unmount — and release the
    // camera — only after it's been idle for a while.
    releaseTimer.current = setTimeout(() => setModalMounted(false), IDLE_RELEASE_MS);
  }, []);

  useEffect(() => () => releaseTimer.current && clearTimeout(releaseTimer.current), []);

  // ── Lookup ────────────────────────────────────────────────────────────
  async function lookup(labId, invoiceId) {
    setError("");
    if (!HEX24.test(labId)) {
      setError("ল্যাব আইডি সঠিক নয়।");
      return;
    }
    const cleanInvoiceId = invoiceId.trim();
    if (!HEX24.test(cleanInvoiceId)) {
      setError("ইনভয়েস আইডি সঠিক নয়।");
      return;
    }

    setLoading(true);
    try {
      const res = await scanService.scan(labId, cleanInvoiceId);
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

  async function handleDownload() {
    if (!data) return;
    setDownloading(true);
    try {
      if (onDownloadReports) {
        await onDownloadReports(data);
      } else {
        window.open(`/api/invoice/${data.invoiceId}/reports/download`, "_blank", "noopener,noreferrer");
      }
    } finally {
      setDownloading(false);
    }
  }

  function reset() {
    setData(null);
    setError("");
  }

  // ── Result view ──────────────────────────────────────────────────────
  if (data) {
    const { patient, payment, tests, counts, referrer, doctor, canDownloadReports } = data;
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-[#FAF9F6] font-sans">
        <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
          <button
            onClick={reset}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <div>
            <div className="font-mono text-xs text-neutral-500">ইনভয়েস #{data.invoiceId}</div>
            <div className="text-sm font-semibold text-neutral-900">যাচাইকৃত রিপোর্ট</div>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Patient card */}
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-[#0F6E5C]">
              <User className="h-4 w-4" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold">রোগীর তথ্য</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              <InfoRow icon={User} label="নাম" value={patient.name} />
              <InfoRow
                icon={UserRound}
                label="বয়স / লিঙ্গ"
                value={patient.age != null ? `${patient.age} বছর · ${patient.gender}` : patient.gender}
              />
              <InfoRow icon={Phone} label="মোবাইল" value={patient.contactNumber} />
              {doctor && (
                <InfoRow
                  icon={Stethoscope}
                  label="ডাক্তার"
                  value={`${doctor.name}${doctor.degree ? ` (${doctor.degree})` : ""}`}
                />
              )}
              {referrer && <InfoRow icon={UserRound} label="রেফারার" value={referrer.name} />}
            </div>
          </section>

          {/* Payment card */}
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[#0F6E5C]">
              <CreditCard className="h-4 w-4" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold">পেমেন্ট তথ্য</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-sm">
              <div className="rounded-lg bg-neutral-50 p-2.5">
                <div className="text-[11px] uppercase text-neutral-500">মোট</div>
                <div className="text-neutral-900">৳{payment.final}</div>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2.5">
                <div className="text-[11px] uppercase text-neutral-500">জমা</div>
                <div className="text-neutral-900">৳{payment.paid}</div>
              </div>
              <div className={`rounded-lg p-2.5 ${payment.due > 0 ? "bg-red-50" : "bg-[#0F6E5C]/10"}`}>
                <div className="text-[11px] uppercase text-neutral-500">বকেয়া</div>
                <div className={payment.due > 0 ? "text-red-600" : "text-[#0F6E5C]"}>৳{payment.due}</div>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2.5">
                <div className="text-[11px] uppercase text-neutral-500">মাধ্যম</div>
                <div className="text-neutral-900">{payment.paymentMode}</div>
              </div>
            </div>
            <div className="mt-3">
              {payment.isFullyPaid ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0F6E5C]/10 px-2.5 py-1 text-xs font-medium text-[#0F6E5C]">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  সম্পূর্ণ পরিশোধিত
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                  বকেয়া আছে
                </span>
              )}
            </div>
          </section>

          {/* Tests card */}
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#0F6E5C]">
                <FlaskConical className="h-4 w-4" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold">টেস্ট ({counts.testCount})</h2>
              </div>
              <span className="font-mono text-[11px] text-neutral-500">
                অনলাইন {counts.onlineCompletedCount}/{counts.onlineCount} · অফলাইন {counts.offlineCount}
              </span>
            </div>
            <div>
              {tests.map((t, i) => (
                <TestRow key={i} test={t} />
              ))}
            </div>
          </section>
        </div>

        {/* Download action */}
        <div className="border-t border-neutral-200 bg-white p-4">
          {canDownloadReports ? (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F6E5C] py-3 text-sm font-semibold text-white transition hover:bg-[#0c5a4a] disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <Download className="h-4 w-4" strokeWidth={2} />
              )}
              রিপোর্ট ডাউনলোড করুন
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-3 text-xs text-neutral-500">
              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!payment.isFullyPaid
                ? "সম্পূর্ণ পেমেন্ট না হওয়া পর্যন্ত রিপোর্ট ডাউনলোড করা যাবে না।"
                : counts.onlineCount === 0
                  ? "এই ইনভয়েসে কোনো অনলাইন রিপোর্ট নেই।"
                  : "সব রিপোর্ট এখনও প্রস্তুত হয়নি।"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Idle view: scan button + modal ──────────────────────────────────
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-[#FAF9F6] font-sans">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-[#0F6E5C]" strokeWidth={1.75} />
          <h1 className="text-sm font-semibold text-neutral-900">ইনভয়েস স্ক্যান করুন</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#0F6E5C]/10">
          {loading ? (
            <Loader2 className="h-9 w-9 animate-spin text-[#0F6E5C]" strokeWidth={1.5} />
          ) : (
            <ScanLine className="h-10 w-10 text-[#0F6E5C]" strokeWidth={1.5} />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-800">
            {loading ? "ইনভয়েস যাচাই করা হচ্ছে…" : "ইনভয়েসের QR কোড স্ক্যান করুন"}
          </p>
          {!loading && <p className="text-xs text-neutral-500">ক্যামেরা চালু করতে নিচের বাটনে চাপুন</p>}
        </div>
        <button
          onPointerDown={warmStart}
          onClick={openScanner}
          disabled={loading}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-[#0F6E5C] py-3 text-sm font-semibold text-white transition hover:bg-[#0c5a4a] disabled:opacity-60"
        >
          <ScanLine className="h-4 w-4" strokeWidth={2} />
          স্ক্যান শুরু করুন
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-600">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {error}
        </div>
      )}

      {modalMounted && <ScannerModal visible={modalOpen} onScan={handleScanResult} onClose={closeScanner} />}
    </div>
  );
}

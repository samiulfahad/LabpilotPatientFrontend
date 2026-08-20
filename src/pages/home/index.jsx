import { useState } from "react";
import axios from "axios";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  CameraOff,
  ScanLine,
  User,
  Phone,
  Stethoscope,
  UserRound,
  FlaskConical,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  Download,
  CreditCard,
  ArrowLeft,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// ── Config ───────────────────────────────────────────────────────────────
// Point this at your API base — kept as a bare axios instance so the parent
// app can swap it out (baseURL, auth headers, etc.) without editing this file.
const api = axios.create({ baseURL: "/api" });

// QR codes printed on invoices encode a URL like:
//   https://scan.labpilotpro.com/<labId>/<invoiceId>
// where both labId and invoiceId are 24-char Mongo ObjectId strings.
// This pulls them out of that shape, or falls back to raw
// "<labId>/<invoiceId>" text.
function parseScanPayload(raw) {
  const text = (raw || "").trim();
  const match = text.match(/([a-fA-F0-9]{24})\/([a-fA-F0-9]{24})\/?$/);
  if (match) return { labId: match[1], invoiceId: match[2] };
  return null;
}

const HEX24 = /^[a-fA-F0-9]{24}$/;

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

// ── Main component ──────────────────────────────────────────────────────

export default function ScanInvoice({ onDownloadReports }) {
  const [scanning, setScanning] = useState(false); // has the camera view been opened?
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [scanLocked, setScanLocked] = useState(false); // prevents duplicate lookups mid-scan

  // ── Lookup ────────────────────────────────────────────────────────────
  async function lookup(labId, invoiceId) {
    setError("");
    if (!HEX24.test(labId)) {
      setError("ল্যাব আইডি সঠিক নয়।");
      setScanLocked(false);
      return;
    }
    const cleanInvoiceId = invoiceId.trim();
    if (!HEX24.test(cleanInvoiceId)) {
      setError("ইনভয়েস আইডি সঠিক নয়।");
      setScanLocked(false);
      return;
    }

    setLoading(true);
    try {
      const res = await scanService.scan(labId, cleanInvoiceId);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || "ইনভয়েস খুঁজে পাওয়া যায়নি।");
      setScanLocked(false);
    } finally {
      setLoading(false);
    }
  }

  // ── @yudiel/react-qr-scanner callbacks ──────────────────────────────
  function handleScan(results) {
    if (scanLocked || data || !results?.length) return;
    const parsed = parseScanPayload(results[0].rawValue);
    if (!parsed) return;
    setScanLocked(true);
    lookup(parsed.labId, parsed.invoiceId);
  }

  function handleScanError(err) {
    setCameraError(
      err?.name === "NotAllowedError"
        ? "ক্যামেরা অনুমতি প্রয়োজন। ব্রাউজার সেটিংস থেকে অনুমতি দিন।"
        : "ক্যামেরা চালু করা যায়নি।",
    );
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
    setScanLocked(false);
    setCameraError("");
    setScanning(false);
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

  // ── Idle view: just a scan button ───────────────────────────────────
  if (!scanning) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-[#FAF9F6] font-sans">
        <header className="border-b border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-[#0F6E5C]" strokeWidth={1.75} />
            <h1 className="text-sm font-semibold text-neutral-900">ইনভয়েস স্ক্যান করুন</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0F6E5C]/10">
            <ScanLine className="h-10 w-10 text-[#0F6E5C]" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-800">ইনভয়েসের QR কোড স্ক্যান করুন</p>
            <p className="text-xs text-neutral-500">ক্যামেরা চালু করতে নিচের বাটনে চাপুন</p>
          </div>
          <button
            onClick={() => {
              setCameraError("");
              setScanning(true);
            }}
            className="flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-[#0F6E5C] py-3 text-sm font-semibold text-white transition hover:bg-[#0c5a4a]"
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
      </div>
    );
  }

  // ── Camera view ──────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-[#FAF9F6] font-sans">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <button
          onClick={reset}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-[#0F6E5C]" strokeWidth={1.75} />
          <h1 className="text-sm font-semibold text-neutral-900">ইনভয়েস স্ক্যান করুন</h1>
        </div>
      </header>

      <div className="flex-1 px-4 py-4">
        <div className="relative overflow-hidden rounded-xl border border-neutral-200 bg-black aspect-square">
          <Scanner
            onScan={handleScan}
            onError={handleScanError}
            constraints={{ facingMode: "environment" }}
            formats={["qr_code"]}
            components={{ finder: false, torch: true }}
            styles={{
              container: { width: "100%", height: "100%" },
              video: { width: "100%", height: "100%", objectFit: "cover" },
            }}
          />
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-[#0F6E5C]/80" />
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center">
              <CameraOff className="h-6 w-6 text-white/70" strokeWidth={1.5} />
              <p className="text-xs text-white/80">{cameraError}</p>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-6 w-6 animate-spin text-white" strokeWidth={2} />
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

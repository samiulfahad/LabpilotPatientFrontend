import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  FlaskConical,
  User,
  UserRound,
  Phone,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import scanService from "../../api/scan";
import { ScanReportPDFDocument } from "./ScanReportPDF";

const formatDate = (val) => {
  if (!val) return "";
  const d = new Date(val);
  return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function parseRange(ref) {
  if (!ref) return null;
  const m = ref.match(/^([\d.]+)\s*[–\-]\s*([\d.]+)$/);
  if (!m) return null;
  return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
}
const fmtN = (n) =>
  n
    .toFixed(3)
    .replace(/\.?0+$/, "")
    .replace(/^0\./, ".");
const fmtLow = (n) => n.toFixed(3).replace(/\.?0+$/, "");

function getStatusInfo(value, ref) {
  const n = parseFloat(value);
  if (isNaN(n) || !ref) return null;
  const r = parseRange(ref);
  if (!r) return null;
  if (n > r.max) return { status: "high", label: `বেশি (${fmtN(n / r.max)}x)` };
  if (n < r.min)
    return r.min === 0 ? { status: "low", label: "কম" } : { status: "low", label: `কম (${fmtLow(n / r.min)}x)` };
  return { status: "normal", label: "স্বাভাবিক" };
}

const isResultField = (f) => f && typeof f === "object" && (Boolean(f.referenceRange) || Boolean(f.unit));
const getSectionEntries = (sec) => Object.entries(sec).filter(([k]) => k !== "__showTitle");

const STATUS_STYLE = {
  high: { cls: "bg-red-50 text-red-700 border-red-200", Icon: TrendingUp },
  low: { cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: TrendingDown },
  normal: { cls: "bg-[#0F6E5C]/10 text-[#0F6E5C] border-[#0F6E5C]/20", Icon: CheckCircle2 },
};

function StatusPill({ value, ref }) {
  const info = getStatusInfo(value, ref);
  if (!info) return <span className="text-xs text-neutral-300">—</span>;
  const cfg = STATUS_STYLE[info.status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}
    >
      <cfg.Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
      {info.label}
    </span>
  );
}

function ResultRow({ name, field, hasUnits }) {
  const value = String(field.value ?? "");
  const ref = field.referenceRange || "";
  const info = getStatusInfo(value, ref);
  const valColor =
    info?.status === "high" ? "text-red-600" : info?.status === "low" ? "text-amber-700" : "text-neutral-900";
  return (
    <tr>
      <td className="border-b border-neutral-100 py-2.5 pl-4 pr-3 text-sm text-neutral-600">{name}</td>
      <td className={`border-b border-neutral-100 px-3 py-2.5 font-mono text-sm font-bold ${valColor}`}>{value}</td>
      {hasUnits && (
        <td className="border-b border-neutral-100 px-3 py-2.5 text-[10px] font-semibold uppercase text-neutral-400">
          {field.unit || "—"}
        </td>
      )}
      <td className="border-b border-neutral-100 px-3 py-2.5 font-mono text-xs text-neutral-400">{ref || "—"}</td>
      <td className="border-b border-neutral-100 py-2.5 pl-3 pr-4">
        <StatusPill value={value} ref={ref} />
      </td>
    </tr>
  );
}

function PlainRow({ name, field, colSpan }) {
  const val = Array.isArray(field.value) ? field.value.join(", ") : String(field.value ?? "—");
  return (
    <tr>
      <td className="border-b border-neutral-100 py-2.5 pl-4 pr-3 text-sm text-neutral-400">{name}</td>
      <td
        className="border-b border-neutral-100 px-3 py-2.5 pr-4 text-sm font-semibold text-neutral-700"
        colSpan={colSpan}
      >
        {val || "—"}
      </td>
    </tr>
  );
}

function ReportSection({ sectionName, sectionData, showHeader }) {
  const entries = getSectionEntries(sectionData);
  const resultEntries = entries.filter(([, v]) => isResultField(v));
  const plainEntries = entries.filter(([, v]) => !isResultField(v));
  const hasUnits = resultEntries.some(([, v]) => Boolean(v.unit));

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-neutral-200">
      {showHeader && (
        <div className="bg-[#0F6E5C] px-4 py-2.5">
          <span className="text-sm font-semibold text-white">{sectionName}</span>
        </div>
      )}
      {resultEntries.length > 0 && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="w-[34%] pl-4 pr-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                প্যারামিটার
              </th>
              <th className="w-[16%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                ফলাফল
              </th>
              {hasUnits && (
                <th className="w-[12%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  একক
                </th>
              )}
              <th className="w-[24%] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                রেফারেন্স
              </th>
              <th className="w-[18%] pl-3 pr-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                স্ট্যাটাস
              </th>
            </tr>
          </thead>
          <tbody>
            {resultEntries.map(([n, f]) => (
              <ResultRow key={n} name={n} field={f} hasUnits={hasUnits} />
            ))}
          </tbody>
        </table>
      )}
      {plainEntries.length > 0 && (
        <table className={`w-full border-collapse ${resultEntries.length > 0 ? "border-t border-neutral-200" : ""}`}>
          <tbody>
            {plainEntries.map(([n, f]) => (
              <PlainRow key={n} name={n} field={f} colSpan={hasUnits ? 4 : 3} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ReportDownload() {
  const { labId, invoiceId, testId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [payload, setPayload] = useState(null); // { report, testName, invoiceId, patient, referrer, labInfo }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    scanService
      .getReport(labId, invoiceId, testId)
      .then((res) => {
        if (!cancelled) setPayload(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || "রিপোর্ট লোড করা যায়নি।");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labId, invoiceId, testId]);

  const goBack = () => navigate(`/${labId}/${invoiceId}`);

  const handleDownload = async () => {
    if (!payload) return;
    setDownloading(true);
    try {
      const patientForPdf = {
        name: payload.patient?.name,
        age: payload.patient?.age != null ? `${payload.patient.age} yrs` : "",
        gender: payload.patient?.gender,
        contactNumber: payload.patient?.contactNumber,
        referredBy: payload.referrer?.name ?? "",
        sampleDate: formatDate(payload.report?.sampleCollectionDate),
        reportDate: formatDate(payload.report?.reportDate),
      };
      const blob = await pdf(
        <ScanReportPDFDocument
          report={payload.report}
          reportName={payload.testName}
          invoiceId={payload.invoiceId}
          patient={patientForPdf}
          labInfo={payload.labInfo}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(payload.testName || "report").replace(/\s+/g, "_")}_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("PDF তৈরি করা সম্ভব হয়নি।");
    } finally {
      setDownloading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-3 bg-[#FAF9F6] font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F6E5C]" strokeWidth={1.75} />
        <p className="text-sm text-neutral-500">রিপোর্ট লোড করা হচ্ছে…</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (error || !payload) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-[#FAF9F6] font-sans">
        <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
          <button
            onClick={goBack}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <div className="text-sm font-semibold text-neutral-900">রিপোর্ট</div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500" strokeWidth={1.5} />
          <p className="text-sm text-red-600">{error || "রিপোর্ট পাওয়া যায়নি।"}</p>
        </div>
      </div>
    );
  }

  const { report, testName, invoiceId: displayInvoiceId, patient, referrer, labInfo } = payload;
  const sections = Object.entries(report).filter(
    ([key, val]) =>
      key !== "_id" &&
      key !== "name" &&
      key !== "sampleCollectionDate" &&
      key !== "reportDate" &&
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      !val.$oid,
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col bg-[#FAF9F6] font-sans">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <button
          onClick={goBack}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <div className="min-w-0">
          <div className="font-mono text-xs text-neutral-500">ইনভয়েস #{displayInvoiceId}</div>
          <div className="truncate text-sm font-semibold text-neutral-900">{testName}</div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* Lab header */}
        {labInfo?.name && (
          <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0F6E5C]">
                <FlaskConical className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-neutral-900">{labInfo.name}</p>
                {labInfo.tagline && (
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400">{labInfo.tagline}</p>
                )}
                {labInfo.address && <p className="mt-1 text-[11px] text-neutral-400">{labInfo.address}</p>}
              </div>
            </div>
          </section>
        )}

        {/* Patient card */}
        <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-[#0F6E5C]">
            <User className="h-4 w-4" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold">রোগীর তথ্য</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            <div className="flex items-start gap-3 py-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-[#1E4FA0]/60" strokeWidth={1.75} />
              <div className="min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-wide text-neutral-500">নাম</div>
                <div className="truncate text-sm text-neutral-800">{patient?.name || "—"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#1E4FA0]/60" strokeWidth={1.75} />
              <div className="min-w-0">
                <div className="font-mono text-[11px] uppercase tracking-wide text-neutral-500">বয়স / লিঙ্গ</div>
                <div className="truncate text-sm text-neutral-800">
                  {patient?.age != null ? `${patient.age} বছর · ${patient.gender}` : patient?.gender || "—"}
                </div>
              </div>
            </div>
            {patient?.contactNumber && (
              <div className="flex items-start gap-3 py-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#1E4FA0]/60" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-wide text-neutral-500">মোবাইল</div>
                  <div className="truncate text-sm text-neutral-800">{patient.contactNumber}</div>
                </div>
              </div>
            )}
            {referrer?.name && (
              <div className="flex items-start gap-3 py-2">
                <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#1E4FA0]/60" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-wide text-neutral-500">রেফারার</div>
                  <div className="truncate text-sm text-neutral-800">{referrer.name}</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Report sections */}
        {sections.map(([sectionName, sectionData]) => (
          <ReportSection
            key={sectionName}
            sectionName={sectionName}
            sectionData={sectionData}
            showHeader={sectionData.__showTitle !== false}
          />
        ))}
      </div>

      <div className="border-t border-neutral-200 bg-white p-4">
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
      </div>
    </div>
  );
}

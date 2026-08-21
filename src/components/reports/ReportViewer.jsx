// ReportViewer.jsx — A4 only, always shows full lab header + footer.
import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  FlaskConical,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Stethoscope,
  Hash,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  Share2,
  Printer,
  Download,
  ChevronDown,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  User,
} from "lucide-react";
import { ReportPDFDocument } from "./ReportPDF";

const EMPTY_PATIENT = {
  name: "",
  age: "",
  gender: "",
  contact: "",
  referredBy: "",
  sampleDate: "",
  reportDate: "",
};

const REPORT_META_KEYS = new Set(["_id", "name", "reportDate", "sampleCollectionDate"]);

function parseRange(ref) {
  if (!ref) return null;
  const m = ref.match(/^([\d.]+)\s*[–\-]\s*([\d.]+)$/);
  if (!m) return null;
  return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
}

function fmt(num) {
  return num
    .toFixed(3)
    .replace(/\.?0+$/, "")
    .replace(/^0\./, ".");
}
function fmtLow(num) {
  return num.toFixed(3).replace(/\.?0+$/, "");
}

function getStatusInfo(value, ref) {
  const n = parseFloat(value);
  if (isNaN(n) || !ref) return null;
  const r = parseRange(ref);
  if (!r) return null;
  if (n > r.max) return { status: "high", label: `Higher (${fmt(n / r.max)}x)` };
  if (n < r.min) {
    if (r.min === 0) return { status: "low", label: "Low" };
    return { status: "low", label: `Lower (${fmtLow(n / r.min)}x)` };
  }
  return { status: "normal", label: "Normal" };
}

function getStatus(value, ref) {
  const info = getStatusInfo(value, ref);
  return info ? info.status : null;
}

function isResultField(field) {
  if (!field || typeof field !== "object") return false;
  return Boolean(field.referenceRange) || Boolean(field.unit);
}

function getSectionEntries(sectionData) {
  return Object.entries(sectionData).filter(([key]) => key !== "__showTitle");
}

function StatusPill({ value, ref }) {
  const info = getStatusInfo(value, ref);
  if (!info) return <span className="text-xs text-slate-300">—</span>;
  const cfg = {
    normal: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    low: { cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: TrendingDown },
    high: { cls: "bg-red-50 text-red-700 border-red-200", Icon: TrendingUp },
  }[info.status];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 border whitespace-nowrap ${cfg.cls}`}
    >
      <cfg.Icon className="w-2.5 h-2.5 flex-shrink-0" />
      {info.label}
    </span>
  );
}

const ROW_STYLE = {
  high: { row: "bg-red-50/40", value: "text-red-700" },
  low: { row: "bg-amber-50/40", value: "text-amber-800" },
  normal: { row: "", value: "text-slate-900" },
};

function ResultRow({ name, field, hasUnits }) {
  const value = String(field.value ?? "");
  const unit = field.unit || "";
  const ref = field.referenceRange || "";
  const info = getStatusInfo(value, ref);
  const style = info ? (ROW_STYLE[info.status] ?? {}) : {};
  return (
    <tr className={style.row ?? ""}>
      <td className="pl-4 pr-3 py-2.5 text-sm text-slate-600 border-b border-slate-100">{name}</td>
      <td
        className={`px-3 py-2.5 text-sm font-bold tabular-nums border-b border-slate-100 ${style.value ?? "text-slate-900"}`}
      >
        {value}
      </td>
      {hasUnits && (
        <td className="px-3 py-2.5 text-[10px] font-semibold text-slate-400 uppercase border-b border-slate-100">
          {unit || <span className="text-slate-200">—</span>}
        </td>
      )}
      <td className="px-3 py-2.5 text-xs text-slate-400 border-b border-slate-100 tabular-nums font-mono">
        {ref || <span className="text-slate-200">—</span>}
      </td>
      <td className="px-3 pr-4 py-2.5 border-b border-slate-100">
        <StatusPill value={value} ref={ref} />
      </td>
    </tr>
  );
}

function PlainRow({ name, field, colSpan }) {
  const val = Array.isArray(field.value) ? field.value.join(", ") : String(field.value ?? "—");
  return (
    <tr className="odd:bg-white even:bg-slate-50/50">
      <td className="pl-4 pr-3 py-2.5 text-sm text-slate-400 border-b border-slate-100">{name}</td>
      <td className="px-3 pr-4 py-2.5 text-sm font-semibold text-slate-700 border-b border-slate-100" colSpan={colSpan}>
        {val || "—"}
      </td>
    </tr>
  );
}

function Section({ sectionName, sectionData, showHeader }) {
  const [collapsed, setCollapsed] = useState(false);
  const entries = getSectionEntries(sectionData);
  const resultEntries = entries.filter(([, v]) => isResultField(v));
  const plainEntries = entries.filter(([, v]) => !isResultField(v));
  const hasUnits = resultEntries.some(([, v]) => Boolean(v.unit));

  const tableBody = (
    <>
      {resultEntries.length > 0 && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="pl-4 pr-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[34%]">
                Parameter
              </th>
              <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[16%]">
                Result
              </th>
              {hasUnits && (
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[12%]">
                  Unit
                </th>
              )}
              <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[24%]">
                Ref. Range
              </th>
              <th className="px-3 pr-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[18%]">
                Status
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
        <table className={`w-full border-collapse ${resultEntries.length > 0 ? "border-t border-slate-200" : ""}`}>
          <tbody>
            {plainEntries.map(([n, f]) => (
              <PlainRow key={n} name={n} field={f} colSpan={hasUnits ? 4 : 3} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );

  if (!showHeader) {
    return <div className="overflow-hidden border border-slate-200 mb-2">{tableBody}</div>;
  }

  return (
    <div className="overflow-hidden border border-slate-200 mb-2">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        <span className="text-sm font-semibold text-white tracking-wide">{sectionName}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-300 font-medium">
            {entries.length} param{entries.length !== 1 ? "s" : ""}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-300 transition-transform flex-shrink-0 ${collapsed ? "" : "rotate-180"}`}
          />
        </div>
      </button>
      {!collapsed && <div>{tableBody}</div>}
    </div>
  );
}

function SummaryStrip({ sections }) {
  let normal = 0,
    low = 0,
    high = 0;
  sections.forEach(([, sec]) => {
    getSectionEntries(sec).forEach(([, field]) => {
      if (!isResultField(field)) return;
      const st = getStatus(field.value, field.referenceRange);
      if (st === "normal") normal++;
      else if (st === "low") low++;
      else if (st === "high") high++;
    });
  });
  const total = normal + low + high;
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-1 text-xs">
      <ClipboardList className="w-3 h-3 text-slate-400 mr-1 flex-shrink-0" />
      <span className="text-slate-500 font-medium">{total} parameters:</span>
      <span className="font-bold text-emerald-600 ml-1">{normal} Normal</span>
      {low > 0 && (
        <>
          <span className="text-slate-300 mx-0.5">·</span>
          <span className="font-bold text-amber-600">{low} Low</span>
        </>
      )}
      {high > 0 && (
        <>
          <span className="text-slate-300 mx-0.5">·</span>
          <span className="font-bold text-red-600">{high} High</span>
        </>
      )}
    </div>
  );
}

function PatientGrid({ patient }) {
  const allFields = [
    { label: "Patient Name", value: patient.name, Icon: User },
    { label: "Age / Gender", value: [patient.age, patient.gender].filter(Boolean).join(" · "), Icon: Hash },
    { label: "Contact", value: patient.contact, Icon: Phone },
    ...(patient.sampleDate ? [{ label: "Sample Date", value: patient.sampleDate, Icon: Calendar }] : []),
    ...(patient.reportDate ? [{ label: "Report Date", value: patient.reportDate, Icon: Calendar }] : []),
  ];
  const colCount = allFields.length;
  const Cell = ({ label, value, Icon }) => (
    <div className="bg-white px-3 py-2.5">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-xs font-semibold text-slate-800 truncate">{value || "—"}</p>
    </div>
  );
  return (
    <div className="border-b border-slate-200">
      <div
        className="grid gap-px bg-slate-200 border-b border-slate-200"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {allFields.map((f) => (
          <Cell key={f.label} {...f} />
        ))}
      </div>
      <div className="bg-white px-3 py-2 flex items-center gap-3">
        <Stethoscope className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Referred By</span>
        <span className="text-xs font-semibold text-slate-800">{patient.referredBy || "—"}</span>
      </div>
    </div>
  );
}

// ── Print HTML builder — A4 only, full header/footer always ────────────────
function buildPrintHTML({ reportName, shortId, patient, labInfo, sections }) {
  const statusInfo = (value, ref) => {
    const n = parseFloat(value);
    if (isNaN(n) || !ref) return null;
    const m = ref.match(/^([\d.]+)\s*[–\-]\s*([\d.]+)$/);
    if (!m) return null;
    const min = parseFloat(m[1]),
      max = parseFloat(m[2]);
    const f = (x) =>
      x
        .toFixed(3)
        .replace(/\.?0+$/, "")
        .replace(/^0\./, ".");
    const fL = (x) => x.toFixed(3).replace(/\.?0+$/, "");
    if (n > max) return { status: "high", label: `Higher (${f(n / max)}x)` };
    if (n < min) {
      if (min === 0) return { status: "low", label: "Low" };
      return { status: "low", label: `Lower (${fL(n / min)}x)` };
    }
    return { status: "normal", label: "Normal" };
  };

  const pillColor = (st) => ({ normal: "#166534", low: "#92400e", high: "#991b1b" })[st] || "#64748b";
  const pillBg = (st) => ({ normal: "#f0fdf4", low: "#fffbeb", high: "#fef2f2" })[st] || "white";
  const pillBdr = (st) => ({ normal: "#bbf7d0", low: "#fde68a", high: "#fecaca" })[st] || "#e2e8f0";
  const rowBg = (st) => ({ normal: "white", low: "#fffdf5", high: "#fff8f8" })[st] || "white";
  const valColor = (st) => ({ normal: "#111827", low: "#92400e", high: "#991b1b" })[st] || "#111827";

  const renderSection = (sectionName, sectionData) => {
    const showHeader = sectionData.__showTitle !== false;
    const entries = getSectionEntries(sectionData);
    const resultEntries = entries.filter(([, v]) => isResultField(v));
    const plainEntries = entries.filter(([, v]) => !isResultField(v));
    const hasUnits = resultEntries.some(([, v]) => Boolean(v.unit));

    const unitHeader = hasUnits
      ? `<th style="padding:5px 10px;text-align:left;font-size:8.5px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;width:11%;">Unit</th>`
      : "";

    const resultRows = resultEntries
      .map(([name, field]) => {
        const ref = field.referenceRange || "";
        const info = statusInfo(field.value, ref);
        const st = info ? info.status : null;
        return `<tr style="background:${rowBg(st)};">
        <td style="padding:6px 10px;font-size:11.5px;color:#374151;border-bottom:1px solid #f1f5f9;">${name}</td>
        <td style="padding:6px 10px;font-size:11.5px;font-weight:700;color:${valColor(st)};border-bottom:1px solid #f1f5f9;font-family:monospace;">${field.value}</td>
        ${hasUnits ? `<td style="padding:6px 10px;font-size:9px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #f1f5f9;">${field.unit || "—"}</td>` : ""}
        <td style="padding:6px 10px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f1f5f9;font-family:monospace;">${ref || "—"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:8.5px;font-weight:700;padding:2px 7px;background:${pillBg(st)};color:${pillColor(st)};border:1px solid ${pillBdr(st)};">${info ? info.label : "—"}</span>
        </td>
      </tr>`;
      })
      .join("");

    const plainRows = plainEntries
      .map(([name, field]) => {
        const val = Array.isArray(field.value) ? field.value.join(", ") : String(field.value ?? "—");
        return `<tr><td style="padding:6px 10px;font-size:11px;color:#94a3b8;border-bottom:1px solid #f1f5f9;">${name}</td><td style="padding:6px 10px;font-size:11px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;" colspan="${hasUnits ? 4 : 3}">${val || "—"}</td></tr>`;
      })
      .join("");

    const headerHTML = showHeader
      ? `<div style="background:#334155;padding:7px 12px;display:flex;align-items:center;justify-content:space-between;">
           <span style="color:white;font-size:11.5px;font-weight:700;letter-spacing:0.01em;">${sectionName}</span>
           <span style="color:rgba(255,255,255,0.5);font-size:8px;text-transform:uppercase;letter-spacing:0.05em;">${entries.length} parameter${entries.length !== 1 ? "s" : ""}</span>
         </div>`
      : "";

    const resultTable =
      resultEntries.length > 0
        ? `<table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <th style="padding:5px 10px;text-align:left;font-size:8.5px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;width:33%;">Parameter</th>
            <th style="padding:5px 10px;text-align:left;font-size:8.5px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;width:15%;">Result</th>
            ${unitHeader}
            <th style="padding:5px 10px;text-align:left;font-size:8.5px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;width:23%;">Ref. Range</th>
            <th style="padding:5px 10px;text-align:left;font-size:8.5px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;width:18%;">Status</th>
          </tr></thead>
          <tbody>${resultRows}</tbody>
        </table>`
        : "";

    const plainTable =
      plainEntries.length > 0
        ? `<table style="width:100%;border-collapse:collapse;${resultEntries.length > 0 ? "border-top:1px solid #e2e8f0;" : ""}"><tbody>${plainRows}</tbody></table>`
        : "";

    return `<div style="border:1px solid #e2e8f0;margin-bottom:10px;page-break-inside:avoid;">${headerHTML}${resultTable}${plainTable}</div>`;
  };

  const mainFields = [
    { label: "Patient Name", value: patient.name },
    { label: "Age / Gender", value: [patient.age, patient.gender].filter(Boolean).join(" · ") },
    { label: "Contact", value: patient.contact },
    ...(patient.sampleDate ? [{ label: "Sample Date", value: patient.sampleDate }] : []),
    ...(patient.reportDate ? [{ label: "Report Date", value: patient.reportDate }] : []),
  ];
  const colPct = Math.floor(100 / mainFields.length);
  const mainCells = mainFields
    .map(
      ({ label, value }) =>
        `<td style="padding:8px 12px;background:white;vertical-align:top;border-right:1px solid #e2e8f0;width:${colPct}%;">
       <div style="font-size:7.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">${label}</div>
       <div style="font-size:11px;font-weight:600;color:#1e293b;">${value || "—"}</div>
     </td>`,
    )
    .join("");

  let normal = 0,
    low = 0,
    high = 0;
  sections.forEach(([, sec]) => {
    getSectionEntries(sec).forEach(([, field]) => {
      if (!isResultField(field)) return;
      const st = getStatus(field.value, field.referenceRange);
      if (st === "normal") normal++;
      else if (st === "low") low++;
      else if (st === "high") high++;
    });
  });
  const total = normal + low + high;

  // A4 only — always draw the full lab header, never blank space for a pad.
  const topBlock = `<table style="width:100%;border-collapse:collapse;border-bottom:2px solid #0f172a;margin-bottom:0;">
    <tr>
      <td style="padding:14px 16px;vertical-align:top;">
        <div style="font-size:17px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">${labInfo.name}</div>
        ${labInfo.tagline ? `<div style="font-size:9px;color:#64748b;margin-top:3px;letter-spacing:0.04em;text-transform:uppercase;">${labInfo.tagline}</div>` : ""}
        <div style="font-size:9px;color:#94a3b8;margin-top:5px;">${labInfo.address}</div>
      </td>
      <td style="padding:14px 16px;vertical-align:top;text-align:right;">
        <div style="font-size:9px;color:#475569;font-weight:600;">${labInfo.phone}</div>
        ${labInfo.email ? `<div style="font-size:9px;color:#475569;margin-top:2px;">${labInfo.email}</div>` : ""}
        ${labInfo.regNo ? `<div style="font-size:8px;color:#94a3b8;margin-top:4px;font-family:monospace;">Reg: ${labInfo.regNo}</div>` : ""}
      </td>
    </tr>
  </table>`;

  const footerBlock = `<div class="print-footer">
     <table style="width:100%;"><tr>
       <td style="width:45%;padding-right:20px;"><div style="height:28px;border-bottom:1px solid #cbd5e1;"></div><div style="font-size:8px;color:#94a3b8;margin-top:3px;">Pathologist Signature &amp; Seal</div></td>
       <td style="width:10%;"></td>
       <td style="width:45%;padding-left:20px;"><div style="height:28px;border-bottom:1px solid #cbd5e1;"></div><div style="font-size:8px;color:#94a3b8;margin-top:3px;text-align:right;">Authorized Signatory</div></td>
     </tr></table>
     <div style="font-size:8px;color:#94a3b8;text-align:center;margin-top:10px;">For qualified medical professionals only. Interpret results in full clinical context. · ${labInfo.name} · ${labInfo.phone}</div>
   </div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${reportName}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; background:white; color:#1e293b; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-size:12px; }
  @page { size:A4; margin:16mm 16mm 22mm 16mm; }
  @media print {
    .print-footer { position:fixed; bottom:0; left:0; right:0; padding:10px 16mm; background:white; border-top:1px solid #e2e8f0; }
    body { padding-bottom:0; }
  }
  @media screen {
    body { padding:20px; max-width:720px; margin:0 auto; }
    .print-footer { margin-top:30px; padding-top:16px; border-top:1px solid #e2e8f0; }
  }
</style>
</head><body>
  ${topBlock}
  <div style="background:#f8fafc;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0;margin-bottom:0;">
    <div style="font-size:13px;font-weight:700;color:#0f172a;">${reportName}</div>
    ${shortId ? `<div style="font-size:8.5px;color:#64748b;font-family:monospace;font-weight:600;">Invoice: ${shortId}</div>` : ""}
  </div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
    <tr style="border-bottom:1px solid #e2e8f0;">${mainCells}</tr>
    <tr><td colspan="5" style="padding:6px 12px;background:#fafafa;">
      <span style="font-size:7.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-right:10px;">Referred By</span>
      <span style="font-size:11px;font-weight:600;color:#1e293b;">${patient.referredBy || "—"}</span>
    </td></tr>
  </table>
  ${
    total > 0
      ? `<div style="background:#f8fafc;padding:6px 16px;border:1px solid #e2e8f0;border-top:none;font-size:10.5px;display:flex;gap:8px;align-items:center;">
    <span style="color:#475569;font-weight:600;">${total} parameters:</span>
    <span style="font-weight:700;color:#166534;">${normal} Normal</span>
    ${low > 0 ? `<span style="color:#e2e8f0;">·</span><span style="font-weight:700;color:#92400e;">${low} Low</span>` : ""}
    ${high > 0 ? `<span style="color:#e2e8f0;">·</span><span style="font-weight:700;color:#991b1b;">${high} High</span>` : ""}
  </div>`
      : ""
  }
  <div style="margin-top:14px;">
    ${sections.map(([name, data]) => renderSection(name, data)).join("")}
  </div>
  ${footerBlock}
</body></html>`;
}

// ── Main Component ────────────────────────────────────────────────────────
function ReportViewer({ report, patient = null, reportName, labInfo, invoiceId = null }) {
  const [dlStatus, setDlStatus] = useState("idle");
  const [shareStatus, setShareStatus] = useState("idle");

  const resolvedPatient = patient ?? EMPTY_PATIENT;
  const resolvedReportName = reportName || report.name || "Lab Report";
  const filename = `${resolvedReportName.replace(/\s+/g, "_")}_report.pdf`;
  const shortId = invoiceId || report.invoiceId || "";

  const sections = Object.entries(report).filter(
    ([key, val]) =>
      !REPORT_META_KEYS.has(key) && val !== null && typeof val === "object" && !Array.isArray(val) && !val.$oid,
  );

  const generateBlob = () =>
    pdf(
      <ReportPDFDocument
        report={report}
        reportName={resolvedReportName}
        shortId={shortId}
        patient={resolvedPatient}
        labInfo={labInfo}
      />,
    ).toBlob();

  const handlePrint = () => {
    const html = buildPrintHTML({
      reportName: resolvedReportName,
      shortId,
      patient: resolvedPatient,
      labInfo,
      sections,
    });
    const existing = document.getElementById("sr-print-frame");
    if (existing) existing.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "sr-print-frame";
    iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;";
    document.body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    };
  };

  const handleDownload = async () => {
    setDlStatus("loading");
    try {
      const blob = await generateBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDlStatus("done");
    } catch (e) {
      console.error(e);
      setDlStatus("idle");
      alert("PDF generation failed.");
    } finally {
      setTimeout(() => setDlStatus("idle"), 2500);
    }
  };

  const handleShare = async () => {
    setShareStatus("loading");
    try {
      const blob = await generateBlob();
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: resolvedReportName });
        setShareStatus("done");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setShareStatus("copied");
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error(e);
      setShareStatus("idle");
    } finally {
      setTimeout(() => setShareStatus("idle"), 2500);
    }
  };

  const dlIcon =
    dlStatus === "loading" ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
    ) : dlStatus === "done" ? (
      <Check className="w-3.5 h-3.5" />
    ) : (
      <Download className="w-3.5 h-3.5" />
    );
  const dlLabel = dlStatus === "loading" ? "Generating…" : dlStatus === "done" ? "Downloaded!" : "Download PDF";
  const shIcon =
    shareStatus === "loading" ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
    ) : shareStatus === "copied" || shareStatus === "done" ? (
      <Check className="w-3.5 h-3.5" />
    ) : (
      <Share2 className="w-3.5 h-3.5" />
    );
  const shLabel =
    shareStatus === "loading"
      ? "Preparing…"
      : shareStatus === "done"
        ? "Shared!"
        : shareStatus === "copied"
          ? "Saved!"
          : "Share";

  return (
    <div className="max-w-2xl mx-auto font-sans">
      <div className="flex items-center justify-end gap-2 mb-3">
        <button
          onClick={handleShare}
          disabled={shareStatus === "loading"}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {shIcon} {shLabel}
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-400 transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          Print (A4)
        </button>
        <button
          onClick={handleDownload}
          disabled={dlStatus === "loading"}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {dlIcon} {dlLabel}
        </button>
      </div>

      <div className="bg-white border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 flex items-start justify-between gap-4 border-b-2 border-slate-800 bg-white">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FlaskConical className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900 tracking-tight">{labInfo.name}</p>
              {labInfo.tagline && (
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest">{labInfo.tagline}</p>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                <MapPin className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                <p className="text-[10px] text-slate-400">{labInfo.address}</p>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0 space-y-1">
            <div className="flex items-center justify-end gap-1">
              <Phone className="w-2.5 h-2.5 text-slate-400" />
              <p className="text-[10px] text-slate-500">{labInfo.phone}</p>
            </div>
            {labInfo.email && (
              <div className="flex items-center justify-end gap-1">
                <Mail className="w-2.5 h-2.5 text-slate-400" />
                <p className="text-[10px] text-slate-500">{labInfo.email}</p>
              </div>
            )}
            {labInfo.regNo && <p className="text-[9px] font-mono text-slate-400">Reg: {labInfo.regNo}</p>}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <h2 className="text-sm font-bold text-slate-800">{resolvedReportName}</h2>
          </div>
          {shortId && <p className="text-[10px] text-slate-400 font-mono font-semibold">Invoice: {shortId}</p>}
        </div>

        <PatientGrid patient={resolvedPatient} />

        <div className="px-5 py-2 border-b border-slate-200 bg-slate-50">
          <SummaryStrip sections={sections} />
        </div>

        <div className="px-5 pt-4 pb-4">
          {sections.map(([sectionName, sectionData]) => (
            <Section
              key={sectionName}
              sectionName={sectionName}
              sectionData={sectionData}
              showHeader={sectionData.__showTitle !== false}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-8 mb-5">
          <div>
            <div className="h-10 border-b border-dashed border-slate-300" />
            <p className="text-[10px] text-slate-400 mt-1.5">Pathologist Signature &amp; Seal</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-slate-300" />
            <p className="text-[10px] text-slate-400 mt-1.5 text-right">Authorized Signatory</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          For qualified medical professionals only. Interpret results in full clinical context.
          <span className="mx-1.5">·</span>
          {labInfo.name}
          <span className="mx-1.5">·</span>
          {labInfo.phone}
        </p>
      </div>
    </div>
  );
}

export default ReportViewer;

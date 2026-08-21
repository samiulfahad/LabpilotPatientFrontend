import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const C = {
  dark: "#0f172a",
  slate600: "#475569",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  body: "#374151",
  normal: "#0F6E5C",
  low: "#92400e",
  high: "#991b1b",
  lowBg: "#fffbeb",
  highBg: "#fef2f2",
  normBg: "#EAF6F3",
  lowBdr: "#fde68a",
  highBdr: "#fecaca",
  normBdr: "#B9E3D9",
};

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 9, color: C.dark, paddingBottom: 60 },
  header: {
    borderBottom: `2 solid ${C.dark}`,
    padding: "12 16",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  labName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.dark },
  labSub: { fontSize: 7.5, color: C.slate400, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  labAddr: { fontSize: 7, color: C.slate400, marginTop: 4 },
  headerRight: { alignItems: "flex-end" },
  headerContact: { fontSize: 8, color: C.slate600, marginBottom: 2 },
  headerReg: { fontSize: 7, color: C.slate400, fontFamily: "Courier" },
  titleBar: {
    backgroundColor: C.slate50,
    padding: "7 16",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: `1 solid ${C.slate200}`,
  },
  titleText: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.dark },
  invoiceText: { fontSize: 7.5, color: C.slate600, fontFamily: "Courier-Bold" },
  patientRow: { flexDirection: "row", borderBottom: `1 solid ${C.slate200}` },
  patientCell: { flex: 1, padding: "6 10", borderRight: `1 solid ${C.slate200}` },
  cellLabel: { fontSize: 6.5, color: C.slate400, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2.5 },
  cellValue: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.dark },
  referredRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: "5 10",
    backgroundColor: "#fafafa",
    borderBottom: `1 solid ${C.slate200}`,
    gap: 8,
  },
  sectionWrap: { marginBottom: 8, border: `1 solid ${C.slate200}` },
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.slate50,
    borderBottom: `1 solid ${C.slate200}`,
    padding: "3 0",
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    paddingHorizontal: 8,
    letterSpacing: 0.3,
  },
  tableRow: { flexDirection: "row", borderBottom: `1 solid ${C.slate100}`, paddingVertical: 5 },
  td: { fontSize: 9, paddingHorizontal: 8, color: C.body },
  tdBold: { fontSize: 9, paddingHorizontal: 8, fontFamily: "Helvetica-Bold" },
  tdMono: { fontSize: 9, paddingHorizontal: 8, fontFamily: "Courier", color: C.slate600 },
  tdUnit: { fontSize: 7.5, paddingHorizontal: 8, color: C.slate400, textTransform: "uppercase" },
  pill: { paddingHorizontal: 5, paddingVertical: 1.5 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: "10 16", borderTop: `1 solid ${C.slate200}` },
  footerNote: { fontSize: 7, color: C.slate400, textAlign: "center" },
});

function parseRange(ref) {
  if (!ref) return null;
  const m = ref.match(/^([\d.]+)\s*[–\-]\s*([\d.]+)$/);
  if (!m) return null;
  return { min: parseFloat(m[1]), max: parseFloat(m[2]) };
}
const fmt = (n) =>
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
  if (n > r.max) return { status: "high", label: `Higher (${fmt(n / r.max)}x)` };
  if (n < r.min)
    return r.min === 0 ? { status: "low", label: "Low" } : { status: "low", label: `Lower (${fmtLow(n / r.min)}x)` };
  return { status: "normal", label: "Normal" };
}
const isResultField = (f) => f && typeof f === "object" && (Boolean(f.referenceRange) || Boolean(f.unit));
const getSectionEntries = (sec) => Object.entries(sec).filter(([k]) => k !== "__showTitle");

const ROW_COLORS = {
  high: { bg: "#fff8f8", val: C.high },
  low: { bg: "#fffdf5", val: C.low },
  normal: { bg: "white", val: C.dark },
};
const PILL_COLORS = {
  high: { bg: C.highBg, color: C.high, border: C.highBdr },
  low: { bg: C.lowBg, color: C.low, border: C.lowBdr },
  normal: { bg: C.normBg, color: C.normal, border: C.normBdr },
};

function Pill({ info }) {
  if (!info) return null;
  const pc = PILL_COLORS[info.status];
  return (
    <View style={[s.pill, { backgroundColor: pc.bg, borderWidth: 0.5, borderColor: pc.border }]}>
      <Text style={{ color: pc.color, fontSize: 7, fontFamily: "Helvetica-Bold" }}>{info.label}</Text>
    </View>
  );
}

function PDFSection({ sectionName, sectionData, showHeader }) {
  const entries = getSectionEntries(sectionData);
  const resultEntries = entries.filter(([, v]) => isResultField(v));
  const plainEntries = entries.filter(([, v]) => !isResultField(v));
  const hasUnits = resultEntries.some(([, v]) => Boolean(v.unit));
  const W = hasUnits
    ? { param: "32%", result: "13%", unit: "10%", ref: "22%", status: "23%" }
    : { param: "34%", result: "16%", ref: "26%", status: "24%" };

  return (
    <View style={s.sectionWrap}>
      {showHeader && (
        <View style={[s.tableHead, { backgroundColor: C.dark, padding: "6 12" }]}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "white" }}>{sectionName}</Text>
        </View>
      )}
      {resultEntries.length > 0 && (
        <View>
          <View style={s.tableHead}>
            <Text style={[s.th, { width: W.param }]}>Parameter</Text>
            <Text style={[s.th, { width: W.result }]}>Result</Text>
            {hasUnits && <Text style={[s.th, { width: W.unit }]}>Unit</Text>}
            <Text style={[s.th, { width: W.ref }]}>Ref. Range</Text>
            <Text style={[s.th, { width: W.status }]}>Status</Text>
          </View>
          {resultEntries.map(([name, field]) => {
            const value = String(field.value ?? "");
            const ref = field.referenceRange || "";
            const info = getStatusInfo(value, ref);
            const rc = info ? (ROW_COLORS[info.status] ?? {}) : {};
            return (
              <View key={name} style={[s.tableRow, { backgroundColor: rc.bg ?? "white" }]}>
                <Text style={[s.td, { width: W.param }]}>{name}</Text>
                <Text style={[s.tdBold, { width: W.result, color: rc.val ?? C.dark }]}>{value}</Text>
                {hasUnits && <Text style={[s.tdUnit, { width: W.unit }]}>{field.unit || "—"}</Text>}
                <Text style={[s.tdMono, { width: W.ref }]}>{ref || "—"}</Text>
                <View style={{ width: W.status, justifyContent: "center", paddingHorizontal: 6 }}>
                  <Pill info={info} />
                </View>
              </View>
            );
          })}
        </View>
      )}
      {plainEntries.length > 0 && (
        <View style={{ borderTop: resultEntries.length > 0 ? `1 solid ${C.slate200}` : undefined }}>
          {plainEntries.map(([name, field]) => {
            const val = Array.isArray(field.value) ? field.value.join(", ") : String(field.value ?? "—");
            return (
              <View key={name} style={s.tableRow}>
                <Text style={[s.td, { width: "38%", color: C.slate400 }]}>{name}</Text>
                <Text style={[s.tdBold, { flex: 1 }]}>{val || "—"}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function ScanReportPDFDocument({ report, reportName, invoiceId, patient, labInfo }) {
  const sections = Object.entries(report).filter(
    ([key, val]) =>
      key !== "_id" && key !== "name" && val !== null && typeof val === "object" && !Array.isArray(val) && !val.$oid,
  );

  const mainFields = [
    { label: "Patient Name", value: patient.name },
    { label: "Age / Gender", value: [patient.age, patient.gender].filter(Boolean).join(" · ") },
    { label: "Contact", value: patient.contactNumber },
    ...(report.sampleCollectionDate ? [{ label: "Sample Date", value: patient.sampleDate }] : []),
    ...(report.reportDate ? [{ label: "Report Date", value: patient.reportDate }] : []),
  ];

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.labName}>{labInfo?.name || "Lab"}</Text>
            {labInfo?.tagline ? <Text style={s.labSub}>{labInfo.tagline}</Text> : null}
            <Text style={s.labAddr}>{labInfo?.address || ""}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerContact}>{labInfo?.phone || ""}</Text>
            {labInfo?.email ? <Text style={s.headerContact}>{labInfo.email}</Text> : null}
            {labInfo?.regNo ? <Text style={s.headerReg}>Reg: {labInfo.regNo}</Text> : null}
          </View>
        </View>

        <View style={s.titleBar}>
          <Text style={s.titleText}>{reportName}</Text>
          {invoiceId ? <Text style={s.invoiceText}>Invoice: {invoiceId}</Text> : null}
        </View>

        <View style={s.patientRow}>
          {mainFields.map(({ label, value }) => (
            <View key={label} style={s.patientCell}>
              <Text style={s.cellLabel}>{label}</Text>
              <Text style={s.cellValue}>{value || "—"}</Text>
            </View>
          ))}
        </View>
        {patient.referredBy && (
          <View style={s.referredRow}>
            <Text style={[s.cellLabel, { marginBottom: 0 }]}>Referred By</Text>
            <Text style={[s.cellValue, { fontSize: 9 }]}>{patient.referredBy}</Text>
          </View>
        )}

        <View style={{ padding: "10 14" }}>
          {sections.map(([sectionName, sectionData]) => (
            <PDFSection
              key={sectionName}
              sectionName={sectionName}
              sectionData={sectionData}
              showHeader={sectionData.__showTitle !== false}
            />
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerNote}>
            For qualified medical professionals only. Interpret results in full clinical context. ·{" "}
            {labInfo?.name || ""} · {labInfo?.phone || ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { getPresignedUrl, confirmUpload, listDocuments } from "../api/client";
import axios from "axios";

const DOC_TYPES = ["passport", "aadhaar", "pan", "driving_license", "utility_bill", "company_document"];

interface Doc {
  id: string;
  document_type: string;
  s3_key: string;
  upload_status: string;
  virus_scan_status: string;
  created_at: string;
}

const card: React.CSSProperties = {
  background: "#111827",
  border: "1px solid rgba(180,145,70,0.15)",
  borderRadius: 12,
  padding: "24px 28px",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(180,145,70,0.7)",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d1117",
  border: "1px solid rgba(180,145,70,0.2)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
  color: "#e2e8f0",
  outline: "none",
  boxSizing: "border-box",
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchDocs = () => listDocuments().then((r) => setDocs(r.data)).catch(() => {});

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setStatus("");
    try {
      const { data } = await getPresignedUrl({
        document_type: docType,
        filename: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
      });
      await axios.put(data.upload_url, file, { headers: { "Content-Type": file.type } });
      await confirmUpload({ document_id: data.document_id, file_hash: "" });
      setStatus("✓ Upload confirmed. OCR processing started.");
      fetchDocs();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : "Upload failed.";
      setStatus("✗ " + String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(180,145,70,0.6)", marginBottom: 6 }}>
          KYC Platform
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#f0e6cc", margin: 0 }}>Documents</h1>
        <p style={{ fontSize: 13, color: "rgba(200,210,230,0.5)", marginTop: 4 }}>
          Upload and manage identity documents for verification.
        </p>
      </div>

      {/* Upload card */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#b49146" }}>↑</span> Upload Document
        </div>

        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={label}>Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", appearance: "none" }}
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t} style={{ background: "#0d1117", color: "#e2e8f0" }}>
                  {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={label}>File</label>
            <label style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "#0d1117",
              border: "1px dashed rgba(180,145,70,0.3)",
              borderRadius: 8, padding: "12px 16px",
              cursor: "pointer", color: "rgba(200,210,230,0.6)", fontSize: 13,
            }}>
              <span style={{
                background: "rgba(180,145,70,0.12)", border: "1px solid rgba(180,145,70,0.3)",
                borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#b49146", whiteSpace: "nowrap",
              }}>
                Choose File
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file ? file.name : "No file chosen"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,image/tiff"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
                required
              />
            </label>
          </div>

          {status && (
            <div style={{
              fontSize: 13, padding: "10px 14px", borderRadius: 7,
              color: status.startsWith("✓") ? "#6ee7b7" : "#fca5a5",
              background: status.startsWith("✓") ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${status.startsWith("✓") ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
            }}>
              {status}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "rgba(180,145,70,0.3)" : "linear-gradient(135deg,#b49146,#8a6c2f)",
                border: "none", borderRadius: 8,
                padding: "11px 28px", fontSize: 13, fontWeight: 500,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: loading ? "rgba(255,255,255,0.4)" : "#080c14",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.2s",
              }}
            >
              {loading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Documents table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(180,145,70,0.1)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Uploaded Documents</span>
          <span style={{
            marginLeft: 10, fontSize: 11, background: "rgba(180,145,70,0.12)",
            color: "#b49146", borderRadius: 20, padding: "2px 10px",
          }}>{docs.length}</span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(0,0,0,0.3)" }}>
              {["Type", "Status", "Virus Scan", "Uploaded"].map((h) => (
                <th key={h} style={{
                  padding: "11px 20px", textAlign: "left",
                  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "rgba(180,145,70,0.6)", fontWeight: 500,
                  borderBottom: "1px solid rgba(180,145,70,0.1)",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={d.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <td style={{ padding: "13px 20px", color: "#e2e8f0", textTransform: "capitalize" }}>
                  {d.document_type.replace(/_/g, " ")}
                </td>
                <td style={{ padding: "13px 20px" }}><StatusBadge value={d.upload_status} /></td>
                <td style={{ padding: "13px 20px" }}><StatusBadge value={d.virus_scan_status} /></td>
                <td style={{ padding: "13px 20px", color: "rgba(200,210,230,0.45)", fontSize: 12 }}>
                  {d.created_at?.slice(0, 10)}
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "40px 20px", textAlign: "center", color: "rgba(200,210,230,0.3)", fontSize: 13 }}>
                  No documents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const styles: Record<string, React.CSSProperties> = {
    uploaded:  { background: "rgba(52,211,153,0.12)", color: "#6ee7b7", border: "1px solid rgba(52,211,153,0.25)" },
    clean:     { background: "rgba(52,211,153,0.12)", color: "#6ee7b7", border: "1px solid rgba(52,211,153,0.25)" },
    verified:  { background: "rgba(52,211,153,0.12)", color: "#6ee7b7", border: "1px solid rgba(52,211,153,0.25)" },
    pending:   { background: "rgba(251,191,36,0.1)",  color: "#fcd34d", border: "1px solid rgba(251,191,36,0.25)" },
    failed:    { background: "rgba(248,113,113,0.1)", color: "#fca5a5", border: "1px solid rgba(248,113,113,0.25)" },
    infected:  { background: "rgba(248,113,113,0.1)", color: "#fca5a5", border: "1px solid rgba(248,113,113,0.25)" },
  };
  const s = styles[value] ?? { background: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.2)" };
  return (
    <span style={{ ...s, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.06em" }}>
      {value}
    </span>
  );
}

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { motion } from "framer-motion";
import { FileText, Upload } from "lucide-react";
import axios from "axios";
import {
  getPresignedUrl,
  confirmUpload,
  listDocuments,
  uploadDocumentDirect,
} from "../api/client";
import {
  PageHeader,
  SkeletonTable,
  EmptyState,
  ErrorState,
  Badge,
  IconButton,
} from "../components/ui";

const DOC_TYPES = ["passport", "aadhaar", "pan", "driving_license", "utility_bill", "company_document"];

interface Doc {
  id: string;
  document_type: string;
  s3_key: string;
  upload_status: string;
  virus_scan_status: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, { color: string; bg: string; border: string }> = {
  uploaded: { color: "#6ee7b7", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
  clean: { color: "#6ee7b7", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
  verified: { color: "#6ee7b7", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
  pending: { color: "#fcd34d", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
  failed: { color: "#fca5a5", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  infected: { color: "#fca5a5", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

const inp: React.CSSProperties = {
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
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const preferServerUpload = typeof window !== "undefined" && window.location.hostname === "localhost";

  const fetchDocs = () => {
    setError("");
    return listDocuments()
      .then((r) => setDocs(r.data))
      .catch(() => setError("Failed to load documents."))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatus("");

    try {
      if (preferServerUpload) {
        await uploadDocumentDirect(docType, file);
        setStatus("Success: upload completed through server path.");
        setFile(null);
        fetchDocs();
        return;
      }

      const { data } = await getPresignedUrl({
        document_type: docType,
        filename: file.name,
        content_type: file.type,
        file_size_bytes: file.size,
      });

      await axios.put(data.upload_url, file, { headers: data.upload_headers });
      await confirmUpload({ document_id: data.document_id, file_hash: "" });
      setStatus("Success: upload confirmed. OCR processing started.");
      setFile(null);
      fetchDocs();
    } catch (err: unknown) {
      const shouldFallback =
        axios.isAxiosError(err) &&
        (!err.response || err.message === "Network Error");

      if (shouldFallback) {
        try {
          await uploadDocumentDirect(docType, file);
          setStatus("Success: upload completed through server fallback.");
          setFile(null);
          fetchDocs();
          return;
        } catch (fallbackErr: unknown) {
          const msg = axios.isAxiosError(fallbackErr)
            ? fallbackErr.response?.data?.detail || fallbackErr.message
            : "Upload failed.";
          setStatus(`Error: ${String(msg)}`);
          return;
        }
      }

      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail || err.message
        : "Upload failed.";
      setStatus(`Error: ${String(msg)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader
        eyebrow="KYC Platform"
        title="Documents"
        subtitle="Upload and manage identity documents for verification."
        actions={<IconButton icon={FileText} onClick={fetchDocs} label="Refresh" />}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ background: "#111827", border: "1px solid rgba(180,145,70,0.15)", borderRadius: 12, padding: "24px 28px", marginBottom: 24 }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Upload size={15} color="#b49146" /> Upload Document
        </div>

        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(180,145,70,0.7)", marginBottom: 8 }}>
              Document Type
            </label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(180,145,70,0.7)", marginBottom: 8 }}>
              File
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#0d1117",
                border: "1px dashed rgba(180,145,70,0.3)",
                borderRadius: 8,
                padding: "12px 16px",
                cursor: "pointer",
                color: "rgba(200,210,230,0.6)",
                fontSize: 13,
              }}
            >
              <span style={{ background: "rgba(180,145,70,0.12)", border: "1px solid rgba(180,145,70,0.3)", borderRadius: 6, padding: "4px 12px", fontSize: 12, color: "#b49146", whiteSpace: "nowrap" }}>
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
            <div
              style={{
                fontSize: 13,
                padding: "10px 14px",
                borderRadius: 7,
                color: status.startsWith("Success:") ? "#6ee7b7" : "#fca5a5",
                background: status.startsWith("Success:") ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${status.startsWith("Success:") ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
              }}
            >
              {status}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "rgba(180,145,70,0.3)" : "linear-gradient(135deg,#b49146,#8a6c2f)",
                border: "none",
                borderRadius: 8,
                padding: "11px 28px",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: loading ? "rgba(255,255,255,0.4)" : "#080c14",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </motion.div>

      {error && <ErrorState message={error} onRetry={fetchDocs} />}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(180,145,70,0.1)", borderRadius: 14, overflow: "hidden" }}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(180,145,70,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Uploaded Documents</span>
          <span style={{ fontSize: 11, background: "rgba(180,145,70,0.12)", color: "#b49146", borderRadius: 20, padding: "2px 10px" }}>
            {docs.length}
          </span>
        </div>

        {fetching ? (
          <div style={{ padding: 20 }}>
            <SkeletonTable rows={4} cols={4} />
          </div>
        ) : docs.length === 0 && !error ? (
          <EmptyState icon={FileText} title="No documents yet" subtitle="Upload your first identity document above." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                {["Type", "Status", "Virus Scan", "Uploaded"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "11px 20px",
                      textAlign: "left",
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "rgba(180,145,70,0.6)",
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(180,145,70,0.1)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((d, i) => {
                const us = STATUS_BADGE[d.upload_status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };
                const vs = STATUS_BADGE[d.virus_scan_status] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" };
                return (
                  <motion.tr
                    key={d.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                  >
                    <td style={{ padding: "13px 20px", color: "#e2e8f0", textTransform: "capitalize" }}>{d.document_type.replace(/_/g, " ")}</td>
                    <td style={{ padding: "13px 20px" }}><Badge label={d.upload_status} {...us} /></td>
                    <td style={{ padding: "13px 20px" }}><Badge label={d.virus_scan_status} {...vs} /></td>
                    <td style={{ padding: "13px 20px", color: "rgba(200,210,230,0.45)", fontSize: 12 }}>{d.created_at?.slice(0, 10)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}

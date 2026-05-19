import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { ScanFace, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { submitFaceVerification, getFaceVerification } from "../api/client";
import { PageHeader, ErrorState, Spinner } from "../components/ui";

interface VerificationResult {
  id: string;
  status: string;
  is_match: boolean | null;
  similarity_score: number | null;
  confidence_score: number | null;
}

function SimilarityMeter({ score }: { score: number }) {
  const color = score >= 90 ? "#22c55e" : score >= 80 ? "#f59e0b" : "#ef4444";
  const label = score >= 90 ? "Strong Match" : score >= 80 ? "Likely Match" : "Weak Match";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 12px" }}>
        <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <motion.circle
            cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={314}
            initial={{ strokeDashoffset: 314 }}
            animate={{ strokeDashoffset: 314 * (1 - score / 100) }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{score.toFixed(0)}%</div>
          <div style={{ fontSize: 9, color, letterSpacing: "0.1em", marginTop: 2 }}>MATCH</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color }}>{label}</div>
    </div>
  );
}

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "10px 12px", color: "#f1f5f9",
  fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};

export default function FaceVerificationPage() {
  const [selfieKey, setSelfieKey] = useState("");
  const [idKey, setIdKey] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await submitFaceVerification({ selfie_s3_key: selfieKey, id_document_s3_key: idKey });
      setResult(data);
      if (data.status === "pending") {
        setPolling(true);
        const interval = setInterval(async () => {
          const { data: updated } = await getFaceVerification(data.id);
          setResult(updated);
          if (updated.status !== "pending") { clearInterval(interval); setPolling(false); }
        }, 3000);
      }
    } catch {
      setError("Submission failed — check S3 keys and permissions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHeader
        eyebrow="KYC"
        title="Face Verification"
        subtitle="Compare a selfie against an identity document using AWS Rekognition."
      />

      <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: 20 }}>
        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ScanFace size={18} color="#818cf8" />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Submit Verification</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>Selfie S3 Key</label>
              <input style={inp} value={selfieKey} onChange={(e) => setSelfieKey(e.target.value)} placeholder="users/uuid/selfie.jpg" required />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>ID Document S3 Key</label>
              <input style={inp} value={idKey} onChange={(e) => setIdKey(e.target.value)} placeholder="users/uuid/passport.jpg" required />
            </div>

            {error && <ErrorState message={error} onRetry={() => setError("")} />}

            <button type="submit" disabled={loading} style={{ padding: "12px", background: "#6366f1", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading ? <Spinner size={14} color="#fff" /> : <ScanFace size={15} />}
              {loading ? "Submitting…" : "Run Face Match"}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: "14px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Thresholds</div>
              <div>≥ 90% — Strong match · Auto-approve</div>
              <div>80–89% — Likely match · Manual review</div>
              <div>&lt; 80% — Weak match · Flag for investigation</div>
            </div>
          </div>
        </motion.div>

        {/* Result */}
        {result && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${result.status === "completed" ? (result.is_match ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)") : "rgba(255,255,255,0.07)"}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>Verification Result</div>

            {result.status === "pending" && (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <Spinner size={40} color="#6366f1" />
                </div>
                <div style={{ fontSize: 14, color: "#64748b" }}>Processing with Rekognition…</div>
                {polling && <div style={{ fontSize: 12, color: "#475569", marginTop: 6 }}>Auto-refreshing every 3s</div>}
              </div>
            )}

            {result.status === "completed" && result.similarity_score !== null && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <SimilarityMeter score={result.similarity_score} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: result.is_match ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${result.is_match ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 10, marginBottom: 16 }}>
                  {result.is_match ? <CheckCircle2 size={18} color="#22c55e" /> : <XCircle size={18} color="#ef4444" />}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: result.is_match ? "#22c55e" : "#ef4444" }}>
                      {result.is_match ? "Identity Verified" : "Identity Mismatch"}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      {result.is_match ? "Face matches the identity document" : "Face does not match the identity document"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px" }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Similarity Score</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{result.similarity_score.toFixed(1)}%</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px" }}>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>Confidence</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{result.confidence_score?.toFixed(1) ?? "—"}%</div>
                  </div>
                </div>
              </>
            )}

            {result.status === "completed" && result.similarity_score === null && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#475569" }}>
                <AlertTriangle size={28} color="#f59e0b" style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 13 }}>No face detected in one or both images.</div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

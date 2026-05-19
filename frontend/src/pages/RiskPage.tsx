import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { BarChart2, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { calculateRisk, getRiskHistory } from "../api/client";
import { PageHeader, ErrorState, Spinner } from "../components/ui";

interface RiskResult {
  id: string;
  final_score: number;
  decision: string;
  kyc_risk: number;
  aml_risk: number;
  geographic_risk: number;
  behavioural_risk: number;
  transaction_risk: number;
  device_ip_risk: number;
  ownership_structure_risk: number;
}

const DECISION_META: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  AUTO_APPROVE:          { label: "Auto Approved",         color: "#22c55e", bg: "rgba(34,197,94,0.08)",  icon: CheckCircle2 },
  MANUAL_REVIEW:         { label: "Manual Review",         color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: AlertTriangle },
  COMPLIANCE_ESCALATION: { label: "Compliance Escalation", color: "#f97316", bg: "rgba(249,115,22,0.08)", icon: AlertTriangle },
  AUTO_REJECT:           { label: "Auto Rejected",         color: "#ef4444", bg: "rgba(239,68,68,0.08)",  icon: XCircle },
};

const BREAKDOWN_ITEMS = [
  { key: "kyc_risk",                 label: "KYC",        max: 90,  color: "#6366f1" },
  { key: "aml_risk",                 label: "AML",        max: 100, color: "#ef4444" },
  { key: "geographic_risk",          label: "Geo",        max: 40,  color: "#f59e0b" },
  { key: "behavioural_risk",         label: "Behaviour",  max: 40,  color: "#f97316" },
  { key: "transaction_risk",         label: "Transaction",max: 30,  color: "#0ea5e9" },
  { key: "device_ip_risk",           label: "Device/IP",  max: 20,  color: "#8b5cf6" },
  { key: "ownership_structure_risk", label: "Ownership",  max: 50,  color: "#ec4899" },
] as const;

function ScoreGauge({ score }: { score: number }) {
  const color = score <= 29 ? "#22c55e" : score <= 59 ? "#f59e0b" : score <= 84 ? "#f97316" : "#ef4444";
  const label = score <= 29 ? "LOW" : score <= 59 ? "MEDIUM" : score <= 84 ? "HIGH" : "CRITICAL";
  const r = 52, circ = 2 * Math.PI * r;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <motion.circle
            cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - score / 100) }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>
            {score}
          </motion.div>
          <div style={{ fontSize: 10, color, letterSpacing: "0.12em", fontWeight: 600, marginTop: 2 }}>{label}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#475569" }}>Risk Score / 100</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { color: string } }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      <div style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].value}</div>
    </div>
  );
};

const defaultForm = {
  user_id: "", kyc_verified: false, doc_confidence_avg: 0, face_similarity: 0,
  is_pep: false, is_sanctioned: false, adverse_media: false, country_code: "IN",
  login_anomaly: false, transaction_velocity: 0, ip_risk_score: 0, has_complex_ownership: false,
};

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "9px 12px", color: "#f1f5f9",
  fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};

export default function RiskPage() {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [history, setHistory] = useState<RiskResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleCalculate = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await calculateRisk(form);
      setResult(data);
    } catch {
      setError("Calculation failed — check your role permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleHistory = async () => {
    if (!form.user_id) return;
    const { data } = await getRiskHistory(form.user_id);
    setHistory(data);
  };

  const chartData = result
    ? BREAKDOWN_ITEMS.map(({ key, label, color }) => ({ name: label, value: result[key], color }))
    : [];

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader
        eyebrow="Intelligence"
        title="Risk Scoring"
        subtitle="Calculate composite risk scores across KYC, AML, geographic, and behavioural dimensions."
      />

      <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: 20, marginBottom: 24 }}>
        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>Calculate Score</div>
          <form onSubmit={handleCalculate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 5, letterSpacing: "0.08em", textTransform: "uppercase" }}>User ID</label>
              <input style={inp} value={form.user_id} onChange={(e) => set("user_id", e.target.value)} placeholder="UUID" required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { k: "doc_confidence_avg", label: "Doc Confidence", step: 0.01, max: 1 },
                { k: "face_similarity",    label: "Face Similarity", step: 0.01, max: 1 },
                { k: "transaction_velocity", label: "Tx Velocity", step: 1 },
                { k: "ip_risk_score",      label: "IP Risk Score", step: 1, max: 100 },
              ].map(({ k, label, step, max }) => (
                <div key={k}>
                  <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>
                  <input type="number" style={inp} value={(form as Record<string, unknown>)[k] as number} step={step} min={0} max={max}
                    onChange={(e) => set(k, parseFloat(e.target.value))} />
                </div>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Country Code</label>
              <input style={inp} value={form.country_code} onChange={(e) => set("country_code", e.target.value)} maxLength={2} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(["kyc_verified", "is_pep", "is_sanctioned", "adverse_media", "login_anomaly", "has_complex_ownership"] as const).map((k) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b", cursor: "pointer", padding: "6px 0" }}>
                  <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} style={{ accentColor: "#6366f1", width: 14, height: 14 }} />
                  {k.replace(/_/g, " ")}
                </label>
              ))}
            </div>
            {error && <ErrorState message={error} onRetry={() => setError("")} />}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: "11px", background: "#6366f1", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
                {loading && <Spinner size={14} color="#fff" />}
                {loading ? "Calculating…" : "Calculate Risk"}
              </button>
              <button type="button" onClick={handleHistory} style={{ padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                History
              </button>
            </div>
          </form>
        </motion.div>

        {/* Result */}
        {result && (() => {
          const dm = DECISION_META[result.decision] ?? DECISION_META.MANUAL_REVIEW;
          const DIcon = dm.icon;
          return (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>Assessment Result</div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <ScoreGauge score={result.final_score} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: dm.bg, border: `1px solid ${dm.color}30`, borderRadius: 10, marginBottom: 20 }}>
                <DIcon size={16} color={dm.color} />
                <span style={{ fontSize: 13, fontWeight: 600, color: dm.color }}>{dm.label}</span>
              </div>

              {/* Recharts bar chart */}
              <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Score Breakdown</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barSize={18} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#334155", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          );
        })()}
      </div>

      {/* History table */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={15} color="#6366f1" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Score History</span>
            <span style={{ fontSize: 11, background: "rgba(99,102,241,0.15)", color: "#818cf8", borderRadius: 20, padding: "2px 8px" }}>{history.length}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                {["Score", "Decision", "KYC", "AML", "Geo", "Behaviour", "Transaction"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => {
                const dm = DECISION_META[r.decision] ?? DECISION_META.MANUAL_REVIEW;
                return (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: dm.color, fontSize: 16 }}>{r.final_score}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: dm.bg, color: dm.color }}>{dm.label}</span>
                    </td>
                    {(["kyc_risk", "aml_risk", "geographic_risk", "behavioural_risk", "transaction_risk"] as const).map((k) => (
                      <td key={k} style={{ padding: "12px 16px", color: "#94a3b8" }}>{r[k]}</td>
                    ))}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}

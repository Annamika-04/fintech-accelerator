import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, XCircle, AlertTriangle, ShieldCheck, RefreshCw, ArrowLeft } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";
import { getOnboardingStatus, resetKYC } from "../../api/client";
import { useOnboardingStore, OnboardingStatus } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import toast from "react-hot-toast";

const STATUS_META: Record<OnboardingStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  REGISTERED:         { label: "Registered",         color: "#64748b", icon: Clock },
  TYPE_SELECTED:      { label: "Type Selected",       color: "#64748b", icon: Clock },
  PROFILE_COMPLETED:  { label: "Profile Completed",   color: "#6366f1", icon: CheckCircle2 },
  DOCUMENTS_UPLOADED: { label: "Documents Uploaded",  color: "#6366f1", icon: CheckCircle2 },
  KYC_PENDING:        { label: "KYC In Progress",     color: "#f59e0b", icon: Clock },
  AML_PENDING:        { label: "AML Screening",       color: "#f59e0b", icon: Clock },
  UNDER_REVIEW:       { label: "Under Review",        color: "#f59e0b", icon: AlertTriangle },
  APPROVED:           { label: "Approved",            color: "#22c55e", icon: CheckCircle2 },
  REJECTED:           { label: "Rejected",            color: "#ef4444", icon: XCircle },
  FROZEN:             { label: "Account Frozen",      color: "#ef4444", icon: XCircle },
};

const TIMELINE_STEPS: OnboardingStatus[] = [
  "PROFILE_COMPLETED", "DOCUMENTS_UPLOADED", "KYC_PENDING", "AML_PENDING", "UNDER_REVIEW", "APPROVED",
];

const STATUS_ORDER = [
  "REGISTERED", "TYPE_SELECTED", "PROFILE_COMPLETED", "DOCUMENTS_UPLOADED",
  "KYC_PENDING", "AML_PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "FROZEN",
];

function statusIndex(s: OnboardingStatus) { return STATUS_ORDER.indexOf(s); }

interface ServerState {
  current_status: OnboardingStatus;
  onboarding_type: string | null;
  kyc_score: number | null;
  aml_score: number | null;
  final_score: number | null;
  decision: string | null;
}

function scoreColor(s: number) {
  return s <= 29 ? "#22c55e" : s <= 59 ? "#f59e0b" : s <= 84 ? "#f97316" : "#ef4444";
}
function scoreLabel(s: number) {
  return s <= 29 ? "LOW RISK" : s <= 59 ? "MEDIUM RISK" : s <= 84 ? "HIGH RISK" : "CRITICAL RISK";
}

const ScoreTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; fill: string }; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#94a3b8", marginBottom: 2 }}>{payload[0].payload.name}</div>
      <div style={{ color: payload[0].payload.fill, fontWeight: 700 }}>{payload[0].value}</div>
    </div>
  );
};

export default function VerificationStatusPage({ onBack }: { onBack?: () => void }) {
  const { setServerStatus, setScores } = useOnboardingStore();
  const [state, setState] = useState<ServerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const handleBack = async () => {
    if (!onBack) return;
    setResetting(true);
    try {
      await resetKYC();
      onBack();
    } catch {
      toast.error("Failed to reset. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await getOnboardingStatus();
      const data: ServerState = res.data;
      setState(data);
      setServerStatus(data.current_status);
      setScores(data.kyc_score, data.aml_score, data.final_score, data.decision);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (state && ["KYC_PENDING", "AML_PENDING", "UNDER_REVIEW"].includes(state.current_status)) {
        fetchStatus();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [state?.current_status]);

  if (loading) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Spinner size={40} color="#6366f1" />
        </div>
        <div style={{ color: "#475569", fontSize: 14 }}>Loading verification status…</div>
      </div>
    );
  }

  if (!state) return null;

  const meta = STATUS_META[state.current_status];
  const Icon = meta.icon;
  const currentIdx = statusIndex(state.current_status);
  const isTerminal = ["APPROVED", "REJECTED", "FROZEN"].includes(state.current_status);
  const isPending = ["KYC_PENDING", "AML_PENDING", "UNDER_REVIEW"].includes(state.current_status);
  const canRetakeSelfie = state.current_status === "KYC_PENDING" || state.current_status === "DOCUMENTS_UPLOADED";
  const finalScore = state.final_score;
  const color = finalScore !== null ? scoreColor(finalScore) : "#64748b";

  // Radial chart data — KYC + AML sub-scores + final
  const chartData = [
    ...(state.final_score !== null ? [{ name: "Final Score", value: state.final_score, fill: color }] : []),
    ...(state.kyc_score !== null   ? [{ name: "KYC Risk",    value: state.kyc_score,   fill: "#6366f1" }] : []),
    ...(state.aml_score !== null   ? [{ name: "AML Risk",    value: state.aml_score,   fill: "#ef4444" }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>

      {/* Status hero */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}
          style={{ width: 72, height: 72, borderRadius: "50%", background: `${meta.color}18`, border: `2px solid ${meta.color}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon size={32} color={meta.color} />
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{meta.label}</h2>
        <p style={{ fontSize: 13, color: "#475569" }}>
          {isPending ? "Your application is being processed. This usually takes a few minutes." :
           state.current_status === "DOCUMENTS_UPLOADED" ? "Your documents have been uploaded. Please proceed to take your selfie." :
           state.current_status === "APPROVED" ? "Your identity has been verified. You're all set." :
           state.current_status === "REJECTED" ? "Your application was not approved. Please contact support." :
           state.current_status === "FROZEN" ? "Your account has been frozen pending compliance review." :
           "Your application is under review."}
        </p>
        {canRetakeSelfie && onBack && (
          <button
            onClick={handleBack}
            disabled={resetting}
            style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 14px", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
            {resetting ? <Spinner size={12} color="#64748b" /> : <ArrowLeft size={12} />}
            {resetting ? "Resetting…" : "Retake Selfie"}
          </button>
        )}
        {isPending && (
          <button onClick={fetchStatus} style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 14px", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
            <RefreshCw size={12} /> Refresh
          </button>
        )}
      </div>

      {/* Timeline */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "24px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>Verification Timeline</div>
        {TIMELINE_STEPS.map((step, i) => {
          const stepIdx = statusIndex(step);
          const isDone = currentIdx > stepIdx || (isTerminal && step !== "APPROVED");
          const isActive = currentIdx === stepIdx;
          const stepMeta = STATUS_META[step];
          const StepIcon = stepMeta.icon;
          return (
            <div key={step} style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: isDone ? "rgba(34,197,94,0.15)" : isActive ? `${stepMeta.color}20` : "rgba(255,255,255,0.04)", border: `1.5px solid ${isDone ? "#22c55e" : isActive ? stepMeta.color : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isDone ? <CheckCircle2 size={14} color="#22c55e" /> : <StepIcon size={13} color={isActive ? stepMeta.color : "#334155"} />}
                </div>
                {i < TIMELINE_STEPS.length - 1 && (
                  <div style={{ width: 1, flex: 1, minHeight: 24, background: isDone ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                )}
              </div>
              <div style={{ paddingBottom: i < TIMELINE_STEPS.length - 1 ? 20 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? "#94a3b8" : isActive ? "#f1f5f9" : "#334155", marginBottom: 2 }}>
                  {stepMeta.label}
                </div>
                {isActive && isPending && <div style={{ fontSize: 11, color: stepMeta.color }}>In progress…</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk score card with Recharts radial chart */}
      {finalScore !== null && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "24px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Risk Assessment</div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Radial chart */}
            <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="100%" data={chartData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Tooltip content={<ScoreTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{finalScore}</div>
                <div style={{ fontSize: 9, color, letterSpacing: "0.08em", marginTop: 2 }}>SCORE</div>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color, marginBottom: 6 }}>{scoreLabel(finalScore)}</div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
                Decision: <span style={{ color: "#94a3b8", fontWeight: 500 }}>{state.decision?.replace(/_/g, " ") || "Pending"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{ label: "KYC Risk", value: state.kyc_score, color: "#6366f1" }, { label: "AML Risk", value: state.aml_score, color: "#ef4444" }].map(({ label, value, color: c }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "#475569", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{value ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Approved banner */}
      {state.current_status === "APPROVED" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
          style={{ marginTop: 20, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 14 }}>
          <ShieldCheck size={28} color="#22c55e" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#22c55e", marginBottom: 2 }}>Identity Verified</div>
            <div style={{ fontSize: 13, color: "#475569" }}>Your account is fully verified and active.</div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

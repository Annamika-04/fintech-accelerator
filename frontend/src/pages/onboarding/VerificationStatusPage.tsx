import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, LogOut, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RadialBar, RadialBarChart, ResponsiveContainer, Tooltip } from "recharts";
import { getOnboardingStatus } from "../../api/client";
import { useOnboardingStore, OnboardingStatus } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

const STATUS_META: Record<OnboardingStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  REGISTERED: { label: "Registered", color: "#64748b", icon: Clock },
  TYPE_SELECTED: { label: "Type Selected", color: "#64748b", icon: Clock },
  PROFILE_COMPLETED: { label: "Profile Completed", color: "#6366f1", icon: CheckCircle2 },
  DOCUMENTS_UPLOADED: { label: "Documents Uploaded", color: "#6366f1", icon: CheckCircle2 },
  KYC_PENDING: { label: "KYC In Progress", color: "#f59e0b", icon: Clock },
  AML_PENDING: { label: "AML Screening", color: "#f59e0b", icon: Clock },
  UNDER_REVIEW: { label: "Under Review", color: "#f59e0b", icon: AlertTriangle },
  APPROVED: { label: "Approved", color: "#22c55e", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "#ef4444", icon: XCircle },
  FROZEN: { label: "Account Frozen", color: "#ef4444", icon: XCircle },
};

const TIMELINE_STEPS: OnboardingStatus[] = [
  "PROFILE_COMPLETED",
  "DOCUMENTS_UPLOADED",
  "KYC_PENDING",
  "AML_PENDING",
  "UNDER_REVIEW",
  "APPROVED",
];

const STATUS_ORDER: OnboardingStatus[] = [
  "REGISTERED",
  "TYPE_SELECTED",
  "PROFILE_COMPLETED",
  "DOCUMENTS_UPLOADED",
  "KYC_PENDING",
  "AML_PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "FROZEN",
];

function statusIndex(s: OnboardingStatus) {
  return STATUS_ORDER.indexOf(s);
}

interface ServerState {
  current_status: OnboardingStatus;
  onboarding_type: string | null;
  kyc_score: number | null;
  aml_score: number | null;
  final_score: number | null;
  decision: string | null;
  kyc_metadata?: {
    review_reasons?: string[];
    confidence?: Record<string, unknown>;
    score_breakdown?: Record<string, number>;
  } | null;
}

function scoreColor(s: number) {
  return s <= 29 ? "#22c55e" : s <= 59 ? "#f59e0b" : s <= 84 ? "#f97316" : "#ef4444";
}

function scoreLabel(s: number) {
  return s <= 29 ? "LOW RISK" : s <= 59 ? "MEDIUM RISK" : s <= 84 ? "HIGH RISK" : "CRITICAL RISK";
}

function verificationScoreColor(s: number) {
  return s >= 85 ? "#22c55e" : s >= 65 ? "#f59e0b" : "#ef4444";
}

function decisionLabel(decision: string | null) {
  if (!decision) return "Pending";
  return decision.replace(/_/g, " ");
}

function inferRejectedStep(state: ServerState): OnboardingStatus {
  if (state.current_status !== "REJECTED") return state.current_status;
  if (state.kyc_score !== null && state.aml_score === null) return "KYC_PENDING";
  if (state.aml_score !== null && state.final_score === null) return "AML_PENDING";
  return "UNDER_REVIEW";
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

export default function VerificationStatusPage() {
  const { setServerStatus, setScores } = useOnboardingStore();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<ServerState | null>(null);
  const [loading, setLoading] = useState(true);

  const backToLogin = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const fetchStatus = async () => {
    try {
      const res = await getOnboardingStatus();
      const data: ServerState = res.data;
      setState(data);
      setServerStatus(data.current_status);
      setScores(data.kyc_score, data.aml_score, data.final_score, data.decision);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
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
        <div style={{ color: "#475569", fontSize: 14 }}>Loading verification status...</div>
      </div>
    );
  }

  if (!state) return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: 16 }} />
      <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Could not load status</div>
      <div style={{ color: "#475569", fontSize: 13, marginBottom: 20 }}>There was a problem fetching your verification status.</div>
      <button onClick={fetchStatus} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "8px 16px", color: "#818cf8", fontSize: 13, cursor: "pointer" }}>
        <RefreshCw size={14} /> Try Again
      </button>
    </div>
  );

  const meta = STATUS_META[state.current_status];
  const Icon = meta.icon;
  const timelineStatus = inferRejectedStep(state);
  const currentIdx = statusIndex(timelineStatus);
  const isPending = ["KYC_PENDING", "AML_PENDING", "UNDER_REVIEW"].includes(state.current_status);
  const finalScore = state.final_score;
  const color = finalScore !== null ? scoreColor(finalScore) : "#64748b";
  const rejectedStepLabel = state.current_status === "REJECTED" ? STATUS_META[timelineStatus].label : null;
  const reviewReasons = state.kyc_metadata?.review_reasons ?? [];
  const verificationScore = state.kyc_score;
  const verificationColor = verificationScore !== null ? verificationScoreColor(verificationScore) : "#64748b";
  const amlCompleted = state.aml_score !== null;
  const rejectedByAml = state.current_status === "REJECTED" && amlCompleted;
  const kycManualReview = reviewReasons.length > 0 || state.kyc_metadata?.confidence?.manual_review_required === true || state.kyc_metadata?.confidence?.ocr_bypassed === true;

  const chartData = [
    ...(state.final_score !== null ? [{ name: "Final Score", value: state.final_score, fill: color }] : []),
    ...(state.kyc_score !== null ? [{ name: "KYC Risk", value: state.kyc_score, fill: "#6366f1" }] : []),
    ...(state.aml_score !== null ? [{ name: "AML Risk", value: state.aml_score, fill: "#ef4444" }] : []),
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          style={{ width: 72, height: 72, borderRadius: "50%", background: `${meta.color}18`, border: `2px solid ${meta.color}40`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}
        >
          <Icon size={32} color={meta.color} />
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{meta.label}</h2>
        <p style={{ fontSize: 13, color: "#475569" }}>
          {isPending
            ? "Your application is being processed. This usually takes a few minutes."
            : state.current_status === "APPROVED"
              ? "Your identity has been verified. You're all set."
              : state.current_status === "REJECTED"
                ? rejectedByAml
                  ? "Rejected after AML screening found a critical watchlist match."
                  : `Rejected during ${rejectedStepLabel}.`
                : "Your account has been frozen pending compliance review."}
        </p>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {isPending && (
            <button onClick={fetchStatus} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 14px", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
              <RefreshCw size={12} /> Refresh
            </button>
          )}
          <button onClick={backToLogin} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.22)", borderRadius: 8, padding: "6px 14px", color: "#818cf8", fontSize: 12, cursor: "pointer" }}>
            <LogOut size={12} /> Back to Login
          </button>
        </div>
      </div>

      {state.current_status === "UNDER_REVIEW" && amlCompleted && kycManualReview && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.24)", borderLeft: "3px solid #f59e0b", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <AlertTriangle size={18} color="#f59e0b" />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fde68a" }}>KYC requires manual review, AML completed</div>
          </div>
          <div style={{ fontSize: 12, color: "#fbbf24", lineHeight: 1.6 }}>
            Document OCR could not confidently verify every field, so KYC is under manual review. AML screening has still completed using the submitted profile data.
          </div>
        </motion.div>
      )}

      {state.current_status === "REJECTED" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.24)", borderLeft: "3px solid #ef4444", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <XCircle size={18} color="#ef4444" />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fecaca" }}>
              {rejectedByAml ? "AML screening rejected this application" : `Verification stopped at ${rejectedStepLabel}`}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.6, marginBottom: reviewReasons.length ? 10 : 0 }}>
            {rejectedByAml
              ? "A critical sanctions or watchlist match was found during AML screening."
              : "AML screening was not started because identity verification did not pass."}
          </div>
          {reviewReasons.length > 0 && (
            <div style={{ display: "grid", gap: 7 }}>
              {reviewReasons.map((reason) => (
                <div key={reason} style={{ display: "flex", gap: 8, fontSize: 12, color: "#fecaca", lineHeight: 1.45 }}>
                  <AlertTriangle size={13} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "24px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>Verification Timeline</div>
        {TIMELINE_STEPS.map((step, i) => {
          const stepIdx = statusIndex(step);
          const isFailed = state.current_status === "REJECTED" && step === timelineStatus;
          const amlActuallyRan = amlCompleted;
          const isDone = !isFailed && currentIdx > stepIdx && (step !== "AML_PENDING" || amlActuallyRan);
          const isActive = !isFailed && (currentIdx === stepIdx || (step === "AML_PENDING" && !amlActuallyRan && currentIdx > stepIdx));
          const stepMeta = STATUS_META[step];
          const StepIcon = stepMeta.icon;

          return (
            <div key={step} style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: isDone ? "rgba(34,197,94,0.15)" : isFailed ? "rgba(239,68,68,0.15)" : isActive ? `${stepMeta.color}20` : "rgba(255,255,255,0.04)", border: `1.5px solid ${isDone ? "#22c55e" : isFailed ? "#ef4444" : isActive ? stepMeta.color : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isDone ? <CheckCircle2 size={14} color="#22c55e" /> : isFailed ? <XCircle size={14} color="#ef4444" /> : <StepIcon size={13} color={isActive ? stepMeta.color : "#334155"} />}
                </div>
                {i < TIMELINE_STEPS.length - 1 && (
                  <div style={{ width: 1, flex: 1, minHeight: 24, background: isDone ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                )}
              </div>
              <div style={{ paddingBottom: i < TIMELINE_STEPS.length - 1 ? 20 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? "#94a3b8" : isFailed ? "#fecaca" : isActive ? "#f1f5f9" : "#334155", marginBottom: 2 }}>
                  {stepMeta.label}
                </div>
                {isActive && isPending && step !== "AML_PENDING" && <div style={{ fontSize: 11, color: stepMeta.color }}>In progress...</div>}
                {step === "AML_PENDING" && amlActuallyRan && <div style={{ fontSize: 11, color: "#22c55e" }}>Completed</div>}
                {step === "AML_PENDING" && !amlActuallyRan && currentIdx > stepIdx && <div style={{ fontSize: 11, color: "#64748b" }}>Waiting</div>}
                {isFailed && <div style={{ fontSize: 11, color: "#ef4444" }}>Rejected here</div>}
              </div>
            </div>
          );
        })}
      </div>

      {state.current_status === "REJECTED" && verificationScore !== null && finalScore === null && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>KYC Verification Result</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>KYC score</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: verificationColor }}>{verificationScore}</div>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, textAlign: "right" }}>
              Required: 85+ to continue to AML screening.
            </div>
          </div>
        </motion.div>
      )}

      {finalScore !== null && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "24px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Risk Assessment</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
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
                Decision: <span style={{ color: "#94a3b8", fontWeight: 500 }}>{decisionLabel(state.decision)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

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

      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <button onClick={backToLogin} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 150, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 16px", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <LogOut size={14} /> Logout
        </button>
      </div>
    </motion.div>
  );
}

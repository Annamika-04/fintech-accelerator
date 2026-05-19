import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, User, ArrowRight, ShieldCheck } from "lucide-react";
import { selectOnboardingType } from "../../api/client";
import { useOnboardingStore, OnboardingType } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import toast from "react-hot-toast";

interface Props {
  onSelect: (type: OnboardingType) => void;
}

const options = [
  {
    type: "individual" as OnboardingType,
    icon: User,
    title: "Individual",
    subtitle: "Personal KYC verification",
    points: ["Identity document verification", "Face match & liveness", "AML & PEP screening"],
    accent: "#6366f1",
    bg: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.25)",
  },
  {
    type: "corporate" as OnboardingType,
    icon: Building2,
    title: "Corporate / Organisation",
    subtitle: "Business entity onboarding",
    points: ["Company document verification", "Director & UBO management", "Corporate AML screening"],
    accent: "#0ea5e9",
    bg: "rgba(14,165,233,0.08)",
    border: "rgba(14,165,233,0.25)",
  },
];

export default function TypeSelectionPage({ onSelect }: Props) {
  const [selected, setSelected] = useState<OnboardingType | null>(null);
  const [loading, setLoading] = useState(false);
  const { setOnboardingType, setServerStatus, nextStep } = useOnboardingStore();

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await selectOnboardingType(selected);
      setOnboardingType(selected);
      setServerStatus(res.data.current_status);
      nextStep();
      onSelect(selected);
    } catch {
      toast.error("Failed to save selection. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: "center", marginBottom: 48 }}
      >
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 100, padding: "6px 16px", marginBottom: 20,
        }}>
          <ShieldCheck size={14} color="#818cf8" />
          <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 500, letterSpacing: "0.08em" }}>
            KYC ONBOARDING
          </span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f1f5f9", marginBottom: 10, letterSpacing: "-0.02em" }}>
          Select Account Type
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>
          Choose the type of account you want to verify. Each flow is tailored to its compliance requirements.
        </p>
      </motion.div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        {options.map((opt, i) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.type;
          return (
            <motion.div
              key={opt.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.2 }}
              onClick={() => setSelected(opt.type)}
              style={{
                background: isSelected ? opt.bg : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${isSelected ? opt.accent : "rgba(255,255,255,0.08)"}`,
                borderRadius: 16,
                padding: "28px 24px",
                cursor: "pointer",
                transition: "all 0.2s",
                position: "relative",
                boxShadow: isSelected ? `0 0 0 1px ${opt.accent}30, 0 8px 32px ${opt.accent}15` : "none",
              }}
            >
              {isSelected && (
                <div style={{
                  position: "absolute", top: 14, right: 14,
                  width: 20, height: 20, borderRadius: "50%",
                  background: opt.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}

              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: isSelected ? opt.bg : "rgba(255,255,255,0.05)",
                border: `1px solid ${isSelected ? opt.border : "rgba(255,255,255,0.08)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16,
              }}>
                <Icon size={22} color={isSelected ? opt.accent : "#64748b"} />
              </div>

              <div style={{ fontSize: 16, fontWeight: 600, color: isSelected ? "#f1f5f9" : "#94a3b8", marginBottom: 4 }}>
                {opt.title}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>{opt.subtitle}</div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {opt.points.map((p) => (
                  <li key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: isSelected ? "#94a3b8" : "#475569" }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? opt.accent : "#334155", flexShrink: 0 }} />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          style={{
            width: "100%", padding: "15px 24px",
            background: selected ? "#6366f1" : "rgba(255,255,255,0.05)",
            border: `1px solid ${selected ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
            borderRadius: 12, color: selected ? "#fff" : "#475569",
            fontSize: 14, fontWeight: 600, cursor: selected ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s",
            letterSpacing: "0.02em",
          }}
        >
          {loading ? <><Spinner size={14} color="#fff" /> Saving…</> : <>Continue <ArrowRight size={16} /></>}
        </button>
      </motion.div>

    </div>
  );
}

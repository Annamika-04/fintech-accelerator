import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { getOnboardingResume } from "../../api/client";
import { useOnboardingStore, OnboardingType } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import TypeSelectionPage from "./TypeSelectionPage";
import IndividualProfilePage from "./IndividualProfilePage";
import CorporateProfilePage from "./CorporateProfilePage";
import DocumentUploadPage from "./DocumentUploadPage";
import SelfieCapturePage from "./SelfieCapturePage";
import VerificationStatusPage from "./VerificationStatusPage";

// Steps: 0=type, 1=profile, 2=documents, 3=selfie, 4=status
const INDIVIDUAL_STEPS = ["Account Type", "Personal Info", "Documents", "Selfie", "Status"];
const CORPORATE_STEPS  = ["Account Type", "Company Info", "Documents", "Selfie", "Status"];

export default function OnboardingWizard() {
  const { user } = useAuth();
  const {
    ownerUserId, currentStep, onboardingType, setStep, setServerStatus,
    setOnboardingType, setOwnerUserId, reset,
  } = useOnboardingStore();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(0);

  const stepMap: Record<string, number> = {
    REGISTERED: 0,
    TYPE_SELECTED: 1,
    PROFILE_COMPLETED: 2,
    DOCUMENTS_UPLOADED: 3,
    KYC_PENDING: 4,
    AML_PENDING: 4,
    UNDER_REVIEW: 4,
    APPROVED: 4,
    REJECTED: 4,
    FROZEN: 4,
  };

  // On mount: sync with server state to resume interrupted sessions
  useEffect(() => {
    if (user?.id && ownerUserId && ownerUserId !== user.id) {
      reset();
    }

    getOnboardingResume()
      .then((res) => {
        const { state } = res.data;
        const { current_status, onboarding_type, profile_id, user_id } = state;
        setOwnerUserId(user_id);
        setServerStatus(current_status);
        setOnboardingType((onboarding_type as OnboardingType | null) ?? null);
        if (profile_id) {
          useOnboardingStore.getState().setProfileId(profile_id);
        }
        const resumeStep = stepMap[current_status] ?? 0;
        setStep(resumeStep);
        setMaxUnlockedStep(resumeStep);
      })
      .catch(() => {})
      .finally(() => setBootstrapped(true));
  }, [user?.id]);

  const steps = onboardingType === "corporate" ? CORPORATE_STEPS : INDIVIDUAL_STEPS;
  const progress = ((currentStep) / (steps.length - 1)) * 100;

  const goBack = () => setStep(Math.max(0, currentStep - 1));
  const goNext = () => {
    const next = Math.min(steps.length - 1, currentStep + 1);
    setStep(next);
    setMaxUnlockedStep((prev) => Math.max(prev, next));
  };
  const goToStep = (target: number) => {
    if (target <= maxUnlockedStep) {
      setStep(target);
    }
  };

  if (!bootstrapped) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={36} color="#6366f1" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f1a", fontFamily: "'Inter', sans-serif" }}>
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13 } }} />

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={20} color="#6366f1" />
          <span style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>VeritasAML</span>
          <span style={{ fontSize: 11, color: "#334155", marginLeft: 4 }}>/ KYC Onboarding</span>
        </div>
        <div style={{ fontSize: 12, color: "#475569" }}>
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #818cf8)", borderRadius: "0 2px 2px 0" }}
        />
      </div>

      {/* Step labels */}
      <div style={{ display: "flex", justifyContent: "center", gap: 0, padding: "20px 32px 0", overflowX: "auto" }}>
        {steps.map((label, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          const isClickable = i <= maxUnlockedStep;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => goToStep(i)}
                disabled={!isClickable}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 80, background: "transparent", border: "none", padding: 0, cursor: isClickable ? "pointer" : "not-allowed", opacity: isClickable ? 1 : 0.7 }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isDone ? "#6366f1" : isActive ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isDone ? "#6366f1" : isActive ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600,
                  color: isDone ? "#fff" : isActive ? "#818cf8" : "#334155",
                }}>
                  {isDone ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 10, color: isActive ? "#818cf8" : isDone ? "#64748b" : "#334155", fontWeight: isActive ? 600 : 400, whiteSpace: "nowrap" }}>
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div style={{ width: 40, height: 1, background: i < currentStep ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)", margin: "0 4px", marginBottom: 20 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {currentStep === 0 && (
            <TypeSelectionPage onSelect={() => goNext()} />
          )}
          {currentStep === 1 && onboardingType === "individual" && (
            <IndividualProfilePage onBack={goBack} onNext={goNext} />
          )}
          {currentStep === 1 && onboardingType === "corporate" && (
            <CorporateProfilePage onBack={goBack} onNext={goNext} />
          )}
          {currentStep === 1 && !onboardingType && (
            <TypeSelectionPage onSelect={() => {}} />
          )}
          {currentStep === 2 && (
            <DocumentUploadPage onBack={goBack} onNext={goNext} onboardingType={onboardingType || "individual"} />
          )}
          {currentStep === 3 && (
            <SelfieCapturePage onBack={goBack} onNext={goNext} />
          )}
          {currentStep === 4 && (
            <VerificationStatusPage />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

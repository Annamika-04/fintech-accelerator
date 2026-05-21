import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { resumeOnboarding } from "../../api/client";
import { useOnboardingStore, OnboardingType } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
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
  const { currentStep, onboardingType, serverStatus, setStep, setServerStatus, setOnboardingType, mergeStepData, setIdDocumentS3Key } = useOnboardingStore();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    resumeOnboarding()
      .then((res) => {
        const { current_status, onboarding_type, step_data } = res.data;
        setServerStatus(current_status);
        if (onboarding_type) setOnboardingType(onboarding_type as OnboardingType);
        if (step_data) {
          mergeStepData(step_data);
          // restore id document s3 key from backend step_data if not already in store
          const docs = step_data.documents as Array<{ s3Key?: string }> | undefined;
          if (docs?.[0]?.s3Key) setIdDocumentS3Key(docs[0].s3Key);
          else if (step_data.document_upload?.s3_key) setIdDocumentS3Key(step_data.document_upload.s3_key as string);
        }
        // Always trust server status for step
        const stepMap: Record<string, number> = {
          REGISTERED: 0, TYPE_SELECTED: 1,
          PROFILE_COMPLETED: 2, DOCUMENTS_UPLOADED: 3,
          KYC_PENDING: 4, AML_PENDING: 4,
          UNDER_REVIEW: 4, APPROVED: 4, REJECTED: 4, FROZEN: 4,
        };
        setStep(stepMap[current_status] ?? 0);
      })
      .catch(() => {})
      .finally(() => setBootstrapped(true));
  }, []);

  const steps = onboardingType === "corporate" ? CORPORATE_STEPS : INDIVIDUAL_STEPS;
  const progress = ((currentStep) / (steps.length - 1)) * 100;

  const goBack = () => setStep(Math.max(0, currentStep - 1));
  const goNext = () => setStep(Math.min(steps.length - 1, currentStep + 1));

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
          return (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 80 }}>
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
              </div>
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
            <VerificationStatusPage onBack={goBack} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

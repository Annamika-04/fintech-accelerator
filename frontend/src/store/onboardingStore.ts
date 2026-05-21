import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OnboardingType = "individual" | "corporate";

export type OnboardingStatus =
  | "REGISTERED"
  | "TYPE_SELECTED"
  | "PROFILE_COMPLETED"
  | "DOCUMENTS_UPLOADED"
  | "KYC_PENDING"
  | "AML_PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FROZEN";

export interface OnboardingState {
  // Server state
  serverStatus: OnboardingStatus | null;
  onboardingType: OnboardingType | null;
  profileId: string | null;
  kycScore: number | null;
  amlScore: number | null;
  finalScore: number | null;
  decision: string | null;

  // Wizard UI state
  currentStep: number;

  // ID document s3 key from document upload step
  idDocumentS3Key: string | null;

  // Prefill data per step — populated from /onboarding/resume
  stepData: Record<string, Record<string, unknown>>;

  // Actions
  setServerStatus: (s: OnboardingStatus) => void;
  setOnboardingType: (t: OnboardingType) => void;
  setProfileId: (id: string) => void;
  setScores: (kyc: number | null, aml: number | null, final: number | null, decision: string | null) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  setIdDocumentS3Key: (key: string) => void;
  setStepData: (data: Record<string, Record<string, unknown>>) => void;
  mergeStepData: (data: Record<string, Record<string, unknown>>) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      serverStatus: null,
      onboardingType: null,
      profileId: null,
      kycScore: null,
      amlScore: null,
      finalScore: null,
      decision: null,
      currentStep: 0,
      idDocumentS3Key: null,
      stepData: {},

      setServerStatus: (s) => set({ serverStatus: s }),
      setOnboardingType: (t) => set({ onboardingType: t }),
      setProfileId: (id) => set({ profileId: id }),
      setScores: (kyc, aml, final, decision) =>
        set({ kycScore: kyc, amlScore: aml, finalScore: final, decision }),
      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((s) => ({ currentStep: s.currentStep + 1 })),
      setIdDocumentS3Key: (key) => set({ idDocumentS3Key: key }),
      setStepData: (data) => set({ stepData: data }),
      mergeStepData: (data) => set((s) => ({ stepData: { ...s.stepData, ...data } })),
      reset: () =>
        set({
          serverStatus: null,
          onboardingType: null,
          profileId: null,
          kycScore: null,
          amlScore: null,
          finalScore: null,
          decision: null,
          currentStep: 0,
          idDocumentS3Key: null,
          stepData: {},
        }),
    }),
    { name: "kyc-onboarding" }
  )
);

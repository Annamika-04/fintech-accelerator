import axios from "axios";

const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("otp_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const sendOtp = (phone: string) =>
  api.post("/auth/send-otp", { phone });

export const verifyOtp = (phone: string, otp: string) =>
  api.post("/auth/verify-otp", { phone, otp });

export const registerUser = (data: { email: string; password: string; supabase_uid?: string; role?: string }) =>
  api.post("/auth/register", data);

export const getMe = () => api.get("/auth/me");

export const listUsers = () => api.get("/auth/users");

// ── Documents ─────────────────────────────────────────────────────────────────
export const getPresignedUrl = (data: {
  document_type: string;
  filename: string;
  content_type: string;
  file_size_bytes: number;
}) => api.post("/documents/presigned-url", data);

export const confirmUpload = (data: { document_id: string; file_hash: string }) =>
  api.post("/documents/confirm", data);

export const uploadDocumentDirect = (documentType: string, file: File) => {
  const formData = new FormData();
  formData.append("document_type", documentType);
  formData.append("file", file);
  return api.post("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const listDocuments = () => api.get("/documents/");

// ── Face Verification ─────────────────────────────────────────────────────────
export const submitFaceVerification = (data: {
  selfie_s3_key: string;
  id_document_s3_key: string;
}) => api.post("/face-verification/", data);

export const getFaceVerification = (id: string) => api.get(`/face-verification/${id}`);

// ── AML ───────────────────────────────────────────────────────────────────────
export const screenAML = (data: {
  full_name: string;
  date_of_birth?: string;
  profile_type?: string;
}) => api.post("/aml/screen", data);

export const getAMLResults = (userId: string) => api.get(`/aml/results/${userId}`);

// ── Risk ──────────────────────────────────────────────────────────────────────
export const calculateRisk = (data: Record<string, unknown>) =>
  api.post("/risk/calculate", data);

export const getRiskHistory = (userId: string) => api.get(`/risk/history/${userId}`);

// ── Cases ─────────────────────────────────────────────────────────────────────
export const createCase = (data: {
  user_id: string;
  case_type: string;
  priority?: string;
  notes?: string;
}) => api.post("/cases/", data);

export const listCases = () => api.get("/cases/");

export const resolveCase = (caseId: string) => api.patch(`/cases/${caseId}/resolve`);

// ── Onboarding ────────────────────────────────────────────────────────────────
export const getOnboardingStatus = () => api.get("/onboarding/status");
export const getOnboardingResume = () => api.get("/onboarding/resume");

export const selectOnboardingType = (onboarding_type: "individual" | "corporate") =>
  api.post("/onboarding/select-type", { onboarding_type });

export const saveIndividualProfile = (data: Record<string, unknown>) =>
  api.post("/onboarding/individual/profile", data);

export const getIndividualProfile = () => api.get("/onboarding/individual/profile");

export const saveCorporateProfile = (data: Record<string, unknown>) =>
  api.post("/onboarding/corporate/profile", data);

export const getCorporateProfile = () => api.get("/onboarding/corporate/profile");

export const addDirector = (data: Record<string, unknown>) =>
  api.post("/onboarding/corporate/directors", data);

export const listDirectors = () => api.get("/onboarding/corporate/directors");

export const removeDirector = (id: string) =>
  api.delete(`/onboarding/corporate/directors/${id}`);

export const markDocumentsUploaded = () =>
  api.post("/onboarding/advance/documents-uploaded");

export const triggerKYC = () => api.post("/onboarding/advance/kyc-pending");

export const makeDecision = (userId: string, decision: string) =>
  api.post(`/onboarding/decision/${userId}?decision=${decision}`);

export default api;

import axios from "axios";

const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const registerUser = (data: { email: string; cognito_sub: string; role?: string }) =>
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

export default api;

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import PhoneLoginPage from "./pages/PhoneLoginPage";
import OtpVerificationPage from "./pages/OtpVerificationPage";
import DocumentsPage from "./pages/DocumentsPage";
import FaceVerificationPage from "./pages/FaceVerificationPage";
import AMLPage from "./pages/AMLPage";
import RiskPage from "./pages/RiskPage";
import CasesPage from "./pages/CasesPage";
import UsersPage from "./pages/UsersPage";
import OnboardingWizard from "./pages/onboarding/OnboardingWizard";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoutes() {
  const { token, loading, user } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0b0f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner size={36} color="#6366f1" />
    </div>
  );
  if (!token) return <Navigate to="/login" replace />;

  // Customers go through onboarding wizard; staff go to dashboard
  const isStaff = user && ["kyc_officer", "aml_analyst", "compliance_manager", "auditor", "admin"].includes(user.role);

  return (
    <Routes>
      {/* Onboarding wizard for customers */}
      <Route path="onboarding/*" element={<OnboardingWizard />} />

      {/* Dashboard for staff */}
      <Route element={<Layout />}>
        <Route index element={<Navigate to={isStaff ? "/documents" : "/onboarding"} replace />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="face-verification" element={<FaceVerificationPage />} />
        <Route path="aml" element={<AMLPage />} />
        <Route path="risk" element={<RiskPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PhoneLoginPage />} />
            <Route path="/verify-otp" element={<OtpVerificationPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

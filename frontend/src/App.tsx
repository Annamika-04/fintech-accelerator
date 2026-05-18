import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DocumentsPage from "./pages/DocumentsPage";
import FaceVerificationPage from "./pages/FaceVerificationPage";
import AMLPage from "./pages/AMLPage";
import RiskPage from "./pages/RiskPage";
import CasesPage from "./pages/CasesPage";
import UsersPage from "./pages/UsersPage";

function ProtectedRoutes() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/documents" replace />} />
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

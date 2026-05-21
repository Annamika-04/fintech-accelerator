import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { verifyOtp, sendOtp } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useOnboardingStore } from "../store/onboardingStore";
import { Spinner } from "../components/ui";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function OtpVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithOtp } = useAuth();
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  const phone: string = (location.state as { phone?: string })?.phone || "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no phone in state
  useEffect(() => {
    if (!phone) navigate("/login", { replace: true });
  }, [phone]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (digits.every((d) => d !== "") && !loading && !success) {
      handleVerify(digits.join(""));
    }
  }, [digits]);

  const focusNext = (idx: number) => inputRefs.current[idx + 1]?.focus();
  const focusPrev = (idx: number) => inputRefs.current[idx - 1]?.focus();

  const handleChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError("");
    if (digit) focusNext(idx);
  };

  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ""; setDigits(next);
      } else {
        focusPrev(idx);
      }
    } else if (e.key === "ArrowLeft") focusPrev(idx);
    else if (e.key === "ArrowRight") focusNext(idx);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(""));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleVerify = async (otp: string) => {
    setLoading(true); setError("");
    try {
      const { data } = await verifyOtp(phone, otp);
      setSuccess(true);
      await loginWithOtp(data.access_token, data.refresh_token);
      // always reset store — server state will drive the correct step
      resetOnboarding();

      // Route based on onboarding status
      const status: string = data.onboarding_status;
      const staffRoles = ["kyc_officer", "aml_analyst", "compliance_manager", "auditor", "admin"];
      if (staffRoles.includes(data.user.role)) {
        navigate("/documents", { replace: true });
      } else if (status === "APPROVED" || status === "REJECTED" || status === "FROZEN") {
        navigate("/onboarding", { replace: true });
      } else if (status === "REGISTERED") {
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Invalid OTP. Please try again.");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true); setError("");
    try {
      await sendOtp(phone);
      setDigits(Array(OTP_LENGTH).fill(""));
      setCountdown(RESEND_COOLDOWN);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to resend OTP.");
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phone.length > 6
    ? phone.slice(0, phone.length - 4).replace(/\d(?=\d{2})/g, "•") + phone.slice(-4)
    : phone;

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", padding: "24px" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}
      >
        {/* Gold top bar */}
        <div style={{ height: 3, background: "linear-gradient(90deg, #b49146, #d4a940, #b49146)" }} />

        <div style={{ padding: "40px 40px 36px" }}>
          {/* Back */}
          <button onClick={() => navigate("/login")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer", marginBottom: 28, padding: 0 }}>
            <ArrowLeft size={14} /> Back to phone
          </button>

          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}
          >
            <ShieldCheck size={26} color="#6366f1" />
          </motion.div>

          <h2 style={{ fontSize: 24, fontWeight: 600, color: "#0f1c35", marginBottom: 8, letterSpacing: "-0.01em" }}>Verify your number</h2>
          <p style={{ fontSize: 13, color: "#6b7a99", lineHeight: 1.65, marginBottom: 32 }}>
            Enter the 6-digit code sent to <span style={{ fontWeight: 600, color: "#374151" }}>{maskedPhone}</span>
          </p>

          {/* OTP boxes */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }}>
            {digits.map((d, i) => (
              <motion.input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                autoFocus={i === 0}
                disabled={loading || success}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  width: 52, height: 60,
                  textAlign: "center", fontSize: 22, fontWeight: 700,
                  background: d ? "#f0f0ff" : "#f8f9fc",
                  border: `2px solid ${error ? "#fecaca" : d ? "#6366f1" : "#e2e6f0"}`,
                  borderRadius: 12, color: "#0f1c35",
                  outline: "none", fontFamily: "inherit",
                  transition: "all 0.15s",
                  cursor: loading || success ? "not-allowed" : "text",
                }}
              />
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff5f5", border: "1px solid #fecaca", borderLeft: "3px solid #dc2626", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c" }}
              >
                ⚠ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#15803d" }}
              >
                <ShieldCheck size={14} /> Verified! Redirecting…
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <button
            onClick={() => handleVerify(digits.join(""))}
            disabled={loading || success || digits.some((d) => !d)}
            style={{ width: "100%", background: digits.every((d) => d) ? "#0f1c35" : "#e5e7eb", border: "none", borderRadius: 10, padding: "15px", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: digits.every((d) => d) ? "#fff" : "#9ca3af", cursor: digits.every((d) => d) && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s", boxShadow: digits.every((d) => d) ? "0 4px 16px rgba(15,28,53,0.22)" : "none", marginBottom: 20 }}
          >
            {loading ? <><Spinner size={14} color="#fff" /> Verifying…</> : "Verify & Continue"}
          </button>

          {/* Resend */}
          <div style={{ textAlign: "center" }}>
            {countdown > 0 ? (
              <span style={{ fontSize: 13, color: "#9ca3af" }}>
                Resend OTP in <span style={{ fontWeight: 600, color: "#374151" }}>{countdown}s</span>
              </span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                style={{ background: "none", border: "none", fontSize: 13, color: "#6366f1", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {resending ? <Spinner size={12} color="#6366f1" /> : <RefreshCw size={13} />}
                {resending ? "Sending…" : "Resend OTP"}
              </button>
            )}
          </div>

          {/* Demo note */}
          <div style={{ marginTop: 24, padding: "10px 14px", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "#6366f1", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={11} />
              <span style={{ fontWeight: 600 }}>Demo Mode</span>
              <span style={{ color: "#94a3b8" }}>— Check the backend terminal for your OTP</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

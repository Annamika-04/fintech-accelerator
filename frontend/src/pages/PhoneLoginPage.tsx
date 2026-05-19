import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, ArrowRight, ShieldCheck } from "lucide-react";
import { sendOtp } from "../api/client";
import { Spinner, ErrorState } from "../components/ui";

const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+1",   flag: "🇺🇸", name: "USA" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
];

export default function PhoneLoginPage() {
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setError(""); setLoading(true);
    try {
      await sendOtp(fullPhone);
      // Pass phone via state so OTP page knows which number to verify
      navigate("/verify-otp", { state: { phone: fullPhone } });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f1a", display: "flex", fontFamily: "'Inter', sans-serif" }}>
      {/* Left panel */}
      <motion.div
        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
        style={{ flex: 1, background: "#0d1117", borderRight: "1px solid rgba(180,145,70,0.12)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 60px", position: "relative", overflow: "hidden" }}
        className="hide-mobile"
      >
        {/* Dot grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(180,145,70,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.5, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: 320, height: 320, background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 2 }}>
          <div style={{ width: 40, height: 40, background: "rgba(180,145,70,0.1)", border: "1.5px solid rgba(180,145,70,0.4)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⬡</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e8d9b0", letterSpacing: "0.03em" }}>VeritasAML</div>
            <div style={{ fontSize: 9, color: "rgba(180,145,70,0.5)", letterSpacing: "0.15em", textTransform: "uppercase" }}>Compliance Intelligence</div>
          </div>
        </div>

        {/* Hero */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 100, padding: "5px 14px", marginBottom: 24 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1" }} />
            <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>Secure Mobile Auth</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.2, marginBottom: 16, letterSpacing: "-0.02em" }}>
            Intelligent <span style={{ color: "#b49146" }}>KYC & AML</span><br />Compliance
          </h1>
          <p style={{ fontSize: 14, color: "rgba(190,205,230,0.55)", lineHeight: 1.8, maxWidth: 380, marginBottom: 40 }}>
            Enterprise-grade identity verification and anti-money laundering screening — secured with mobile OTP authentication.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["AML / CFT", "FATF Aligned", "ISO 27001", "SOC 2"].map((t) => (
              <span key={t} style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(180,145,70,0.8)", background: "rgba(180,145,70,0.08)", border: "1px solid rgba(180,145,70,0.18)", borderRadius: 6, padding: "5px 12px" }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", position: "relative", zIndex: 2 }}>
          {[{ val: "99.4%", label: "Detection Rate" }, { val: "<2 min", label: "Avg. Review" }, { val: "140+", label: "Jurisdictions" }].map((s, i) => (
            <div key={s.label} style={{ flex: 1, padding: "20px 24px", borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "rgba(180,145,70,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Right panel — login form */}
      <div style={{ width: 480, display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px 52px", background: "#fff", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #b49146, #d4a940, #b49146)" }} />

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>
          {/* Secure badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#f0f7f0", border: "1px solid #b8ddb8", borderRadius: 100, padding: "5px 14px 5px 8px", marginBottom: 28 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2ea043", boxShadow: "0 0 0 2px rgba(46,160,67,0.25)" }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: "#1a6b2a", letterSpacing: "0.05em" }}>Systems Operational · Secure Connection</span>
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#b49146", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
            Mobile Authentication
            <div style={{ flex: 1, height: 1, background: "#e8e0cc" }} />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 600, color: "#0f1c35", marginBottom: 8, letterSpacing: "-0.01em" }}>Sign In</h2>
          <p style={{ fontSize: 13, color: "#6b7a99", lineHeight: 1.65, marginBottom: 32 }}>
            Enter your mobile number to receive a one-time verification code.
          </p>

          {error && <ErrorState message={error} onRetry={() => setError("")} />}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#374151", marginBottom: 8 }}>
                Mobile Number
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ width: 110, background: "#f8f9fc", border: "1.5px solid #e2e6f0", borderRadius: 10, padding: "13px 10px", fontSize: 13, color: "#0f1c35", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
                <div style={{ flex: 1, position: "relative" }}>
                  <Phone size={15} color="#9ca3af" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    required
                    maxLength={12}
                    style={{ width: "100%", background: "#f8f9fc", border: "1.5px solid #e2e6f0", borderRadius: 10, padding: "13px 14px 13px 38px", fontSize: 14, color: "#0f1c35", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                    onFocus={(e) => { e.target.style.borderColor = "#b49146"; e.target.style.boxShadow = "0 0 0 3px rgba(180,145,70,0.1)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#e2e6f0"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>
              {phone && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                  Full number: <span style={{ color: "#374151", fontWeight: 500 }}>{fullPhone}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || phone.length < 7}
              style={{ width: "100%", background: phone.length >= 7 ? "#0f1c35" : "#e5e7eb", border: "none", borderRadius: 10, padding: "15px 20px", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: phone.length >= 7 ? "#fff" : "#9ca3af", cursor: phone.length >= 7 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s", boxShadow: phone.length >= 7 ? "0 4px 16px rgba(15,28,53,0.22)" : "none" }}
            >
              {loading ? <><Spinner size={14} color="#fff" /> Sending OTP…</> : <>Send OTP <ArrowRight size={15} /></>}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid #f0f2f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {[{ icon: "🔒", text: "256-bit TLS" }, { icon: "⏱", text: "OTP · 5 min" }, { icon: "✓", text: "GDPR Compliant" }].map((f) => (
              <span key={f.text} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 500, color: "#9ca3af" }}>
                {f.icon} {f.text}
              </span>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6366f1" }}>
              <ShieldCheck size={12} />
              <span style={{ fontWeight: 600 }}>Demo Mode</span>
              <span style={{ color: "#94a3b8" }}>— OTP will be printed in the backend terminal</span>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`@media (max-width: 860px) { .hide-mobile { display: none !important; } }`}</style>
    </div>
  );
}

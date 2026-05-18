import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {}, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(token.trim());
      navigate("/documents");
    } catch {
      setError("Authentication failed. Please verify your token and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lr {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', sans-serif;
          background: #f4f5f7;
        }

        /* ═══════════════════════════════
           LEFT PANEL
        ═══════════════════════════════ */
        .lp {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 60px;
          background: #0f1c35;
          position: relative;
          overflow: hidden;
        }

        /* diagonal geometric accent */
        .lp-accent {
          position: absolute;
          top: 0; right: 0;
          width: 340px; height: 340px;
          background: linear-gradient(135deg, rgba(180,145,70,0.12) 0%, transparent 60%);
          border-radius: 0 0 0 100%;
          pointer-events: none;
        }
        .lp-accent2 {
          position: absolute;
          bottom: -60px; left: -60px;
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(180,145,70,0.07) 0%, transparent 70%);
          pointer-events: none;
        }

        /* dot grid */
        .dot-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(180,145,70,0.18) 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.4;
          pointer-events: none;
        }

        /* brand */
        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 2;
          opacity: 0;
          transform: translateY(10px);
          animation: aUp 0.55s ease forwards 0.05s;
        }
        .brand-shield {
          width: 44px; height: 44px;
          background: rgba(180,145,70,0.15);
          border: 1.5px solid rgba(180,145,70,0.5);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .brand-text-name {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.02em;
        }
        .brand-text-tag {
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(180,145,70,0.7);
          margin-top: 2px;
        }

        /* hero */
        .hero {
          position: relative;
          z-index: 2;
          opacity: 0;
          transform: translateY(18px);
          animation: aUp 0.65s ease forwards 0.2s;
        }
        .hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(180,145,70,0.12);
          border: 1px solid rgba(180,145,70,0.28);
          border-radius: 100px;
          padding: 5px 14px 5px 10px;
          margin-bottom: 28px;
        }
        .hero-pill-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #b49146;
        }
        .hero-pill-text {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #c9a95a;
        }
        .hero-h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px, 3.4vw, 48px);
          font-weight: 500;
          line-height: 1.18;
          color: #ffffff;
          margin-bottom: 22px;
        }
        .hero-h1 em {
          font-style: italic;
          color: #c9a95a;
        }
        .hero-p {
          font-size: 14.5px;
          line-height: 1.8;
          color: rgba(190,205,230,0.6);
          font-weight: 300;
          max-width: 400px;
          margin-bottom: 36px;
        }

        /* compliance tags */
        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: rgba(201,169,90,0.85);
          background: rgba(180,145,70,0.08);
          border: 1px solid rgba(180,145,70,0.2);
          border-radius: 6px;
          padding: 6px 12px;
        }
        .tag-check {
          width: 14px; height: 14px;
          border-radius: 50%;
          background: rgba(180,145,70,0.2);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        /* stats */
        .stats {
          display: flex;
          gap: 0;
          position: relative;
          z-index: 2;
          opacity: 0;
          transform: translateY(10px);
          animation: aUp 0.55s ease forwards 0.38s;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          overflow: hidden;
        }
        .stat {
          flex: 1;
          padding: 20px 24px;
          position: relative;
        }
        .stat + .stat {
          border-left: 1px solid rgba(255,255,255,0.07);
        }
        .stat-val {
          font-family: 'Playfair Display', serif;
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
        }
        .stat-label {
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(180,145,70,0.55);
        }

        /* ═══════════════════════════════
           RIGHT PANEL
        ═══════════════════════════════ */
        .rp {
          width: 480px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 64px 52px;
          position: relative;
          box-shadow: -2px 0 40px rgba(0,0,0,0.08);
        }

        /* top accent bar */
        .rp::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #b49146, #d4a940, #b49146);
        }

        .form-wrap {
          opacity: 0;
          transform: translateX(16px);
          animation: aLeft 0.65s ease forwards 0.3s;
        }

        /* secure badge */
        .secure-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #f0f7f0;
          border: 1px solid #b8ddb8;
          border-radius: 100px;
          padding: 5px 14px 5px 8px;
          margin-bottom: 28px;
        }
        .secure-badge-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #2ea043;
          box-shadow: 0 0 0 2px rgba(46,160,67,0.25);
        }
        .secure-badge-text {
          font-size: 11px;
          font-weight: 500;
          color: #1a6b2a;
          letter-spacing: 0.05em;
        }

        /* form header */
        .form-eyebrow {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #b49146;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .form-eyebrow::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e8e0cc;
        }
        .form-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px;
          font-weight: 500;
          color: #0f1c35;
          margin-bottom: 8px;
          line-height: 1.2;
        }
        .form-sub {
          font-size: 13.5px;
          color: #6b7a99;
          line-height: 1.65;
          font-weight: 300;
          margin-bottom: 32px;
        }

        /* field */
        .field-group {
          margin-bottom: 18px;
        }
        .field-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #374151;
          margin-bottom: 8px;
        }
        .field-label-required {
          color: #b49146;
          font-size: 14px;
          line-height: 1;
        }
        .field-textarea {
          width: 100%;
          background: #f8f9fc;
          border: 1.5px solid #e2e6f0;
          border-radius: 10px;
          padding: 14px 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          color: #0f1c35;
          resize: none;
          height: 112px;
          outline: none;
          line-height: 1.6;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .field-textarea::placeholder {
          color: #b0bbc8;
          font-family: 'JetBrains Mono', monospace;
        }
        .field-textarea:focus {
          border-color: #b49146;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(180,145,70,0.1);
        }

        /* demo hint */
        .demo-hint {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: #fffbf0;
          border: 1px solid #e8d5a0;
          border-left: 3px solid #b49146;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 22px;
        }
        .demo-hint-icon {
          font-size: 14px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .demo-hint-text {
          font-size: 12.5px;
          color: #7a6030;
          line-height: 1.55;
        }
        .demo-hint-text code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          background: rgba(180,145,70,0.15);
          color: #8a5c00;
          padding: 1px 7px;
          border-radius: 4px;
          font-weight: 500;
        }

        /* error */
        .err-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff5f5;
          border: 1px solid #fecaca;
          border-left: 3px solid #dc2626;
          border-radius: 8px;
          padding: 11px 14px;
          margin-bottom: 18px;
          font-size: 13px;
          color: #b91c1c;
          font-weight: 400;
        }

        /* submit */
        .btn-submit {
          width: 100%;
          background: #0f1c35;
          border: 2px solid #0f1c35;
          border-radius: 10px;
          padding: 15px 20px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 16px rgba(15,28,53,0.22);
          margin-bottom: 12px;
        }
        .btn-submit:hover:not(:disabled) {
          background: #1a2f50;
          border-color: #1a2f50;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(15,28,53,0.28);
        }
        .btn-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-submit:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* secondary/outline button style (unused here but referenced) */
        .btn-outline {
          width: 100%;
          background: transparent;
          border: 1.5px solid #e2e6f0;
          border-radius: 10px;
          padding: 13px 20px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: border-color 0.2s, background 0.2s;
        }
        .btn-outline:hover {
          background: #f8f9fc;
          border-color: #b49146;
          color: #0f1c35;
        }

        /* spinner */
        .spin {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: doSpin 0.7s linear infinite;
        }

        /* footer */
        .form-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #f0f2f6;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .footer-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          font-weight: 500;
          color: #9ca3af;
          letter-spacing: 0.07em;
        }
        .footer-item svg { flex-shrink: 0; }

        /* divider */
        .or-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 14px 0;
          font-size: 11px;
          color: #c0c7d4;
          font-weight: 400;
        }
        .or-divider::before,
        .or-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e8ecf4;
        }

        /* animations */
        @keyframes aUp {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aLeft {
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes doSpin {
          to { transform: rotate(360deg); }
        }

        /* responsive */
        @media (max-width: 960px) {
          .lp { display: none; }
          .rp { width: 100%; box-shadow: none; }
        }
      `}</style>

      <div className="lr">

        {/* ── LEFT PANEL ── */}
        <div className="lp">
          <div className="dot-grid" />
          <div className="lp-accent" />
          <div className="lp-accent2" />

          {/* Brand */}
          <div className="brand">
            <div className="brand-shield">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L17 5.5V11C17 14.5 13.8 17.4 10 18.5C6.2 17.4 3 14.5 3 11V5.5L10 2Z"
                  stroke="#b49146" strokeWidth="1.4" fill="rgba(180,145,70,0.08)"/>
                <path d="M7 10L9 12L13 8" stroke="#b49146" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="brand-text-name">VeritasAML</div>
              <div className="brand-text-tag">Compliance Intelligence Platform</div>
            </div>
          </div>

          {/* Hero */}
          <div className="hero">
            <div className="hero-pill">
              <span className="hero-pill-dot" />
              <span className="hero-pill-text">Financial Risk Management</span>
            </div>
            <h1 className="hero-h1">
              Intelligent <em>KYC & AML</em><br />
              Compliance,<br />Automated.
            </h1>
            <p className="hero-p">
              Enterprise-grade document verification, anti-money laundering
              screening, and risk scoring — purpose-built for regulated
              financial institutions.
            </p>
            <div className="tags">
              {["AML / CFT", "FATF Aligned", "ISO 27001", "SOC 2 Type II"].map((t) => (
                <span className="tag" key={t}>
                  <span className="tag-check">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3 5.5L6.5 2.5" stroke="#b49146" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="stats">
            <div className="stat">
              <div className="stat-val">99.4%</div>
              <div className="stat-label">Detection Rate</div>
            </div>
            <div className="stat">
              <div className="stat-val">&lt;2 min</div>
              <div className="stat-label">Avg. Review</div>
            </div>
            <div className="stat">
              <div className="stat-val">140+</div>
              <div className="stat-label">Jurisdictions</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="rp">
          <div className="form-wrap">

            {/* Live system badge */}
            <div className="secure-badge">
              <span className="secure-badge-dot" />
              <span className="secure-badge-text">Systems Operational · Secure Connection</span>
            </div>

            <div className="form-eyebrow">Secure Access</div>
            <h2 className="form-title">Analyst Sign-In</h2>
            <p className="form-sub">
              Authenticate using your organisation-issued Cognito JWT access
              token to access the compliance dashboard.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label">
                  JWT Access Token
                  <span className="field-label-required">*</span>
                </label>
                <textarea
                  className="field-textarea"
                  placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="demo-hint">
                <span className="demo-hint-icon">💡</span>
                <span className="demo-hint-text">
                  No backend configured? Enter <code>dev</code> to launch in
                  demo mode with sample compliance data.
                </span>
              </div>

              {error && (
                <div className="err-box">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" stroke="#dc2626" strokeWidth="1.2"/>
                    <path d="M7.5 4.5V8" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="7.5" cy="10.5" r="0.8" fill="#dc2626"/>
                  </svg>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="spin" />
                    Verifying Identity…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <rect x="1.5" y="6.5" width="12" height="7.5" rx="2" stroke="white" strokeWidth="1.3"/>
                      <path d="M4.5 6.5V4.5A3 3 0 0 1 10.5 4.5V6.5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Authenticate & Continue
                  </>
                )}
              </button>

              <div className="or-divider">or</div>

              <button
                type="button"
                className="btn-outline"
                onClick={() => { setToken("dev"); }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="#b49146" strokeWidth="1.2"/>
                  <path d="M4 5L6 7L4 9" stroke="#b49146" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 9H10" stroke="#b49146" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Enter Demo Mode
              </button>
            </form>

            <div className="form-footer">
              <span className="footer-item">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1L10.5 3.2V6.5C10.5 8.8 8.5 10.8 6 11.5C3.5 10.8 1.5 8.8 1.5 6.5V3.2L6 1Z"
                    stroke="#9ca3af" strokeWidth="1" fill="none"/>
                </svg>
                256-bit TLS
              </span>
              <span className="footer-item">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="#9ca3af" strokeWidth="1"/>
                  <path d="M6 3V6.5L8 8" stroke="#9ca3af" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                Session · 8 hrs
              </span>
              <span className="footer-item">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="1" width="10" height="10" rx="2" stroke="#9ca3af" strokeWidth="1"/>
                  <path d="M4 6H8M6 4V8" stroke="#9ca3af" strokeWidth="1" strokeLinecap="round"/>
                </svg>
                GDPR Compliant
              </span>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
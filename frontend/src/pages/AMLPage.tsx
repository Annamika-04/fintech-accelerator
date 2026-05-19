import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldAlert, ShieldCheck, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { screenAML, getAMLResults } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PageHeader, EmptyState, ErrorState, Spinner } from "../components/ui";

interface AMLResult {
  id: string;
  normalized_name: string;
  is_pep: boolean;
  is_sanctioned: boolean;
  adverse_media_flag: boolean;
  risk_flags: { flag: string; severity: string }[] | null;
  screened_at: string;
  screening_provider: string;
}

const CHECKS = [
  { key: "is_sanctioned",      label: "OFAC Sanctions",  desc: "Office of Foreign Assets Control" },
  { key: "is_sanctioned",      label: "UN Sanctions",    desc: "United Nations Security Council" },
  { key: "is_sanctioned",      label: "EU Sanctions",    desc: "European Union Consolidated List" },
  { key: "is_pep",             label: "PEP Database",    desc: "Politically Exposed Persons" },
  { key: "adverse_media_flag", label: "Adverse Media",   desc: "Negative news & media screening" },
] as const;

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "10px 12px", color: "#f1f5f9",
  fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%",
};

function CheckRow({ label, desc, hit }: { label: string; desc: string; hit: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {hit ? (
          <>
            <ShieldAlert size={14} color="#ef4444" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "3px 10px" }}>MATCH</span>
          </>
        ) : (
          <>
            <ShieldCheck size={14} color="#22c55e" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "3px 10px" }}>CLEAR</span>
          </>
        )}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: AMLResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasHit = result.is_sanctioned || result.is_pep || result.adverse_media_flag;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hasHit ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)"}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: hasHit ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.08)", border: `1px solid ${hasHit ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {hasHit ? <ShieldAlert size={16} color="#ef4444" /> : <ShieldCheck size={16} color="#22c55e" />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", textTransform: "capitalize" }}>{result.normalized_name}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>via {result.screening_provider} · {result.screened_at?.slice(0, 10)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: hasHit ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.08)", color: hasHit ? "#ef4444" : "#22c55e", border: `1px solid ${hasHit ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)"}` }}>
            {hasHit ? "⚠ ALERT" : "✓ CLEAR"}
          </span>
          {expanded ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 20px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ paddingTop: 4 }}>
                {CHECKS.map((c, i) => <CheckRow key={i} label={c.label} desc={c.desc} hit={result[c.key]} />)}
              </div>
              {result.risk_flags && result.risk_flags.length > 0 && (
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {result.risk_flags.map((f, i) => (
                    <span key={i} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: f.severity === "critical" ? "rgba(239,68,68,0.1)" : "rgba(251,146,60,0.1)", color: f.severity === "critical" ? "#ef4444" : "#fb923c", border: `1px solid ${f.severity === "critical" ? "rgba(239,68,68,0.2)" : "rgba(251,146,60,0.2)"}`, letterSpacing: "0.06em" }}>
                      {f.flag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AMLPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", date_of_birth: "", profile_type: "individual" });
  const [lookupId, setLookupId] = useState("");
  const [results, setResults] = useState<AMLResult[]>([]);
  const [queued, setQueued] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [screenError, setScreenError] = useState("");

  const canScreen = user && ["aml_analyst", "compliance_manager", "admin"].includes(user.role);

  const handleScreen = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setQueued(false); setScreenError("");
    try {
      await screenAML(form);
      setQueued(true);
      setForm({ full_name: "", date_of_birth: "", profile_type: "individual" });
    } catch {
      setScreenError("Screening failed — check your role permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async (e: FormEvent) => {
    e.preventDefault();
    setFetching(true); setFetchError(""); setResults([]);
    try {
      const { data } = await getAMLResults(lookupId);
      setResults(data);
    } catch {
      setFetchError("Failed to fetch results for this user.");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHeader
        eyebrow="Compliance"
        title="AML Screening"
        subtitle="Screen individuals and entities against global sanctions, PEP, and adverse media databases."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        {/* Trigger screening */}
        {canScreen && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>New Screening</div>
            {screenError && <ErrorState message={screenError} />}
            <form onSubmit={handleScreen} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Full legal name" required style={inputStyle} />
              <input value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} placeholder="Date of birth (YYYY-MM-DD)" style={inputStyle} />
              <select value={form.profile_type} onChange={(e) => setForm({ ...form, profile_type: e.target.value })} style={inputStyle}>
                <option value="individual">Individual</option>
                <option value="corporate">Corporate</option>
              </select>
              {queued && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "8px 12px" }}>
                  <Clock size={13} /> Screening queued — results available shortly
                </div>
              )}
              <button type="submit" disabled={loading} style={{ padding: "11px", background: "#6366f1", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
                {loading ? <Spinner size={14} color="#fff" /> : <Search size={14} />}
                {loading ? "Queuing…" : "Run Screening"}
              </button>
            </form>
          </motion.div>
        )}

        {/* Fetch results */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0ea5e9", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Lookup Results</div>
          {fetchError && <ErrorState message={fetchError} onRetry={() => setFetchError("")} />}
          <form onSubmit={handleFetch} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="User UUID" required style={inputStyle} />
            <button type="submit" disabled={fetching} style={{ padding: "11px", background: "rgba(14,165,233,0.15)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 8, color: "#38bdf8", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {fetching ? <Spinner size={14} color="#38bdf8" /> : <Search size={14} />}
              {fetching ? "Loading…" : "Fetch Results"}
            </button>
          </form>
          {results.length > 0 && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12, color: "#64748b" }}>
              {results.length} screening record{results.length > 1 ? "s" : ""} found
            </div>
          )}
        </motion.div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
            Screening Results
          </div>
          {results.map((r) => <ResultCard key={r.id} result={r} />)}
        </motion.div>
      )}

      {results.length === 0 && !fetching && lookupId && !fetchError && (
        <EmptyState icon={ShieldCheck} title="No screening results found" subtitle="No records match this user ID." />
      )}
    </div>
  );
}

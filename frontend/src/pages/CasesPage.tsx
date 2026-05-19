import { useEffect, useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, Plus, CheckCircle2, XCircle, AlertTriangle, Clock, Filter, RefreshCw } from "lucide-react";
import { createCase, listCases, resolveCase, makeDecision } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PageHeader, StatCard, SkeletonTable, EmptyState, ErrorState, IconButton } from "../components/ui";

interface Case {
  id: string;
  user_id: string;
  case_type: string | null;
  status: string;
  priority: string;
  notes: string | null;
}

const PRIORITY_META: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.2)" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)" },
  low:      { color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)" },
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  open:      { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  resolved:  { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  escalated: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  closed:    { color: "#64748b", bg: "rgba(100,116,139,0.1)" },
};

const CASE_TYPES = ["kyc_review", "aml_alert", "fraud_investigation", "document_issue", "pep_match", "sanctions_hit", "other"];
const PRIORITIES = ["low", "medium", "high", "critical"];

const inp: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8, padding: "9px 12px", color: "#f1f5f9",
  fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box",
};

export default function CasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ user_id: "", case_type: CASE_TYPES[0], priority: "medium", notes: "" });
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canManage = user && ["kyc_officer", "compliance_manager", "admin"].includes(user.role);

  const fetchCases = async () => {
    setLoading(true); setError("");
    try { const { data } = await listCases(); setCases(data); }
    catch { setError("Failed to load cases."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCases(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault(); setFormError("");
    try {
      await createCase(form);
      setForm({ user_id: "", case_type: CASE_TYPES[0], priority: "medium", notes: "" });
      setShowForm(false);
      fetchCases();
    } catch { setFormError("Failed to create case — check your role permissions."); }
  };

  const handleResolve = async (id: string) => {
    setActionLoading(id);
    try { await resolveCase(id); fetchCases(); }
    finally { setActionLoading(null); }
  };

  const handleDecision = async (userId: string, decision: string) => {
    setActionLoading(userId);
    try { await makeDecision(userId, decision); fetchCases(); }
    catch { /* silent */ }
    finally { setActionLoading(null); }
  };

  const filtered = filter === "all" ? cases : cases.filter((c) => c.status === filter);
  const stats = {
    open:     cases.filter((c) => c.status === "open").length,
    critical: cases.filter((c) => c.priority === "critical").length,
    resolved: cases.filter((c) => c.status === "resolved").length,
    total:    cases.length,
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHeader
        eyebrow="Compliance"
        title="Case Management"
        subtitle="Review, investigate, and resolve compliance cases."
        actions={
          <>
            <IconButton icon={RefreshCw} onClick={fetchCases} label="Refresh" />
            {canManage && <IconButton icon={Plus} onClick={() => setShowForm(!showForm)} label="New Case" variant="primary" />}
          </>
        }
      />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Open Cases"  value={stats.open}     color="#f59e0b" icon={Clock} />
        <StatCard label="Critical"    value={stats.critical} color="#ef4444" icon={AlertTriangle} />
        <StatCard label="Resolved"    value={stats.resolved} color="#22c55e" icon={CheckCircle2} />
        <StatCard label="Total Cases" value={stats.total}    color="#6366f1" icon={FolderOpen} />
      </div>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchCases} />}

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Create New Case</div>
              <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>User ID</label>
                  <input style={inp} value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="UUID of the user" required />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Case Type</label>
                  <select style={inp} value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>
                    {CASE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Priority</label>
                  <select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 10, color: "#64748b", display: "block", marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>Notes</label>
                  <textarea style={{ ...inp, height: 72, resize: "none" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Investigation notes…" />
                </div>
                {formError && <div style={{ gridColumn: "1 / -1" }}><ErrorState message={formError} /></div>}
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button type="submit" style={{ padding: "10px 20px", background: "#6366f1", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create Case</button>
                  <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#64748b", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {["all", "open", "resolved", "escalated"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: filter === f ? "rgba(99,102,241,0.2)" : "transparent", color: filter === f ? "#818cf8" : "#475569", transition: "all 0.15s", textTransform: "capitalize" }}>
            {f}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", color: "#334155", fontSize: 12 }}>
          <Filter size={11} /> {filtered.length}
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 20 }}><SkeletonTable rows={5} cols={6} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No cases found" subtitle={filter !== "all" ? `No ${filter} cases.` : "Create your first case above."} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.25)" }}>
                {["Case Type", "User ID", "Status", "Priority", "Notes", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const pm = PRIORITY_META[c.priority] ?? PRIORITY_META.low;
                const sm = STATUS_META[c.status] ?? STATUS_META.open;
                const isActing = actionLoading === c.id || actionLoading === c.user_id;
                return (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "13px 16px", color: "#e2e8f0", textTransform: "capitalize" }}>{c.case_type?.replace(/_/g, " ") ?? "—"}</td>
                    <td style={{ padding: "13px 16px", color: "#475569", fontFamily: "monospace", fontSize: 11 }}>{c.user_id.slice(0, 8)}…</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: sm.bg, color: sm.color, textTransform: "capitalize" }}>{c.status}</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: pm.bg, color: pm.color, border: `1px solid ${pm.border}`, textTransform: "capitalize" }}>{c.priority}</span>
                    </td>
                    <td style={{ padding: "13px 16px", color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.notes ?? "—"}</td>
                    <td style={{ padding: "13px 16px" }}>
                      {c.status !== "resolved" && canManage ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleDecision(c.user_id, "APPROVED")} disabled={!!isActing}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, color: "#22c55e", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            <CheckCircle2 size={11} /> Approve
                          </button>
                          <button onClick={() => handleDecision(c.user_id, "REJECTED")} disabled={!!isActing}
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            <XCircle size={11} /> Reject
                          </button>
                          <button onClick={() => handleResolve(c.id)} disabled={!!isActing}
                            style={{ padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#64748b", fontSize: 11, cursor: "pointer" }}>
                            Resolve
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#334155" }}>Closed</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}

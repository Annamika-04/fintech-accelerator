import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, ShieldCheck, ShieldAlert, UserCheck, RefreshCw } from "lucide-react";
import { listUsers } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { PageHeader, StatCard, SkeletonTable, EmptyState, ErrorState, IconButton } from "../components/ui";

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
}

const ROLE_META: Record<string, { color: string; bg: string }> = {
  admin:              { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  compliance_manager: { color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  kyc_officer:        { color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  aml_analyst:        { color: "#0ea5e9", bg: "rgba(14,165,233,0.1)" },
  auditor:            { color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
  customer:           { color: "#64748b", bg: "rgba(100,116,139,0.1)" },
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    setLoading(true); setError("");
    try { const { data } = await listUsers(); setUsers(data); }
    catch { setError("Access denied or failed to load users."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:  users.length,
    active: users.filter((u) => u.is_active).length,
    mfa:    users.filter((u) => u.mfa_enabled).length,
    staff:  users.filter((u) => u.role !== "customer").length,
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        subtitle="Manage platform users, roles, and access permissions."
        actions={<IconButton icon={RefreshCw} onClick={fetchUsers} label="Refresh" />}
      />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Users"   value={stats.total}  color="#6366f1" icon={Users} />
        <StatCard label="Active"        value={stats.active} color="#22c55e" icon={UserCheck} />
        <StatCard label="MFA Enabled"   value={stats.mfa}    color="#0ea5e9" icon={ShieldCheck} />
        <StatCard label="Staff Members" value={stats.staff}  color="#f59e0b" icon={ShieldAlert} />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email or role…"
          style={{ width: "100%", maxWidth: 360, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 14px", color: "#f1f5f9", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>

      {error && <ErrorState message={error} onRetry={fetchUsers} />}

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 20 }}><SkeletonTable rows={6} cols={5} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No users found" subtitle={search ? `No results for "${search}"` : "No users in the system yet."} />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.25)" }}>
                {["Email", "Role", "Active", "MFA", "ID"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const rm = ROLE_META[u.role] ?? ROLE_META.customer;
                const isMe = u.id === me?.id;
                return (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: isMe ? "rgba(99,102,241,0.04)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: rm.bg, border: `1px solid ${rm.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: rm.color, flexShrink: 0 }}>
                          {u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: "#e2e8f0", fontWeight: 500 }}>{u.email}</div>
                          {isMe && <div style={{ fontSize: 10, color: "#6366f1", marginTop: 1 }}>You</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: rm.bg, color: rm.color, textTransform: "capitalize" }}>
                        {u.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: u.is_active ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: u.is_active ? "#22c55e" : "#ef4444" }}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: u.mfa_enabled ? "rgba(14,165,233,0.1)" : "rgba(100,116,139,0.1)", color: u.mfa_enabled ? "#38bdf8" : "#64748b" }}>
                        {u.mfa_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, color: "#334155", fontFamily: "monospace" }}>{u.id.slice(0, 8)}…</span>
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

import { motion } from "framer-motion";
import { LucideIcon, AlertTriangle, Inbox } from "lucide-react";

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
export function Skeleton({ width = "100%", height = 16, radius = 6, style }: {
  width?: string | number; height?: number; radius?: number; style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24 }}>
      <Skeleton width="40%" height={14} style={{ marginBottom: 20 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={12} style={{ marginBottom: 12, width: i % 2 === 0 ? "100%" : "75%" }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height={10} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 12 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={c === 0 ? "30%" : `${70 / (cols - 1)}%`} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */
export function Spinner({ size = 20, color = "#6366f1" }: { size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${color}30`,
      borderTopColor: color,
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
      flexShrink: 0,
    }} />
  );
}

/* ── PageHeader ───────────────────────────────────────────────────────────── */
export function PageHeader({
  eyebrow, title, subtitle, actions,
}: {
  eyebrow: string; title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}
    >
      <div>
        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(180,145,70,0.6)", marginBottom: 6 }}>
          {eyebrow}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#f0e6cc", margin: 0, letterSpacing: "-0.01em" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: "rgba(200,210,230,0.45)", marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
    </motion.div>
  );
}

/* ── StatCard ─────────────────────────────────────────────────────────────── */
export function StatCard({
  label, value, color, icon: Icon, delta,
}: {
  label: string; value: number | string; color: string; icon: LucideIcon; delta?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: "18px 20px",
        display: "flex", alignItems: "center", gap: 14,
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}15`, border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{label}</div>
      </div>
      {delta && (
        <div style={{ fontSize: 11, color: delta.startsWith("+") ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
          {delta}
        </div>
      )}
    </motion.div>
  );
}

/* ── EmptyState ───────────────────────────────────────────────────────────── */
export function EmptyState({
  icon: Icon = Inbox, title, subtitle, action,
}: {
  icon?: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ textAlign: "center", padding: "56px 24px" }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <Icon size={24} color="#334155" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#475569", marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#334155", marginBottom: 16 }}>{subtitle}</div>}
      {action}
    </motion.div>
  );
}

/* ── ErrorState ───────────────────────────────────────────────────────────── */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 18px",
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.15)",
        borderRadius: 12, marginBottom: 16,
      }}
    >
      <AlertTriangle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "#fca5a5", flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            fontSize: 12, color: "#ef4444", background: "none",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6,
            padding: "4px 10px", cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </motion.div>
  );
}

/* ── Badge ────────────────────────────────────────────────────────────────── */
export function Badge({
  label, color, bg, border,
}: {
  label: string; color: string; bg: string; border?: string;
}) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      padding: "3px 9px", borderRadius: 6,
      background: bg, color,
      border: border ? `1px solid ${border}` : undefined,
      textTransform: "capitalize",
      letterSpacing: "0.02em",
    }}>
      {label}
    </span>
  );
}

/* ── IconButton ───────────────────────────────────────────────────────────── */
export function IconButton({
  icon: Icon, onClick, label, variant = "ghost",
}: {
  icon: LucideIcon; onClick: () => void; label: string; variant?: "ghost" | "primary" | "danger";
}) {
  const styles = {
    ghost:   { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", color: "#64748b" },
    primary: { bg: "rgba(99,102,241,0.15)",  border: "rgba(99,102,241,0.25)",  color: "#818cf8" },
    danger:  { bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.2)",    color: "#ef4444" },
  }[variant];

  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 12px",
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: 8, color: styles.color,
        fontSize: 12, fontWeight: 500, cursor: "pointer",
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/documents", label: "Documents", icon: "📄" },
  { to: "/face-verification", label: "Face Verification", icon: "🪪" },
  { to: "/aml", label: "AML Screening", icon: "🔍" },
  { to: "/risk", label: "Risk Scoring", icon: "📊" },
  { to: "/cases", label: "Cases", icon: "📁" },
];

const adminLinks = [{ to: "/users", label: "Users", icon: "👥" }];

export default function Layout() {
  const { user, logout } = useAuth();
  const isPrivileged =
    user &&
    ["admin", "compliance_manager", "kyc_officer", "aml_analyst", "auditor"].includes(user.role);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0b0f1a", fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        background: "#0d1117",
        borderRight: "1px solid rgba(180,145,70,0.15)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid rgba(180,145,70,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              border: "1.5px solid rgba(180,145,70,0.5)",
              borderRadius: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(180,145,70,0.08)",
              fontSize: 14,
            }}>⬡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#e8d9b0", letterSpacing: "0.03em" }}>
                VeritasAML
              </div>
              <div style={{ fontSize: 9, color: "rgba(180,145,70,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Compliance
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 9, color: "rgba(180,145,70,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", padding: "8px 10px 6px" }}>
            Navigation
          </div>
          {links.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              color: isActive ? "#f0e6cc" : "rgba(200,210,230,0.6)",
              background: isActive ? "rgba(180,145,70,0.15)" : "transparent",
              borderLeft: isActive ? "2px solid #b49146" : "2px solid transparent",
              transition: "all 0.15s",
            })}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
            </NavLink>
          ))}

          {isPrivileged && (
            <>
              <div style={{ fontSize: 9, color: "rgba(180,145,70,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", padding: "14px 10px 6px" }}>
                Admin
              </div>
              {adminLinks.map(({ to, label, icon }) => (
                <NavLink key={to} to={to} style={({ isActive }) => ({
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: isActive ? "#f0e6cc" : "rgba(200,210,230,0.6)",
                  background: isActive ? "rgba(180,145,70,0.15)" : "transparent",
                  borderLeft: isActive ? "2px solid #b49146" : "2px solid transparent",
                  transition: "all 0.15s",
                })}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div style={{
          padding: "14px 16px",
          borderTop: "1px solid rgba(180,145,70,0.1)",
          background: "rgba(0,0,0,0.2)",
        }}>
          <div style={{ fontSize: 12, color: "#d4c9a8", fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email}
          </div>
          <div style={{ fontSize: 10, color: "#b49146", textTransform: "capitalize", letterSpacing: "0.08em", marginBottom: 10 }}>
            {user?.role?.replace(/_/g, " ")}
          </div>
          <button onClick={logout} style={{
            fontSize: 11, color: "rgba(220,100,100,0.8)", background: "none",
            border: "1px solid rgba(220,100,100,0.2)", borderRadius: 5,
            padding: "4px 10px", cursor: "pointer", letterSpacing: "0.06em",
          }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: "auto", background: "#0b0f1a", padding: "36px 40px" }}>
        <Outlet />
      </main>
    </div>
  );
}

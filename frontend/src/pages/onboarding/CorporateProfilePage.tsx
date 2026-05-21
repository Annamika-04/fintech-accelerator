import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Trash2, ArrowRight, ArrowLeft, UserCheck } from "lucide-react";
import {
  saveCorporateProfile, addDirector, listDirectors, removeDirector, getCorporateProfile,
} from "../../api/client";
import { useOnboardingStore } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import toast from "react-hot-toast";
import {
  ALL_STATES,
  COUNTRIES,
  INDUSTRIES,
  NATIONALITIES,
  getCitySuggestions,
} from "./locationOptions";

interface Props { onBack: () => void; onNext: () => void; }

interface Director {
  id: string;
  full_name: string;
  role: string;
  ownership_pct: number;
  is_ubo: boolean;
  nationality: string;
}

const Field = ({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
    />
  </div>
);

const AutocompleteField = ({ label, value, onChange, suggestions, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  suggestions: string[]; placeholder?: string;
}) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.length > 0
    ? suggestions.filter((item) => item.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 8);

  const select = (nextValue: string) => {
    setQuery(nextValue);
    onChange(nextValue);
    setOpen(false);
    setHighlighted(0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} ref={wrapRef}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            onChange(nextValue);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
        />
        {open && filtered.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", maxHeight: 260, overflowY: "auto" }}>
            {filtered.map((item, index) => (
              <div
                key={item}
                onMouseDown={() => select(item)}
                onMouseEnter={() => setHighlighted(index)}
                style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: index === highlighted ? "#f1f5f9" : "#94a3b8", background: index === highlighted ? "rgba(14,165,233,0.2)" : "transparent" }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default function CorporateProfilePage({ onBack, onNext }: Props) {
  const { setServerStatus, setProfileId } = useOnboardingStore();
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [showDirectorForm, setShowDirectorForm] = useState(false);
  const [newDirector, setNewDirector] = useState({ full_name: "", role: "", ownership_pct: "0", is_ubo: false, nationality: "" });

  const [form, setForm] = useState({
    company_name: "", registration_number: "", gstin_ein: "",
    country_of_incorporation: "", industry: "",
    address_line1: "", address_city: "", address_state: "",
    address_postal_code: "", address_country: "",
  });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const addressStateSuggestions = form.address_country === "India" ? ALL_STATES : [];
  const addressCitySuggestions = getCitySuggestions(form.address_country, form.address_state);

  useEffect(() => {
    Promise.allSettled([getCorporateProfile(), listDirectors()]).then((results) => {
      const profileResult = results[0];
      const directorsResult = results[1];

      if (profileResult.status === "fulfilled") {
        const data = profileResult.value.data;
        setProfileId(data.id);
        setForm({
          company_name: data.company_name || "",
          registration_number: data.registration_number || "",
          gstin_ein: data.gstin_ein || "",
          country_of_incorporation: data.country_of_incorporation || "",
          industry: data.industry || "",
          address_line1: data.registered_address?.line1 || "",
          address_city: data.registered_address?.city || "",
          address_state: data.registered_address?.state || "",
          address_postal_code: data.registered_address?.postal_code || "",
          address_country: data.registered_address?.country || "",
        });
      }

      if (directorsResult.status === "fulfilled") {
        setDirectors(directorsResult.value.data);
      }

      setBootLoading(false);
    });
  }, [setProfileId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name) return toast.error("Company name is required");
    setLoading(true);
    try {
      const res = await saveCorporateProfile({
        company_name: form.company_name,
        registration_number: form.registration_number || null,
        gstin_ein: form.gstin_ein || null,
        country_of_incorporation: form.country_of_incorporation || null,
        industry: form.industry || null,
        registered_address: form.address_line1 ? {
          line1: form.address_line1,
          city: form.address_city,
          state: form.address_state,
          postal_code: form.address_postal_code,
          country: form.address_country,
        } : null,
      });
      setProfileId(res.data.id);
      setServerStatus(res.data.onboarding_status);
      onNext();
    } catch {
      toast.error("Failed to save company profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDirector = async () => {
    if (!newDirector.full_name) return toast.error("Director name required");
    try {
      const res = await addDirector({
        full_name: newDirector.full_name,
        role: newDirector.role || null,
        ownership_pct: parseFloat(newDirector.ownership_pct) || 0,
        is_ubo: newDirector.is_ubo,
        nationality: newDirector.nationality || null,
      });
      setDirectors((current) => [...current, res.data]);
      setNewDirector({ full_name: "", role: "", ownership_pct: "0", is_ubo: false, nationality: "" });
      setShowDirectorForm(false);
      toast.success("Director added");
    } catch {
      toast.error("Failed to add director.");
    }
  };

  const handleRemoveDirector = async (id: string) => {
    try {
      await removeDirector(id);
      setDirectors((current) => current.filter((director) => director.id !== id));
    } catch {
      toast.error("Failed to remove director.");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>
      {bootLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
          <Spinner size={28} color="#0ea5e9" />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={20} color="#38bdf8" />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>Company Information</h2>
              <p style={{ fontSize: 13, color: "#475569" }}>Provide your company's legal details and beneficial owners.</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#0ea5e9", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18 }}>Company Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Legal Company Name" value={form.company_name} onChange={set("company_name")} placeholder="Acme Financial Services Pvt. Ltd." />
                </div>
                <Field label="Registration Number" value={form.registration_number} onChange={set("registration_number")} placeholder="CIN / Company No." />
                <Field label="GSTIN / EIN" value={form.gstin_ein} onChange={set("gstin_ein")} placeholder="Tax identification number" />
                <AutocompleteField label="Country of Incorporation" value={form.country_of_incorporation} onChange={set("country_of_incorporation")} suggestions={COUNTRIES} placeholder="Type to search country..." />
                <AutocompleteField label="Industry" value={form.industry} onChange={set("industry")} suggestions={INDUSTRIES} placeholder="Type to search industry..." />
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#0ea5e9", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18 }}>Registered Address</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Address Line 1" value={form.address_line1} onChange={set("address_line1")} placeholder="Street address" />
                </div>
                <AutocompleteField label="City" value={form.address_city} onChange={set("address_city")} suggestions={addressCitySuggestions} placeholder="Type to search city..." />
                <AutocompleteField label="State" value={form.address_state} onChange={(value) => { set("address_state")(value); set("address_city")(""); }} suggestions={addressStateSuggestions.length > 0 ? addressStateSuggestions : ALL_STATES} placeholder="Type to search state..." />
                <Field label="Postal Code" value={form.address_postal_code} onChange={set("address_postal_code")} placeholder="400001" />
                <AutocompleteField label="Country" value={form.address_country} onChange={(value) => { set("address_country")(value); if (value !== "India") { set("address_state")(""); set("address_city")(""); } }} suggestions={COUNTRIES} placeholder="Type to search country..." />
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#0ea5e9", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Directors & UBOs
                </div>
                <button type="button" onClick={() => setShowDirectorForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 8, padding: "6px 12px", color: "#38bdf8", fontSize: 12, cursor: "pointer" }}>
                  <Plus size={13} /> Add Director
                </button>
              </div>

              {directors.length === 0 && !showDirectorForm && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#334155", fontSize: 13 }}>
                  <UserCheck size={28} color="#1e293b" style={{ marginBottom: 8 }} />
                  <div>No directors added yet</div>
                </div>
              )}

              {directors.map((director) => (
                <div key={director.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#e2e8f0" }}>{director.full_name}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      {director.role || "Director"} · {director.ownership_pct}% ownership
                      {director.is_ubo && <span style={{ marginLeft: 8, background: "rgba(14,165,233,0.15)", color: "#38bdf8", borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>UBO</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => handleRemoveDirector(director.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {showDirectorForm && (
                <div style={{ background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.15)", borderRadius: 12, padding: 16, marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <Field label="Full Name" value={newDirector.full_name} onChange={(v) => setNewDirector((current) => ({ ...current, full_name: v }))} placeholder="Director's legal name" />
                    <Field label="Role" value={newDirector.role} onChange={(v) => setNewDirector((current) => ({ ...current, role: v }))} placeholder="CEO / Director / UBO" />
                    <Field label="Ownership %" value={newDirector.ownership_pct} onChange={(v) => setNewDirector((current) => ({ ...current, ownership_pct: v }))} placeholder="25" type="number" />
                    <AutocompleteField label="Nationality" value={newDirector.nationality} onChange={(v) => setNewDirector((current) => ({ ...current, nationality: v }))} suggestions={NATIONALITIES} placeholder="Type to search nationality..." />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <input type="checkbox" id="is_ubo" checked={newDirector.is_ubo} onChange={(e) => setNewDirector((current) => ({ ...current, is_ubo: e.target.checked }))} />
                    <label htmlFor="is_ubo" style={{ fontSize: 13, color: "#94a3b8" }}>Mark as Ultimate Beneficial Owner (UBO)</label>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={handleAddDirector} style={{ flex: 1, padding: "10px", background: "#0ea5e9", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Add Director
                    </button>
                    <button type="button" onClick={() => setShowDirectorForm(false)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#64748b", fontSize: 13, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={onBack} style={{ flex: "0 0 auto", padding: "13px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={15} /> Back
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: "13px 20px", background: "#0ea5e9", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
                {loading ? <><Spinner size={14} color="#fff" /> Saving...</> : <> Save & Continue <ArrowRight size={15} /></>}
              </button>
            </div>
          </form>
        </>
      )}
    </motion.div>
  );
}

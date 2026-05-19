import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, ArrowRight, ArrowLeft } from "lucide-react";
import { saveIndividualProfile } from "../../api/client";
import { useOnboardingStore } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import toast from "react-hot-toast";
import axios from "axios";

interface Props { onBack: () => void; onNext: () => void; }

// ── Data ──────────────────────────────────────────────────────────────────────

const NATIONALITIES = [
  "Afghan","Albanian","Algerian","American","Andorran","Angolan","Argentine","Armenian",
  "Australian","Austrian","Azerbaijani","Bahraini","Bangladeshi","Belarusian","Belgian",
  "Bolivian","Bosnian","Brazilian","British","Bulgarian","Cambodian","Cameroonian","Canadian",
  "Chilean","Chinese","Colombian","Congolese","Croatian","Cuban","Czech","Danish","Dutch",
  "Ecuadorian","Egyptian","Emirati","Estonian","Ethiopian","Filipino","Finnish","French",
  "Georgian","German","Ghanaian","Greek","Guatemalan","Honduran","Hungarian","Indian",
  "Indonesian","Iranian","Iraqi","Irish","Israeli","Italian","Jamaican","Japanese","Jordanian",
  "Kazakhstani","Kenyan","Korean","Kuwaiti","Kyrgyz","Lao","Latvian","Lebanese","Libyan",
  "Lithuanian","Luxembourgish","Malaysian","Maldivian","Malian","Maltese","Mexican","Moldovan",
  "Mongolian","Moroccan","Mozambican","Namibian","Nepalese","New Zealander","Nicaraguan",
  "Nigerian","Norwegian","Omani","Pakistani","Palestinian","Panamanian","Paraguayan","Peruvian",
  "Polish","Portuguese","Qatari","Romanian","Russian","Rwandan","Saudi","Senegalese","Serbian",
  "Singaporean","Slovak","Slovenian","Somali","South African","Spanish","Sri Lankan","Sudanese",
  "Swedish","Swiss","Syrian","Taiwanese","Tajik","Tanzanian","Thai","Tunisian","Turkish",
  "Turkmen","Ugandan","Ukrainian","Uruguayan","Uzbek","Venezuelan","Vietnamese","Yemeni",
  "Zambian","Zimbabwean",
];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia",
  "Bosnia and Herzegovina","Brazil","Bulgaria","Cambodia","Cameroon","Canada","Chile",
  "China","Colombia","Congo","Croatia","Cuba","Czech Republic","Denmark","Ecuador","Egypt",
  "Estonia","Ethiopia","Finland","France","Georgia","Germany","Ghana","Greece","Guatemala",
  "Honduras","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica",
  "Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon",
  "Libya","Lithuania","Luxembourg","Malaysia","Maldives","Mali","Malta","Mexico","Moldova",
  "Mongolia","Morocco","Mozambique","Namibia","Nepal","Netherlands","New Zealand","Nicaragua",
  "Nigeria","Norway","Oman","Pakistan","Palestine","Panama","Paraguay","Peru","Philippines",
  "Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia",
  "Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka",
  "Sudan","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Tunisia",
  "Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom",
  "United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
];

const INDIA_STATES: Record<string, string[]> = {
  "Andhra Pradesh":["Visakhapatnam","Vijayawada","Guntur","Nellore","Kurnool","Tirupati","Kakinada","Rajahmundry","Kadapa","Anantapur","Eluru","Ongole","Chittoor","Srikakulam","Vizianagaram"],
  "Arunachal Pradesh":["Itanagar","Naharlagun","Pasighat","Tawang","Ziro","Bomdila","Tezu"],
  "Assam":["Guwahati","Silchar","Dibrugarh","Jorhat","Nagaon","Tinsukia","Tezpur","Bongaigaon","Dhubri","Goalpara","Karimganj"],
  "Bihar":["Patna","Gaya","Bhagalpur","Muzaffarpur","Purnia","Darbhanga","Bihar Sharif","Arrah","Begusarai","Katihar","Munger","Chapra","Hajipur","Saharsa"],
  "Chhattisgarh":["Raipur","Bhilai","Bilaspur","Korba","Durg","Rajnandgaon","Jagdalpur","Ambikapur","Raigarh"],
  "Goa":["Panaji","Margao","Vasco da Gama","Mapusa","Ponda","Bicholim","Curchorem"],
  "Gujarat":["Ahmedabad","Surat","Vadodara","Rajkot","Bhavnagar","Jamnagar","Gandhinagar","Junagadh","Anand","Nadiad","Morbi","Surendranagar","Bharuch","Mehsana","Botad"],
  "Haryana":["Faridabad","Gurgaon","Panipat","Ambala","Yamunanagar","Rohtak","Hisar","Karnal","Sonipat","Panchkula","Bhiwani","Sirsa","Rewari","Jhajjar"],
  "Himachal Pradesh":["Shimla","Dharamshala","Solan","Mandi","Kullu","Hamirpur","Una","Bilaspur","Nahan","Palampur"],
  "Jharkhand":["Ranchi","Jamshedpur","Dhanbad","Bokaro","Deoghar","Hazaribagh","Giridih","Dumka","Phusro","Adityapur"],
  "Karnataka":["Bengaluru","Mysuru","Hubli","Mangaluru","Belagavi","Kalaburagi","Davanagere","Ballari","Vijayapura","Shivamogga","Tumkur","Bidar","Raichur","Hassan","Udupi"],
  "Kerala":["Thiruvananthapuram","Kochi","Kozhikode","Thrissur","Kollam","Palakkad","Alappuzha","Kannur","Kottayam","Malappuram","Kasaragod","Pathanamthitta","Idukki","Wayanad"],
  "Madhya Pradesh":["Bhopal","Indore","Jabalpur","Gwalior","Ujjain","Sagar","Dewas","Satna","Ratlam","Rewa","Murwara","Singrauli","Burhanpur","Khandwa","Bhind"],
  "Maharashtra":["Mumbai","Pune","Nagpur","Nashik","Aurangabad","Solapur","Amravati","Kolhapur","Thane","Navi Mumbai","Pimpri-Chinchwad","Kalyan","Vasai-Virar","Malegaon","Jalgaon","Akola","Latur","Dhule","Ahmednagar","Chandrapur"],
  "Manipur":["Imphal","Thoubal","Bishnupur","Churachandpur","Senapati","Ukhrul","Tamenglong"],
  "Meghalaya":["Shillong","Tura","Jowai","Nongstoin","Baghmara"],
  "Mizoram":["Aizawl","Lunglei","Champhai","Serchhip","Kolasib"],
  "Nagaland":["Kohima","Dimapur","Mokokchung","Tuensang","Wokha","Zunheboto"],
  "Odisha":["Bhubaneswar","Cuttack","Rourkela","Brahmapur","Sambalpur","Puri","Balasore","Bhadrak","Baripada","Jharsuguda"],
  "Punjab":["Ludhiana","Amritsar","Jalandhar","Patiala","Bathinda","Mohali","Hoshiarpur","Gurdaspur","Pathankot","Moga","Firozpur","Sangrur"],
  "Rajasthan":["Jaipur","Jodhpur","Kota","Bikaner","Ajmer","Udaipur","Bhilwara","Alwar","Bharatpur","Sikar","Pali","Sri Ganganagar","Barmer","Tonk","Churu"],
  "Sikkim":["Gangtok","Namchi","Gyalshing","Mangan","Rangpo"],
  "Tamil Nadu":["Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","Tirunelveli","Tiruppur","Vellore","Erode","Thoothukudi","Dindigul","Thanjavur","Ranipet","Sivakasi","Karur","Hosur","Nagercoil","Kanchipuram","Kumbakonam","Cuddalore"],
  "Telangana":["Hyderabad","Warangal","Nizamabad","Karimnagar","Khammam","Ramagundam","Mahbubnagar","Nalgonda","Adilabad","Suryapet","Miryalaguda","Siddipet"],
  "Tripura":["Agartala","Dharmanagar","Udaipur","Kailasahar","Belonia","Ambassa"],
  "Uttar Pradesh":["Lucknow","Kanpur","Agra","Varanasi","Meerut","Allahabad","Ghaziabad","Noida","Bareilly","Aligarh","Moradabad","Saharanpur","Gorakhpur","Firozabad","Jhansi","Mathura","Muzaffarnagar","Rampur","Shahjahanpur","Farrukhabad"],
  "Uttarakhand":["Dehradun","Haridwar","Roorkee","Haldwani","Rudrapur","Kashipur","Rishikesh","Nainital","Mussoorie","Pithoragarh"],
  "West Bengal":["Kolkata","Howrah","Durgapur","Asansol","Siliguri","Bardhaman","Malda","Baharampur","Habra","Kharagpur","Shantipur","Dankuni","Dhulian","Ranaghat"],
  "Delhi":["New Delhi","Dwarka","Rohini","Janakpuri","Laxmi Nagar","Saket","Pitampura","Karol Bagh","Connaught Place","Vasant Kunj","Mayur Vihar","Preet Vihar","Shahdara","Narela"],
  "Jammu and Kashmir":["Srinagar","Jammu","Anantnag","Baramulla","Sopore","Kathua","Udhampur","Punch"],
  "Ladakh":["Leh","Kargil"],
  "Chandigarh":["Chandigarh"],
  "Puducherry":["Puducherry","Karaikal","Mahe","Yanam"],
  "Andaman and Nicobar Islands":["Port Blair","Diglipur","Rangat"],
  "Dadra and Nagar Haveli and Daman and Diu":["Silvassa","Daman","Diu"],
  "Lakshadweep":["Kavaratti","Agatti","Minicoy"],
};

const ALL_STATES = Object.keys(INDIA_STATES).sort();

// ── AutocompleteField ─────────────────────────────────────────────────────────

function AutocompleteField({ label, value, onChange, suggestions, placeholder, required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  suggestions: string[]; placeholder?: string; required?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g. reset)
  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.length > 0
    ? suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : suggestions.slice(0, 8);

  const select = (v: string) => {
    setQuery(v);
    onChange(v);
    setOpen(false);
    setHighlighted(0);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open) { if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlighted]) select(filtered[highlighted]); }
    else if (e.key === "Escape") setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} ref={wrapRef}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}{required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); setHighlighted(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: "100%", background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
            padding: "11px 14px", color: "#f1f5f9", fontSize: 14,
            outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
          onFocusCapture={(e) => (e.target.style.borderColor = "#6366f1")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
        />

        <AnimatePresence>
          {open && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
                background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                maxHeight: 260, overflowY: "auto",
              }}
            >
              {filtered.map((item, i) => (
                <div
                  key={item}
                  onMouseDown={() => select(item)}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    padding: "10px 14px", fontSize: 13, cursor: "pointer",
                    color: i === highlighted ? "#f1f5f9" : "#94a3b8",
                    background: i === highlighted ? "rgba(99,102,241,0.2)" : "transparent",
                    transition: "background 0.1s",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {/* Highlight matching part */}
                  {(() => {
                    const idx = item.toLowerCase().indexOf(query.toLowerCase());
                    if (idx === -1 || !query) return <span>{item}</span>;
                    return (
                      <span>
                        {item.slice(0, idx)}
                        <span style={{ color: "#818cf8", fontWeight: 600 }}>{item.slice(idx, idx + query.length)}</span>
                        {item.slice(idx + query.length)}
                      </span>
                    );
                  })()}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Plain Field ───────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}{required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 14,
          outline: "none", fontFamily: "inherit", transition: "border-color 0.2s",
          width: "100%", boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IndividualProfilePage({ onBack, onNext }: Props) {
  const { setServerStatus, setProfileId, nextStep } = useOnboardingStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", date_of_birth: "", nationality: "",
    country_of_residence: "", phone: "", email: "",
    occupation: "", tax_id: "",
    address_line1: "", address_city: "", address_state: "",
    address_postal_code: "", address_country: "",
  });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isIndia = form.country_of_residence === "India" || form.address_country === "India";
  const stateSuggestions = isIndia ? ALL_STATES : [];
  const citySuggestions = form.address_state && INDIA_STATES[form.address_state]
    ? INDIA_STATES[form.address_state]
    : [];

  const toISODate = (raw: string): string | null => {
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return raw;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name) return toast.error("Full name is required");
    setLoading(true);
    try {
      const payload = {
        full_name: form.full_name,
        date_of_birth: toISODate(form.date_of_birth),
        nationality: form.nationality || null,
        country_of_residence: form.country_of_residence || null,
        phone: form.phone || null,
        email: form.email || null,
        occupation: form.occupation || null,
        tax_id: form.tax_id || null,
        address: form.address_line1 ? {
          line1: form.address_line1,
          city: form.address_city,
          state: form.address_state,
          postal_code: form.address_postal_code,
          country: form.address_country,
        } : null,
      };
      const res = await saveIndividualProfile(payload);
      setProfileId(res.data.id);
      setServerStatus(res.data.onboarding_status);
      nextStep();
      onNext();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d: { msg: string }) => d.msg).join(", ")
          : String(detail || "Failed to save profile.");
        toast.error(msg);
      } else {
        toast.error("Failed to save profile. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const section: React.CSSProperties = {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 24, marginBottom: 16,
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "#6366f1",
    letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18,
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <User size={20} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>Personal Information</h2>
          <p style={{ fontSize: 13, color: "#475569" }}>This information will be verified against your identity documents.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Personal Details */}
        <div style={section}>
          <div style={sectionTitle}>Personal Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Full Legal Name" value={form.full_name} onChange={set("full_name")} placeholder="As it appears on your ID" required />
            </div>
            <Field label="Date of Birth" value={form.date_of_birth} onChange={set("date_of_birth")} type="date" />
            <AutocompleteField label="Nationality" value={form.nationality} onChange={set("nationality")} suggestions={NATIONALITIES} placeholder="Type to search…" />
            <AutocompleteField label="Country of Residence" value={form.country_of_residence}
              onChange={(v) => { set("country_of_residence")(v); if (v !== "India") { set("address_state")(""); set("address_city")(""); } }}
              suggestions={COUNTRIES} placeholder="Type to search…" />
            <Field label="Occupation" value={form.occupation} onChange={set("occupation")} placeholder="e.g. Software Engineer" />
            <Field label="Tax ID / PAN" value={form.tax_id} onChange={set("tax_id")} placeholder="e.g. ABCDE1234F" />
          </div>
        </div>

        {/* Contact */}
        <div style={section}>
          <div style={sectionTitle}>Contact Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Mobile Number" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
            <Field label="Email Address" value={form.email} onChange={set("email")} type="email" placeholder="you@example.com" />
          </div>
        </div>

        {/* Address */}
        <div style={section}>
          <div style={sectionTitle}>Residential Address</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Address Line 1" value={form.address_line1} onChange={set("address_line1")} placeholder="Street address" />
            </div>
            <AutocompleteField
              label="State / Province"
              value={form.address_state}
              onChange={(v) => { set("address_state")(v); set("address_city")(""); }}
              suggestions={stateSuggestions.length > 0 ? stateSuggestions : ALL_STATES}
              placeholder="Type to search state…"
            />
            <AutocompleteField
              label="City"
              value={form.address_city}
              onChange={set("address_city")}
              suggestions={citySuggestions.length > 0 ? citySuggestions : []}
              placeholder="Type to search city…"
            />
            <Field label="Postal Code" value={form.address_postal_code} onChange={set("address_postal_code")} placeholder="400001" />
            <AutocompleteField label="Country" value={form.address_country} onChange={set("address_country")} suggestions={COUNTRIES} placeholder="Type to search country…" />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button type="button" onClick={onBack} style={{
            flex: "0 0 auto", padding: "13px 20px",
            background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, color: "#f1f5f9", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <ArrowLeft size={15} color="#f1f5f9" /> Back
          </button>
          <button type="submit" disabled={loading} style={{
            flex: 1, padding: "13px 20px", background: "#6366f1", border: "none",
            borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? <><Spinner size={14} color="#fff" /> Saving…</> : <>Save & Continue <ArrowRight size={15} color="#fff" /></>}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

import { useState, FormEvent } from "react";
import { calculateRisk, getRiskHistory } from "../api/client";

interface RiskResult {
  id: string;
  final_score: number;
  decision: string;
  kyc_risk: number;
  aml_risk: number;
  geographic_risk: number;
  behavioural_risk: number;
  transaction_risk: number;
  device_ip_risk: number;
  ownership_structure_risk: number;
}

const defaultForm = {
  user_id: "",
  kyc_verified: false,
  doc_confidence_avg: 0,
  face_similarity: 0,
  is_pep: false,
  is_sanctioned: false,
  adverse_media: false,
  country_code: "IN",
  login_anomaly: false,
  transaction_velocity: 0,
  ip_risk_score: 0,
  has_complex_ownership: false,
};

export default function RiskPage() {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [history, setHistory] = useState<RiskResult[]>([]);
  const [error, setError] = useState("");

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleCalculate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await calculateRisk(form);
      setResult(data);
    } catch {
      setError("Calculation failed. Check your role permissions.");
    }
  };

  const handleHistory = async () => {
    if (!form.user_id) return;
    const { data } = await getRiskHistory(form.user_id);
    setHistory(data);
  };

  const decisionColor = (d: string) =>
    d === "approve" ? "text-green-600" : d === "reject" ? "text-red-600" : "text-yellow-600";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Risk Scoring</h2>

      <form onSubmit={handleCalculate} className="bg-white p-6 rounded-xl shadow space-y-4 max-w-2xl">
        <h3 className="font-medium text-gray-700">Calculate Risk Score</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <label className="block text-gray-600 mb-1">User ID</label>
            <input className="w-full border rounded-md p-2" value={form.user_id} onChange={(e) => set("user_id", e.target.value)} required />
          </div>
          <NumField label="Doc Confidence Avg" value={form.doc_confidence_avg} onChange={(v) => set("doc_confidence_avg", v)} step={0.01} max={1} />
          <NumField label="Face Similarity" value={form.face_similarity} onChange={(v) => set("face_similarity", v)} step={0.01} max={1} />
          <NumField label="Transaction Velocity" value={form.transaction_velocity} onChange={(v) => set("transaction_velocity", v)} />
          <NumField label="IP Risk Score" value={form.ip_risk_score} onChange={(v) => set("ip_risk_score", v)} max={100} />
          <div>
            <label className="block text-gray-600 mb-1">Country Code</label>
            <input className="w-full border rounded-md p-2" value={form.country_code} onChange={(e) => set("country_code", e.target.value)} maxLength={2} />
          </div>
          <div className="flex flex-col gap-2 pt-5">
            {(["kyc_verified", "is_pep", "is_sanctioned", "adverse_media", "login_anomaly", "has_complex_ownership"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 capitalize cursor-pointer">
                <input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} />
                {k.replace(/_/g, " ")}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Calculate</button>
          <button type="button" onClick={handleHistory} className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800">Load History</button>
        </div>
      </form>

      {result && (
        <div className="bg-white p-6 rounded-xl shadow max-w-2xl">
          <h3 className="font-medium text-gray-700 mb-3">Result</h3>
          <p className="text-3xl font-bold text-gray-800">{result.final_score} <span className={`text-lg font-semibold ${decisionColor(result.decision)}`}>— {result.decision}</span></p>
          <div className="grid grid-cols-3 gap-3 mt-4 text-sm text-gray-600">
            {(["kyc_risk", "aml_risk", "geographic_risk", "behavioural_risk", "transaction_risk", "device_ip_risk", "ownership_structure_risk"] as const).map((k) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 capitalize">{k.replace(/_/g, " ")}</p>
                <p className="text-lg font-semibold">{result[k]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden max-w-2xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                {["Score", "Decision", "KYC", "AML", "Geo", "Behaviour", "Transaction"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-bold">{r.final_score}</td>
                  <td className={`px-4 py-3 font-medium ${decisionColor(r.decision)}`}>{r.decision}</td>
                  <td className="px-4 py-3">{r.kyc_risk}</td>
                  <td className="px-4 py-3">{r.aml_risk}</td>
                  <td className="px-4 py-3">{r.geographic_risk}</td>
                  <td className="px-4 py-3">{r.behavioural_risk}</td>
                  <td className="px-4 py-3">{r.transaction_risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; max?: number }) {
  return (
    <div>
      <label className="block text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        className="w-full border rounded-md p-2"
        value={value}
        step={step}
        min={0}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

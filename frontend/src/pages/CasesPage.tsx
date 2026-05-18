import { useEffect, useState, FormEvent } from "react";
import { createCase, listCases, resolveCase } from "../api/client";

interface Case {
  id: string;
  user_id: string;
  case_type: string | null;
  status: string;
  priority: string;
  notes: string | null;
}

const CASE_TYPES = ["kyc_review", "aml_alert", "fraud_investigation", "document_issue", "other"];
const PRIORITIES = ["low", "medium", "high", "critical"];

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [form, setForm] = useState({ user_id: "", case_type: CASE_TYPES[0], priority: "medium", notes: "" });
  const [error, setError] = useState("");

  const fetchCases = () => listCases().then((r) => setCases(r.data));

  useEffect(() => { fetchCases(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createCase(form);
      setForm({ user_id: "", case_type: CASE_TYPES[0], priority: "medium", notes: "" });
      fetchCases();
    } catch {
      setError("Failed to create case. Check your role permissions.");
    }
  };

  const handleResolve = async (id: string) => {
    await resolveCase(id);
    fetchCases();
  };

  const priorityColor = (p: string) =>
    ({ critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-gray-100 text-gray-600" }[p] ?? "");

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Cases</h2>

      <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow space-y-4 max-w-lg">
        <h3 className="font-medium text-gray-700">Create Case</h3>
        <input
          className="w-full border rounded-md p-2 text-sm"
          placeholder="User UUID"
          value={form.user_id}
          onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          required
        />
        <select className="w-full border rounded-md p-2 text-sm" value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>
          {CASE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="w-full border rounded-md p-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <textarea
          className="w-full border rounded-md p-2 text-sm h-20 resize-none"
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Create
        </button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {["Type", "Status", "Priority", "Notes", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cases.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 capitalize">{c.case_type ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{c.status}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColor(c.priority)}`}>{c.priority}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{c.notes ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.status !== "resolved" && (
                    <button
                      onClick={() => handleResolve(c.id)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No cases found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

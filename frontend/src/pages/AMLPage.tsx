import { useState, FormEvent } from "react";
import { screenAML, getAMLResults } from "../api/client";

interface AMLResult {
  id: string;
  normalized_name: string;
  is_pep: boolean;
  is_sanctioned: boolean;
  adverse_media_flag: boolean;
  risk_flags: string[] | null;
  screened_at: string;
}

export default function AMLPage() {
  const [form, setForm] = useState({ full_name: "", date_of_birth: "", profile_type: "individual" });
  const [lookupUserId, setLookupUserId] = useState("");
  const [results, setResults] = useState<AMLResult[]>([]);
  const [msg, setMsg] = useState("");

  const handleScreen = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      const { data } = await screenAML(form);
      setMsg(data.message);
    } catch {
      setMsg("Screening request failed.");
    }
  };

  const handleFetch = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await getAMLResults(lookupUserId);
      setResults(data);
    } catch {
      setResults([]);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">AML Screening</h2>

      <form onSubmit={handleScreen} className="bg-white p-6 rounded-xl shadow space-y-4 max-w-lg">
        <h3 className="font-medium text-gray-700">Trigger Screening</h3>
        <input
          className="w-full border rounded-md p-2 text-sm"
          placeholder="Full name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          required
        />
        <input
          className="w-full border rounded-md p-2 text-sm"
          placeholder="Date of birth (YYYY-MM-DD)"
          value={form.date_of_birth}
          onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
        />
        <select
          className="w-full border rounded-md p-2 text-sm"
          value={form.profile_type}
          onChange={(e) => setForm({ ...form, profile_type: e.target.value })}
        >
          <option value="individual">Individual</option>
          <option value="corporate">Corporate</option>
        </select>
        {msg && <p className="text-indigo-600 text-sm">{msg}</p>}
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          Screen
        </button>
      </form>

      <form onSubmit={handleFetch} className="bg-white p-6 rounded-xl shadow space-y-4 max-w-lg">
        <h3 className="font-medium text-gray-700">Fetch Results by User ID</h3>
        <input
          className="w-full border rounded-md p-2 text-sm"
          placeholder="User UUID"
          value={lookupUserId}
          onChange={(e) => setLookupUserId(e.target.value)}
          required
        />
        <button type="submit" className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800">
          Fetch
        </button>
      </form>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                {["Name", "PEP", "Sanctioned", "Adverse Media", "Screened At"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{r.normalized_name}</td>
                  <td className="px-4 py-3"><Flag value={r.is_pep} /></td>
                  <td className="px-4 py-3"><Flag value={r.is_sanctioned} /></td>
                  <td className="px-4 py-3"><Flag value={r.adverse_media_flag} /></td>
                  <td className="px-4 py-3 text-gray-400">{r.screened_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Flag({ value }: { value: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${value ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
      {value ? "Yes" : "No"}
    </span>
  );
}

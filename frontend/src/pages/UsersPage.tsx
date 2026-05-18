import { useEffect, useState } from "react";
import { listUsers } from "../api/client";

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listUsers()
      .then((r) => setUsers(r.data))
      .catch(() => setError("Access denied or failed to load users."));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Users</h2>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {["Email", "Role", "Active", "MFA"].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {u.is_active ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.mfa_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.mfa_enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
              </tr>
            ))}
            {users.length === 0 && !error && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

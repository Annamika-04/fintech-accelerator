import { useState, FormEvent } from "react";
import { submitFaceVerification, getFaceVerification } from "../api/client";

interface VerificationResult {
  id: string;
  status: string;
  is_match: boolean | null;
  similarity_score: number | null;
  confidence_score: number | null;
}

export default function FaceVerificationPage() {
  const [selfieKey, setSelfieKey] = useState("");
  const [idKey, setIdKey] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await submitFaceVerification({
        selfie_s3_key: selfieKey,
        id_document_s3_key: idKey,
      });
      setResult(data);
      pollStatus(data.id);
    } catch {
      setError("Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = (id: string) => {
    const interval = setInterval(async () => {
      const { data } = await getFaceVerification(id);
      setResult(data);
      if (data.status !== "pending") clearInterval(interval);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Face Verification</h2>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow space-y-4 max-w-lg">
        <p className="text-sm text-gray-500">
          Provide the S3 keys for the selfie and ID document already uploaded to S3.
        </p>
        <input
          className="w-full border rounded-md p-2 text-sm"
          placeholder="Selfie S3 key (e.g. users/uuid/selfie.jpg)"
          value={selfieKey}
          onChange={(e) => setSelfieKey(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-md p-2 text-sm"
          placeholder="ID Document S3 key"
          value={idKey}
          onChange={(e) => setIdKey(e.target.value)}
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
      </form>

      {result && (
        <div className="bg-white p-6 rounded-xl shadow max-w-lg space-y-2 text-sm">
          <p><span className="font-medium">Status:</span> {result.status}</p>
          {result.status !== "pending" && (
            <>
              <p>
                <span className="font-medium">Match:</span>{" "}
                <span className={result.is_match ? "text-green-600" : "text-red-600"}>
                  {result.is_match ? "Yes" : "No"}
                </span>
              </p>
              <p><span className="font-medium">Similarity:</span> {result.similarity_score?.toFixed(2) ?? "—"}</p>
              <p><span className="font-medium">Confidence:</span> {result.confidence_score?.toFixed(2) ?? "—"}</p>
            </>
          )}
          {result.status === "pending" && (
            <p className="text-yellow-600 animate-pulse">Processing… auto-refreshing every 3s</p>
          )}
        </div>
      )}
    </div>
  );
}

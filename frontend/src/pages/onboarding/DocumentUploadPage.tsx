import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2, XCircle, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { getPresignedUrl, confirmUpload, markDocumentsUploaded } from "../../api/client";
import { useOnboardingStore } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import toast from "react-hot-toast";
import axios from "axios";

interface Props { onBack: () => void; onNext: () => void; onboardingType: "individual" | "corporate"; }

interface UploadedFile {
  id: string; name: string; type: string;
  status: "uploading" | "done" | "error";
  progress: number; documentId?: string;
}

const DOC_TYPES_INDIVIDUAL = [
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driver's License" },
  { value: "aadhaar", label: "National ID / Aadhaar" },
  { value: "utility_bill", label: "Address Proof (Utility Bill)" },
  { value: "pan", label: "PAN Card / Tax Document" },
];

const DOC_TYPES_CORPORATE = [
  { value: "company_document", label: "Certificate of Incorporation" },
  { value: "company_document", label: "Business License" },
  { value: "utility_bill", label: "Registered Address Proof" },
  { value: "pan", label: "Tax Returns / EIN Document" },
];

export default function DocumentUploadPage({ onBack, onNext, onboardingType }: Props) {
  const { setServerStatus, nextStep } = useOnboardingStore();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedDocType, setSelectedDocType] = useState("passport");
  const [dragging, setDragging] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const docTypes = onboardingType === "corporate" ? DOC_TYPES_CORPORATE : DOC_TYPES_INDIVIDUAL;

  const uploadFile = async (file: File) => {
    const uid = crypto.randomUUID();
    const entry: UploadedFile = { id: uid, name: file.name, type: selectedDocType, status: "uploading", progress: 0 };
    setFiles((f) => [...f, entry]);

    try {
      // 1. Get presigned URL
      const { data } = await getPresignedUrl({
        document_type: selectedDocType,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
      });

      // 2. Upload directly to S3
      await axios.put(data.upload_url, file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / (e.total || 1)) * 100);
          setFiles((f) => f.map((x) => x.id === uid ? { ...x, progress: pct } : x));
        },
      });

      // 3. Confirm upload
      await confirmUpload({ document_id: data.document_id, file_hash: uid });

      setFiles((f) => f.map((x) => x.id === uid ? { ...x, status: "done", progress: 100, documentId: data.document_id } : x));
    } catch {
      setFiles((f) => f.map((x) => x.id === uid ? { ...x, status: "error" } : x));
      toast.error(`Failed to upload ${file.name}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(uploadFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(uploadFile);
    e.target.value = "";
  };

  const handleContinue = async () => {
    const done = files.filter((f) => f.status === "done");
    if (done.length === 0) return toast.error("Please upload at least one document");
    setAdvancing(true);
    try {
      const res = await markDocumentsUploaded();
      setServerStatus(res.data.current_status);
      nextStep();
      onNext();
    } catch {
      toast.error("Failed to advance. Please try again.");
    } finally {
      setAdvancing(false);
    }
  };

  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
      style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileText size={20} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>Document Upload</h2>
          <p style={{ fontSize: 13, color: "#475569" }}>Upload clear, unobstructed copies of your documents.</p>
        </div>
      </div>

      {/* Document type selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
          Document Type
        </label>
        <select value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value)}
          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit" }}>
          {docTypes.map((d, i) => (
            <option key={i} value={d.value} style={{ background: "#1e293b" }}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
          borderRadius: 14, padding: "40px 24px", textAlign: "center",
          cursor: "pointer", transition: "all 0.2s", marginBottom: 20,
          background: dragging ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.02)",
        }}
      >
        <input ref={inputRef} type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.webp" onChange={handleFileInput} style={{ display: "none" }} />
        <Upload size={32} color={dragging ? "#818cf8" : "#334155"} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: dragging ? "#818cf8" : "#64748b", marginBottom: 6 }}>
          {dragging ? "Drop files here" : "Drag & drop files or click to browse"}
        </div>
        <div style={{ fontSize: 12, color: "#334155" }}>PDF, JPG, PNG, WEBP · Max 10MB per file</div>
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.map((f) => (
          <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              {f.status === "uploading" && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${f.progress}%`, background: "#6366f1", transition: "width 0.3s", borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{f.progress}%</div>
                </div>
              )}
            </div>
            {f.status === "done" && <CheckCircle2 size={18} color="#22c55e" />}
            {f.status === "error" && <XCircle size={18} color="#ef4444" />}
            {f.status === "uploading" && <Spinner size={16} color="#6366f1" />}
          </motion.div>
        ))}
      </AnimatePresence>

      {doneCount > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, marginBottom: 20 }}>
          <AlertCircle size={14} color="#22c55e" />
          <span style={{ fontSize: 13, color: "#86efac" }}>{doneCount} document{doneCount > 1 ? "s" : ""} uploaded successfully</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" onClick={onBack} style={{ flex: "0 0 auto", padding: "13px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={handleContinue} disabled={advancing || doneCount === 0} style={{ flex: 1, padding: "13px 20px", background: doneCount > 0 ? "#6366f1" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 10, color: doneCount > 0 ? "#fff" : "#475569", fontSize: 14, fontWeight: 600, cursor: doneCount > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {advancing ? <><Spinner size={14} color="#fff" /> Processing…</> : <> Continue to Selfie <ArrowRight size={15} /></>}
        </button>
      </div>

    </motion.div>
  );
}

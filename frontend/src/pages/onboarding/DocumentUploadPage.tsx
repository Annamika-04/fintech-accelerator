import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2, XCircle, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { getPresignedUrl, confirmUpload, markDocumentsUploaded, uploadDocumentDirect, listDocuments } from "../../api/client";
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

const ALREADY_UPLOADED_STATUSES = [
  "DOCUMENTS_UPLOADED", "KYC_PENDING", "KYC_VALIDATION_RUNNING",
  "AML_PENDING", "UNDER_REVIEW", "APPROVED",
];

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

const ID_DOCUMENT_TYPES = ["passport", "driving_license", "aadhaar", "pan", "company_document"];

export default function DocumentUploadPage({ onBack, onNext, onboardingType }: Props) {
  const { setServerStatus, serverStatus, mergeStepData, setIdDocumentS3Key } = useOnboardingStore();

  // Restore persisted files from store on reload
  const savedDocs = (useOnboardingStore.getState().stepData?.documents ?? []) as UploadedFile[];
  const [files, setFiles] = useState<UploadedFile[]>(savedDocs);
  const [selectedDocType, setSelectedDocType] = useState("passport");
  const [dragging, setDragging] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch fresh server status on mount to avoid stale store data
  useEffect(() => {
    import("../../api/client").then(({ getOnboardingStatus }) => {
      getOnboardingStatus().then((res) => {
        setServerStatus(res.data.current_status);
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    listDocuments()
      .then((res) => {
        const docs = res.data as { s3_key: string; document_type: string; upload_status: string }[];
        const idDoc = docs.find((doc) =>
          doc.upload_status === "uploaded" &&
          doc.s3_key &&
          ID_DOCUMENT_TYPES.includes(doc.document_type)
        );
        if (idDoc) setIdDocumentS3Key(idDoc.s3_key);
      })
      .catch(() => {});
  }, [setIdDocumentS3Key]);

  const docTypes = onboardingType === "corporate" ? DOC_TYPES_CORPORATE : DOC_TYPES_INDIVIDUAL;
  const preferServerUpload = typeof window !== "undefined" && window.location.hostname === "localhost";

  // If server already advanced past documents step — treat as already done
  const alreadyUploaded = serverStatus ? ALREADY_UPLOADED_STATUSES.includes(serverStatus) : false;

  const doneCount = alreadyUploaded ? 1 : files.filter((f) => f.status === "done").length;

  // Persist files to store whenever they change
  useEffect(() => {
    const donFiles = files.filter((f) => f.status === "done");
    if (donFiles.length > 0) {
      mergeStepData({ documents: donFiles as unknown as Record<string, unknown> });
    }
  }, [files]);

  const uploadFile = async (file: File) => {
    const uid = crypto.randomUUID();
    const entry: UploadedFile = { id: uid, name: file.name, type: selectedDocType, status: "uploading", progress: 0 };
    setFiles((f) => [...f, entry]);

    const isIdDocument = ["passport", "driving_license", "aadhaar", "company_document"].includes(selectedDocType);

    try {
      if (preferServerUpload) {
        const { data } = await uploadDocumentDirect(selectedDocType, file);
        setFiles((f) => f.map((x) => x.id === uid ? { ...x, status: "done", progress: 100, documentId: data.document_id } : x));
        if (data.s3_key && isIdDocument && ID_DOCUMENT_TYPES.includes(selectedDocType)) {
          setIdDocumentS3Key(data.s3_key);
          mergeStepData({ idDocumentS3Key: data.s3_key as Record<string, unknown> });
        }
        toast.success(`${file.name} uploaded successfully`);
        return;
      }

      const { data } = await getPresignedUrl({
        document_type: selectedDocType,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
      });

      await axios.put(data.upload_url, file, {
        headers: data.upload_headers,
        withCredentials: false,
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / (e.total || 1)) * 100);
          setFiles((f) => f.map((x) => x.id === uid ? { ...x, progress: pct } : x));
        },
      });

      await confirmUpload({ document_id: data.document_id, file_hash: uid });
      setFiles((f) => f.map((x) => x.id === uid ? { ...x, status: "done", progress: 100, documentId: data.document_id } : x));
      if (data.s3_key && isIdDocument && ID_DOCUMENT_TYPES.includes(selectedDocType)) {
        setIdDocumentS3Key(data.s3_key);
        mergeStepData({ idDocumentS3Key: data.s3_key as Record<string, unknown> });
      }
      toast.success(`${file.name} uploaded successfully`);

    } catch (err) {
      const shouldFallback = axios.isAxiosError(err) && (!err.response || err.message === "Network Error");

      if (shouldFallback) {
        try {
          const { data } = await uploadDocumentDirect(selectedDocType, file);
          setFiles((f) => f.map((x) => x.id === uid ? { ...x, status: "done", progress: 100, documentId: data.document_id } : x));
          if (data.s3_key && isIdDocument && ID_DOCUMENT_TYPES.includes(selectedDocType)) {
            setIdDocumentS3Key(data.s3_key);
            mergeStepData({ idDocumentS3Key: data.s3_key as Record<string, unknown> });
          }
          toast.success(`${file.name} uploaded via server fallback`);
          return;
        } catch (fallbackErr) {
          const msg = axios.isAxiosError(fallbackErr)
            ? fallbackErr.response?.data?.detail || fallbackErr.message
            : "Upload failed";
          setFiles((f) => f.map((x) => x.id === uid ? { ...x, status: "error" } : x));
          toast.error(`Failed: ${msg}`);
          return;
        }
      }

      setFiles((f) => f.map((x) => x.id === uid ? { ...x, status: "error" } : x));
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.detail || err.message
        : "Upload failed";
      toast.error(`Failed: ${msg}`);
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
    if (doneCount === 0) return toast.error("Please upload at least one document");
    setAdvancing(true);
    try {
      // Skip markDocumentsUploaded if server already advanced past this step
      if (alreadyUploaded) {
        onNext();
        return;
      }
      const res = await markDocumentsUploaded();
      setServerStatus(res.data.current_status);
      onNext();
    } catch (err) {
      // 409 means already uploaded — just advance
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        onNext();
        return;
      }
      toast.error("Failed to advance. Please try again.");
    } finally {
      setAdvancing(false);
    }
  };

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

      {/* Already uploaded banner */}
      {alreadyUploaded && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, marginBottom: 20 }}>
          <CheckCircle2 size={16} color="#22c55e" />
          <span style={{ fontSize: 13, color: "#86efac" }}>Documents already uploaded. You can continue to the next step.</span>
        </div>
      )}

      {!alreadyUploaded && (
        <>
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
        </>
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

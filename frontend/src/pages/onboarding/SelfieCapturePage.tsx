import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, CheckCircle2, ArrowRight, ArrowLeft, ScanFace } from "lucide-react";
import { getPresignedUrl, confirmUpload, submitFaceVerification, triggerKYC } from "../../api/client";
import { useOnboardingStore } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import toast from "react-hot-toast";
import axios from "axios";

interface Props { onBack: () => void; onNext: () => void; }

export default function SelfieCapturePage({ onBack, onNext }: Props) {
  const { setServerStatus, nextStep } = useOnboardingStore();
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieS3Key, setSelfieS3Key] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      toast.error("Camera access denied. Please upload a selfie instead.");
    }
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
      setSelfieFile(file);
      setSelfiePreview(canvas.toDataURL("image/jpeg"));
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
  };

  const uploadSelfie = async () => {
    if (!selfieFile) return;
    setUploading(true);
    try {
      const { data } = await getPresignedUrl({
        document_type: "passport",
        filename: selfieFile.name,
        content_type: selfieFile.type,
        file_size_bytes: selfieFile.size,
      });
      await axios.put(data.upload_url, selfieFile, { headers: { "Content-Type": selfieFile.type } });
      await confirmUpload({ document_id: data.document_id, file_hash: crypto.randomUUID() });
      setSelfieS3Key(data.s3_key);
      setSubmitted(true);
      toast.success("Selfie uploaded successfully");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    if (!selfieS3Key) return toast.error("Please upload your selfie first");
    setAdvancing(true);
    try {
      // Submit face verification job
      await submitFaceVerification({ selfie_s3_key: selfieS3Key, id_document_s3_key: selfieS3Key });
      // Advance state machine
      const res = await triggerKYC();
      setServerStatus(res.data.current_status);
      nextStep();
      onNext();
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
      style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ScanFace size={20} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>Identity Selfie</h2>
          <p style={{ fontSize: 13, color: "#475569" }}>Take a clear selfie or upload a photo for face verification.</p>
        </div>
      </div>

      {/* Camera / Preview area */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden", marginBottom: 20, aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {cameraActive && (
          <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {selfiePreview && !cameraActive && (
          <img src={selfiePreview} alt="Selfie preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {!cameraActive && !selfiePreview && (
          <div style={{ textAlign: "center", color: "#334155" }}>
            <Camera size={48} color="#1e293b" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, color: "#475569" }}>Camera preview will appear here</div>
          </div>
        )}
        {submitted && (
          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(34,197,94,0.9)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} color="#fff" />
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Verified</span>
          </div>
        )}
      </div>

      {/* Liveness hints */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
        {["Face clearly visible", "Good lighting", "No glasses/hat"].map((hint) => (
          <div key={hint} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px", textAlign: "center", fontSize: 11, color: "#475569" }}>
            {hint}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {!cameraActive ? (
          <button onClick={startCamera} style={{ flex: 1, padding: "12px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, color: "#818cf8", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Camera size={16} /> Open Camera
          </button>
        ) : (
          <button onClick={capturePhoto} style={{ flex: 1, padding: "12px", background: "#6366f1", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Camera size={16} /> Capture Photo
          </button>
        )}
        <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Upload size={16} /> Upload Photo
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
      </div>

      {selfieFile && !submitted && (
        <button onClick={uploadSelfie} disabled={uploading} style={{ width: "100%", padding: "12px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, color: "#22c55e", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {uploading ? <><Spinner size={14} color="#22c55e" /> Uploading…</> : <><CheckCircle2 size={15} /> Confirm & Upload Selfie</>}
        </button>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", padding: "13px 20px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#64748b", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={handleContinue} disabled={!submitted || advancing} style={{ flex: 1, padding: "13px 20px", background: submitted ? "#6366f1" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 10, color: submitted ? "#fff" : "#475569", fontSize: 14, fontWeight: 600, cursor: submitted ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {advancing ? <><Spinner size={14} color="#fff" /> Submitting…</> : <> Submit for Verification <ArrowRight size={15} /></>}
        </button>
      </div>
    </motion.div>
  );
}

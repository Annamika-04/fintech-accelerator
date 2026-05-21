import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, CheckCircle2, XCircle, ArrowRight, ArrowLeft, ScanFace, AlertTriangle, RefreshCw } from "lucide-react";
import { getPresignedUrl, confirmUpload, submitFaceVerification, triggerKYC, saveStep } from "../../api/client";
import { useOnboardingStore } from "../../store/onboardingStore";
import { Spinner } from "../../components/ui";
import toast from "react-hot-toast";
import axios from "axios";

interface Props { onBack: () => void; onNext: () => void; }

type CheckStatus = "pending" | "pass" | "fail";
interface QualityChecks {
  faceVisible: CheckStatus;
  goodLighting: CheckStatus;
  noGlassesHat: CheckStatus;
}

export default function SelfieCapturePage({ onBack, onNext }: Props) {
  const { setServerStatus, nextStep, idDocumentS3Key, mergeStepData } = useOnboardingStore();
  const savedSelfie = useOnboardingStore.getState().stepData?.selfie as { selfie_s3_key?: string; preview?: string } | undefined;

  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(savedSelfie?.preview || null);
  const [selfieS3Key, setSelfieS3Key] = useState<string | null>(savedSelfie?.selfie_s3_key || null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(!!savedSelfie?.selfie_s3_key);
  const [advancing, setAdvancing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Image quality checks ──────────────────────────────────────────────────
  const [checks, setChecks] = useState<QualityChecks>({
    faceVisible: "pending",
    goodLighting: "pending",
    noGlassesHat: "pending",
  });
  const [checkAlerts, setCheckAlerts] = useState<string[]>([]);

  const analyseImage = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      const w = img.width;
      const h = img.height;

      // ── 1. Brightness check (good lighting) ──────────────────────────────
      const fullData = ctx.getImageData(0, 0, w, h).data;
      let totalBrightness = 0;
      for (let i = 0; i < fullData.length; i += 4) {
        totalBrightness += (fullData[i] * 0.299 + fullData[i + 1] * 0.587 + fullData[i + 2] * 0.114);
      }
      const avgBrightness = totalBrightness / (fullData.length / 4);
      const lightingOk = avgBrightness > 60 && avgBrightness < 220;

      // ── 2. Face visible — check centre region has enough contrast ─────────
      const cx = Math.floor(w * 0.25);
      const cy = Math.floor(h * 0.15);
      const cw = Math.floor(w * 0.5);
      const ch = Math.floor(h * 0.7);
      const centerData = ctx.getImageData(cx, cy, cw, ch).data;
      let minL = 255; let maxL = 0;
      for (let i = 0; i < centerData.length; i += 4) {
        const l = (centerData[i] * 0.299 + centerData[i + 1] * 0.587 + centerData[i + 2] * 0.114);
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
      const contrast = maxL - minL;
      const faceOk = contrast > 40;

      // ── 3. No glasses/hat — check top strip brightness vs face centre ─────
      // If top 15% of image is significantly darker than centre → likely hat
      const topData = ctx.getImageData(0, 0, w, Math.floor(h * 0.15)).data;
      let topBrightness = 0;
      for (let i = 0; i < topData.length; i += 4) {
        topBrightness += (topData[i] * 0.299 + topData[i + 1] * 0.587 + topData[i + 2] * 0.114);
      }
      const avgTop = topBrightness / (topData.length / 4);
      // Check eye region (middle vertical strip) for horizontal dark bands → glasses
      const eyeData = ctx.getImageData(Math.floor(w * 0.2), Math.floor(h * 0.3), Math.floor(w * 0.6), Math.floor(h * 0.15)).data;
      let darkPixels = 0;
      for (let i = 0; i < eyeData.length; i += 4) {
        const l = (eyeData[i] * 0.299 + eyeData[i + 1] * 0.587 + eyeData[i + 2] * 0.114);
        if (l < 60) darkPixels++;
      }
      const darkRatio = darkPixels / (eyeData.length / 4);
      const noGlassesHatOk = darkRatio < 0.25 && avgTop > 30;

      const alerts: string[] = [];
      if (!lightingOk) alerts.push(avgBrightness <= 60 ? "Image is too dark. Move to a brighter area." : "Image is overexposed. Reduce direct light.");
      if (!faceOk) alerts.push("Face not clearly detected. Ensure your face is centred and visible.");
      if (!noGlassesHatOk) alerts.push("Possible glasses or hat detected. Please remove them for accurate verification.");

      setChecks({
        faceVisible: faceOk ? "pass" : "fail",
        goodLighting: lightingOk ? "pass" : "fail",
        noGlassesHat: noGlassesHatOk ? "pass" : "fail",
      });
      setCheckAlerts(alerts);
    };
    img.src = dataUrl;
  };

  const retake = useCallback(() => {
    setSelfieFile(null);
    setSelfiePreview(null);
    setSelfieS3Key(null);
    setSubmitted(false);
    setChecks({ faceVisible: "pending", goodLighting: "pending", noGlassesHat: "pending" });
    setCheckAlerts([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setCameraActive(true);
      // Wait for the video element to mount after state update, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
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
      const dataUrl = canvas.toDataURL("image/jpeg");
      setSelfieFile(file);
      setSelfiePreview(dataUrl);
      analyseImage(dataUrl);
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setSelfieFile(file);
    setSelfiePreview(objectUrl);
    // Read as dataURL for canvas analysis
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) analyseImage(ev.target.result as string); };
    reader.readAsDataURL(file);
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
      // Persist selfie locally and to backend
      mergeStepData({ selfie: { selfie_s3_key: data.s3_key, preview: selfiePreview ?? undefined } as unknown as Record<string, unknown> });
      await saveStep("selfie", { selfie_s3_key: data.s3_key }, undefined);
      toast.success("Selfie uploaded successfully");
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    if (!selfieS3Key) return toast.error("Please upload your selfie first");
    if (!idDocumentS3Key) return toast.error("ID document not found. Please go back and upload your document.");
    setAdvancing(true);
    try {
      await submitFaceVerification({ selfie_s3_key: selfieS3Key, id_document_s3_key: idDocumentS3Key });
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
          <video ref={videoRef} autoPlay playsInline muted
            onLoadedMetadata={() => videoRef.current?.play()}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {selfiePreview && !cameraActive && (
          <img src={selfiePreview} alt="Selfie preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        {selfiePreview && !cameraActive && !submitted && (
          <button onClick={retake} style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, backdropFilter: "blur(4px)" }}>
            <RefreshCw size={12} /> Retake
          </button>
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

      {/* Quality checks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {([
          { key: "faceVisible",  label: "Face clearly visible" },
          { key: "goodLighting", label: "Good lighting" },
          { key: "noGlassesHat", label: "No glasses/hat" },
        ] as { key: keyof QualityChecks; label: string }[]).map(({ key, label }) => {
          const s = checks[key];
          const color = s === "pass" ? "#22c55e" : s === "fail" ? "#ef4444" : "#475569";
          const bg = s === "pass" ? "rgba(34,197,94,0.08)" : s === "fail" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)";
          const border = s === "pass" ? "rgba(34,197,94,0.25)" : s === "fail" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)";
          return (
            <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center", fontSize: 11, color, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.3s" }}>
              {s === "pass" && <CheckCircle2 size={12} />}
              {s === "fail" && <XCircle size={12} />}
              {label}
            </div>
          );
        })}
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {checkAlerts.map((alert, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderLeft: "3px solid #ef4444", borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 12, color: "#fca5a5" }}>
            <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
            {alert}
          </motion.div>
        ))}
      </AnimatePresence>

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

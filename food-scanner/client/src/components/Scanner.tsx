import { useRef, useState } from "react";
import { analyze } from "../api";
import { AnalyzedItem } from "../types";

const MAX_DIM = 1568;

function compress(src: HTMLCanvasElement, type: string): Promise<string> {
  return new Promise((resolve) => {
    let { width, height } = src;
    if (width > MAX_DIM || height > MAX_DIM) {
      const scale = MAX_DIM / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    c.getContext("2d")!.drawImage(src, 0, 0, width, height);
    resolve(c.toDataURL(type, 0.85));
  });
}

function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!match) throw new Error("Invalid image data");
  return { mimeType: match[1], base64: match[2] };
}

export default function Scanner({
  onAnalyzed,
}: {
  onAnalyzed: (items: AnalyzedItem[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e: any) {
      setError("Camera unavailable: " + (e?.message || "permission denied"));
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    setPreview(await compress(canvas, "image/jpeg"));
  }

  async function submit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const { base64, mimeType } = dataUrlToBase64(preview);
      const res = await analyze(base64, mimeType);
      stopCamera();
      // The service still returns detected items when a nutrition lookup fails,
      // but the caller should know the numbers are partial.
      if (res.degraded) {
        setError("Some nutrition lookups failed; the results below are partial.");
      }
      onAnalyzed(res.items);
    } catch (e: any) {
      setError(e?.message || "Failed to analyze");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPreview(null);
    setError(null);
  }
  return (
    <section className="scanner">
      {!preview ? (
        <>
          <div className="video-wrap">
            <video ref={videoRef} autoPlay playsInline muted />
            {!stream && (
              <div className="video-placeholder">
                <p>Camera is off.</p>
                <button onClick={startCamera}>Start camera</button>
              </div>
            )}
          </div>
          <div className="actions">
            {stream ? (
              <button onClick={capture} disabled={busy}>
                📸 Capture
              </button>
            ) : null}
            <button onClick={() => fileRef.current?.click()} disabled={busy}>
              ⬆️ Upload photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onFile}
            />
          </div>
        </>
      ) : (
        <>
          <img className="preview" src={preview} alt="captured" />
          <div className="actions">
            <button onClick={submit} disabled={busy}>
              {busy ? "Analyzing…" : "🔍 Analyze food"}
            </button>
            <button onClick={reset} disabled={busy}>
              ↺ Retake
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

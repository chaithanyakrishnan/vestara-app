import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, uploadWithProgress } from "../lib/apiClient";

type Stage = "idle" | "uploading" | "extracting" | "error";

/**
 * The status lines shown while the server parses.
 *
 * Honest framing: the UPLOAD bar is real byte progress from XMLHttpRequest.
 * These extraction steps are NOT — `POST /documents/:id/extract` is a single
 * blocking call with no progress channel, so this is a timed sequence that
 * conveys what the server is doing, not where it has got to. The real outcome
 * is shown on the extraction review screen this navigates to.
 */
const PARSE_STEPS = [
  "Extracting text from the PDF",
  "Reading plan identity elections",
  "Identifying contribution types and safe harbor",
  "Mapping eligibility and vesting rules",
  "Reading administration elections",
  "Pre-filling wizard fields",
];

const MAX_BYTES = 20 * 1024 * 1024;

export function UploadPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [parseStep, setParseStep] = useState(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function chooseFile(next: File | null) {
    setErrorMsg(null);
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Only PDF files are accepted.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setErrorMsg("File must be under 20 MB.");
      return;
    }
    setFile(next);
  }

  function clearUpload() {
    setFile(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleParse() {
    if (!file || !planId) return;
    setErrorMsg(null);
    setUploadPct(0);
    setParseStep(-1);

    try {
      setStage("uploading");
      const form = new FormData();
      form.append("file", file);
      const doc = await uploadWithProgress<{ id: string }>(
        `/plans/${planId}/documents`,
        form,
        setUploadPct,
      );

      setStage("extracting");
      timers.current = PARSE_STEPS.map((_, i) => setTimeout(() => setParseStep(i), i * 850));

      await api.post(`/documents/${doc.id}/extract`, {});
      timers.current.forEach(clearTimeout);

      await queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      // Hand off to the review screen rather than dropping the user straight
      // into the wizard — they need to see what was actually read first.
      navigate(`/onboarding/${planId}/extraction/${doc.id}`);
    } catch (err) {
      timers.current.forEach(clearTimeout);
      setStage("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const busy = stage === "uploading" || stage === "extracting";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 60px" }}>
      <button
        type="button"
        className="btn-back"
        style={{ border: "none", padding: "0 0 24px", fontSize: 12, color: "var(--muted)" }}
        onClick={() => navigate(`/onboarding/${planId}/intake`)}
        disabled={busy}
      >
        ← Back to method selection
      </button>

      <div className="panel-eyebrow">DOCUMENT UPLOAD</div>
      <div className="panel-title">Upload your adoption agreement</div>
      <div className="panel-desc">
        Upload your existing adoption agreement. We'll read it and pre-fill all plan elections
        automatically — then show you exactly what was read before anything is used.
      </div>

      <div
        className={`drop-zone${dragOver ? " drag-over" : ""}${busy ? " disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          chooseFile(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.PDF"
          disabled={busy}
          onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
        />
        <div className="drop-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
          </svg>
        </div>
        <div className="drop-title">Drop your PDF here</div>
        <div className="drop-sub">
          or <strong>click to browse</strong> your files
        </div>
        <div className="drop-formats">
          <span className="drop-fmt">.PDF</span>
          <span className="drop-fmt">Max 20 MB</span>
          <span className="drop-fmt">Adoption Agreement</span>
        </div>
      </div>

      {file && (
        <div className="upload-file-info">
          <div className="ufi-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <div className="ufi-name">{file.name}</div>
            <div className="ufi-size">{(file.size / 1024).toFixed(0)} KB</div>
          </div>
          {!busy && (
            <button className="ufi-remove" onClick={clearUpload} aria-label="Remove file">
              ×
            </button>
          )}
        </div>
      )}

      <div className="inline-alert info" style={{ marginTop: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        Your document is stored server-side against this plan record only, and every AI-extracted field
        gets a confidence score and a provenance entry you can audit before signing.
      </div>

      {/* Real upload progress — byte counts from XMLHttpRequest. */}
      {busy && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, color: "var(--cream2)", fontWeight: 600 }}>
            {stage === "uploading" ? `Uploading — ${Math.round(uploadPct * 100)}%` : "Upload complete"}
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(uploadPct * 100)}%` }} />
          </div>
        </div>
      )}

      {stage === "extracting" && (
        <div className="parsing-steps">
          {PARSE_STEPS.map((label, i) => (
            <div key={label} className={`pstep${i < parseStep ? " done" : i === parseStep ? " active" : ""}`}>
              <span className="pstep-dot" />
              {label}
            </div>
          ))}
        </div>
      )}

      {errorMsg && <div className="inline-alert error" style={{ marginTop: 16 }}>{errorMsg}</div>}

      <div className="panel-actions">
        <button className="btn-back" onClick={() => navigate(`/onboarding/${planId}/intake`)} disabled={busy}>
          Back
        </button>
        <button className="btn-primary" disabled={!file || busy} onClick={handleParse}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {stage === "uploading" ? "Uploading…" : stage === "extracting" ? "Reading…" : "Read and Pre-fill"}
        </button>
      </div>
    </div>
  );
}

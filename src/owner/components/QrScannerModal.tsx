import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard, RefreshCw, X, Zap, ZapOff } from "lucide-react";
import type { Member } from "../../types";

export type ScanResult = {
  kind: "success" | "warning" | "error" | "info";
  title: string;
  text: string;
  member?: Member;
  canOverride?: boolean; // blocked entry that the desk may still allow
};

type Props = {
  branchName: string;
  onScan: (code: string, opts: { checkout: boolean }) => Promise<ScanResult>;
  onOverride: (member: Member) => void;
  onClose: () => void;
};

type HistoryItem = { id: number; at: string; kind: ScanResult["kind"]; title: string };

const COOLDOWN_MS = 4000; // the same QR is ignored for this long after a scan
const SHOW_MS: Record<ScanResult["kind"], number> = {
  success: 2200,
  info: 2200,
  warning: 3200,
  error: 3200,
};

const RESULT_BG: Record<ScanResult["kind"], string> = {
  success: "bg-emerald-600",
  warning: "bg-amber-600",
  error: "bg-red-600",
  info: "bg-sky-600",
};

const DOT: Record<ScanResult["kind"], string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  info: "bg-sky-500",
};

// Small beep so the desk knows the result without looking at the screen
let audioCtx: AudioContext | null = null;
const beep = (kind: ScanResult["kind"]) => {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx ??= new Ctx();
    const ctx = audioCtx;
    const tone = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ctx.destination);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur);
    };
    if (kind === "success" || kind === "info") tone(1040, 0, 0.12);
    else if (kind === "warning") {
      tone(740, 0, 0.12);
      tone(740, 0.17, 0.12);
    } else {
      tone(220, 0, 0.18);
      tone(170, 0.23, 0.25);
    }
  } catch {
    /* sound is optional */
  }
};

const cameraError = (err: unknown) => {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was denied. Allow camera access in the browser address bar, then press Try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The camera is being used by another app. Close it and press Try again.";
  }
  return "Could not start the camera. Please try again.";
};

export default function QrScannerModal({ branchName, onScan, onOverride, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onScanRef = useRef(onScan);
  const lockRef = useRef(false);
  const lastRef = useRef({ code: "", at: 0 });
  const timerRef = useRef(0);
  const idRef = useRef(0);
  const checkoutRef = useRef(true);
  const soundRef = useRef(true);

  const [phase, setPhase] = useState<"starting" | "live" | "error">("starting");
  const [errorText, setErrorText] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [checkout, setCheckout] = useState(true);
  const [sound, setSound] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [count, setCount] = useState(0);
  const [manual, setManual] = useState("");
  const [retry, setRetry] = useState(0);

  // Always call the latest version of the parent's function
  useEffect(() => {
    onScanRef.current = onScan;
  });
  useEffect(() => {
    checkoutRef.current = checkout;
  }, [checkout]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const dismiss = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setResult(null);
    lockRef.current = false;
  }, []);

  // One scan (from the camera or typed by hand)
  const handle = useCallback(async (raw: string) => {
    if (lockRef.current) return;
    const code = raw.trim();
    if (!code) return;

    const now = Date.now();
    if (lastRef.current.code === code && now - lastRef.current.at < COOLDOWN_MS) return;

    lockRef.current = true;
    lastRef.current = { code, at: now };

    let res: ScanResult;
    try {
      res = await onScanRef.current(code, { checkout: checkoutRef.current });
    } catch {
      res = {
        kind: "error",
        title: "Something went wrong",
        text: "Could not save. Please check your connection and try again.",
      };
    }

    if (soundRef.current) beep(res.kind);
    navigator.vibrate?.(res.kind === "error" ? [80, 60, 80] : 60);

    lastRef.current.at = Date.now();
    setResult(res);
    setCount((n) => n + 1);
    setHistory((h) =>
      [
        {
          id: ++idRef.current,
          at: new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
          kind: res.kind,
          title: res.title,
        },
        ...h,
      ].slice(0, 6)
    );

    // A blocked entry stays on screen until the desk decides what to do
    if (!res.canOverride) {
      timerRef.current = window.setTimeout(() => {
        setResult(null);
        lockRef.current = false;
      }, SHOW_MS[res.kind]);
    }
  }, []);

  // Camera
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let last = 0;

    const stop = () => {
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const start = async () => {
      setPhase("starting");
      setTorchOn(false);
      setTorchOk(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorText(
          "The camera needs a secure connection. Open this app on https (or localhost)."
        );
        setPhase("error");
        return;
      }

      try {
        const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, ...size }
            : { facingMode: { ideal: "environment" }, ...size },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean;
        };
        setTorchOk(!!caps.torch);

        // Camera names are only available after permission is given
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(all.filter((d) => d.kind === "videoinput"));

        setPhase("live");

        const tick = (t: number) => {
          raf = requestAnimationFrame(tick);
          if (t - last < 110) return; // about 9 reads per second is plenty
          last = t;

          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (!v || !canvas || lockRef.current || v.readyState < 2 || !v.videoWidth) return;

          const scale = Math.min(1, 640 / v.videoWidth);
          const w = Math.round(v.videoWidth * scale);
          const h = Math.round(v.videoHeight * scale);
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const hit = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (hit?.data) void handle(hit.data);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        setErrorText(cameraError(err));
        setPhase("error");
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [deviceId, retry, handle]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      setTorchOk(false);
    }
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const current = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const idx = devices.findIndex((d) => d.deviceId === current);
    setDeviceId(devices[(idx + 1) % devices.length].deviceId);
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    const code = manual.trim();
    if (!code) return;
    setManual("");
    void handle(code);
  };

  const corners = [
    "left-0 top-0 rounded-tl-2xl border-l-4 border-t-4",
    "right-0 top-0 rounded-tr-2xl border-r-4 border-t-4",
    "bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4",
    "bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4",
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="card relative my-8 w-full max-w-4xl !bg-white p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Check-in Desk</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">QR Scanner</h2>
        <p className="mt-1 text-sm text-muted">
          Checking in at <b className="text-charcoal">{branchName}</b>. Hold the member's QR card
          in front of the camera.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Camera */}
          <div className="lg:col-span-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {phase === "starting" && (
                <div className="absolute inset-0 grid place-items-center bg-black/70 text-center text-white">
                  <div>
                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-gold-light" />
                    <p className="mt-3 text-sm text-white/80">Starting the camera...</p>
                    <p className="mt-1 text-xs text-white/50">
                      Allow camera access if your browser asks.
                    </p>
                  </div>
                </div>
              )}

              {phase === "error" && (
                <div className="absolute inset-0 grid place-items-center bg-[#17151f] p-6 text-center text-white">
                  <div className="max-w-sm">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/5">
                      <CameraOff size={24} />
                    </div>
                    <p className="mt-4 text-sm text-white/80">{errorText}</p>
                    <button
                      type="button"
                      onClick={() => setRetry((n) => n + 1)}
                      className="btn-gold mt-5 px-5 py-2.5 text-sm"
                    >
                      Try again
                    </button>
                    <p className="mt-3 text-xs text-white/50">
                      You can still type the member code on the right.
                    </p>
                  </div>
                </div>
              )}

              {phase === "live" && (
                <>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="relative aspect-square w-[62%]">
                      {corners.map((c) => (
                        <span
                          key={c}
                          className={`absolute h-8 w-8 border-gold-light ${c}`}
                        />
                      ))}
                      <span className="qr-scanline absolute left-2 right-2 h-0.5 bg-gold-light/80 shadow-[0_0_12px_rgba(236,212,134,0.9)]" />
                    </div>
                  </div>

                  <div className="absolute right-3 top-3 flex gap-2">
                    {torchOk && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        title={torchOn ? "Turn the flash off" : "Turn the flash on"}
                        className="grid h-10 w-10 place-items-center rounded-xl bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                      >
                        {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                      </button>
                    )}
                    {devices.length > 1 && (
                      <button
                        type="button"
                        onClick={switchCamera}
                        title="Switch camera"
                        className="grid h-10 w-10 place-items-center rounded-xl bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                      >
                        <RefreshCw size={18} />
                      </button>
                    )}
                  </div>
                </>
              )}

              {result && (
                <div
                  className={`absolute inset-x-3 bottom-3 rounded-2xl p-4 text-white shadow-2xl ${
                    RESULT_BG[result.kind]
                  }`}
                >
                  <p className="font-display text-xl font-semibold">{result.title}</p>
                  <p className="mt-0.5 text-sm text-white/90">{result.text}</p>

                  {result.canOverride && result.member && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOverride(result.member as Member)}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-charcoal transition hover:bg-white/90"
                      >
                        Allow entry anyway...
                      </button>
                      <button
                        type="button"
                        onClick={dismiss}
                        className="rounded-lg border border-white/50 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                      >
                        Scan next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Camera size={14} className="shrink-0" />
              Keep the QR about 15 to 30 cm from the camera, with good light on the card.
            </p>
          </div>

          {/* Side panel */}
          <div className="space-y-5 lg:col-span-2">
            <div className="rounded-xl bg-black/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Scanned this session</p>
              <p className="font-display text-3xl font-semibold">{count}</p>
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checkout}
                  onChange={(e) => setCheckout(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#c9a227]"
                />
                <span className="text-sm">
                  Scanning a member who is already inside checks them <b>out</b>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => setSound(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[#c9a227]"
                />
                <span className="text-sm">Play a sound after each scan</span>
              </label>
            </div>

            <form onSubmit={submitManual}>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted">
                <Keyboard size={13} /> Type a member code
              </label>
              <div className="flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="e.g. M-0001"
                  className="input-lux !pl-4 text-sm"
                />
                <button type="submit" className="btn-gold shrink-0 px-4 text-sm">
                  Go
                </button>
              </div>
            </form>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                Recent scans
              </p>
              {history.length === 0 ? (
                <p className="text-sm text-muted">Nothing scanned yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center gap-2.5 rounded-lg border border-line bg-white/60 px-3 py-2 text-sm"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[h.kind]}`} />
                      <span className="min-w-0 flex-1 truncate">{h.title}</span>
                      <span className="shrink-0 text-xs text-muted">{h.at}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
          >
            Close scanner
          </button>
        </div>
      </div>

      <style>{`
        @keyframes qr-scan { 0% { top: 6%; } 50% { top: 94%; } 100% { top: 6%; } }
        .qr-scanline { animation: qr-scan 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
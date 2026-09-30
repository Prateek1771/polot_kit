"use client";

import { CircleNotch, Microphone, Stop } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { postAudio } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_SECONDS = 120;
// Chrome/Firefox record opus in webm/ogg, Safari records mp4; the API accepts all three
const MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

type State = "idle" | "recording" | "transcribing";

/** Push-to-talk: tap to record, tap again to stop. The transcript goes to onText, which sends it like a typed message. */
export function VoiceButton({ onText, disabled, conversationId }: {
  onText: (text: string) => void; disabled?: boolean; conversationId?: string | null;
}) {
  const [state, setState] = useState<State>("idle");
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  // latest callback: recording can outlive the render that started it
  const onTextRef = useRef(onText);
  const convRef = useRef(conversationId);
  useEffect(() => { onTextRef.current = onText; convRef.current = conversationId; }, [onText, conversationId]);

  // release the mic if the chat unmounts mid-recording
  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice isn't supported in this browser");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone blocked", { description: "Allow microphone access for this site, then try again." });
      return;
    }
    const mimeType = MIME.find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (tick.current) clearInterval(tick.current);
      const blob = new Blob(chunks, { type: r.mimeType || mimeType || "audio/webm" });
      if (blob.size < 1000) { setState("idle"); return; } // a tap, not speech
      setState("transcribing");
      try {
        const text = (await postAudio(blob, convRef.current)).trim();
        if (text) onTextRef.current(text);
        else toast("Didn't catch that", { description: "Try again a little closer to the mic." });
      } catch (e) {
        toast.error("Couldn't transcribe that", { description: String(e).slice(0, 180) });
      } finally {
        setState("idle");
      }
    };
    rec.current = r;
    r.start();
    setSecs(0);
    setState("recording");
    tick.current = setInterval(() => setSecs((s) => s + 1), 1000);
  }

  // hard stop at MAX_SECONDS (keeps uploads well under the API's size cap)
  useEffect(() => {
    if (secs >= MAX_SECONDS && rec.current?.state === "recording") rec.current.stop();
  }, [secs]);

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  const recording = state === "recording";
  return (
    <div className="flex items-center gap-1.5">
      {recording && (
        <span className="flex items-center gap-1.5 pl-1 text-xs tabular-nums text-destructive" aria-live="polite">
          <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
        </span>
      )}
      <button type="button" onClick={recording ? stop : start} disabled={disabled || state === "transcribing"}
        aria-label={recording ? "Stop recording and send" : state === "transcribing" ? "Transcribing" : "Speak your message"}
        aria-pressed={recording}
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full transition-[transform,background-color,color] duration-500 ease-spring active:scale-95 disabled:opacity-50",
          recording ? "bg-destructive/12 text-destructive ring-1 ring-destructive/30"
            : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
        )}>
        {state === "transcribing" ? <CircleNotch className="size-[18px] animate-spin" aria-hidden />
          : recording ? <Stop className="size-[18px]" weight="fill" aria-hidden />
          : <Microphone className="size-[18px]" aria-hidden />}
      </button>
    </div>
  );
}

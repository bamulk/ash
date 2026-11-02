"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import type { DictationResult } from "@/lib/types";

// Browser types for the WebKit SpeechRecognition API. Safari exposes
// webkitSpeechRecognition only; Chrome exposes both. The shape we use
// is tiny so the ambient types aren't worth pulling in.
type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: {
    results: { 0: { transcript: string }; isFinal: boolean }[] | ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
    resultIndex: number;
  }) => void;
  onend: () => void;
  onerror: (e: { error?: string }) => void;
  start: () => void;
  stop: () => void;
};
type SpeechRecCtor = new () => SpeechRec;

export default function DictationComposer({
  action,
}: {
  action: (
    prev: DictationResult | null,
    formData: FormData
  ) => Promise<DictationResult>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, null);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const liveRef = useRef<string>("");

  useEffect(() => {
    // One-time browser-capability sniff. The lint rule is right that
    // setState-in-effect is usually smell, but a mount-once window
    // check is the canonical shape for this specific case.
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!Ctor);
  }, []);

  // After a successful save, navigate to the new contact. Can't redirect
  // from the server action because useActionState swallows thrown
  // redirects; this effect is the client-side equivalent.
  useEffect(() => {
    if (state?.ok) {
      router.push(`/contacts/${state.contactId}`);
    }
  }, [state, router]);

  function startListening() {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    liveRef.current = transcript;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let interim = "";
      let finalText = "";
      // results is array-like; iterate from resultIndex forward.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = e.results as any;
      for (let i = e.resultIndex; i < results.length; i++) {
        const r = results[i];
        const text = r[0].transcript;
        if (r.isFinal) finalText += text;
        else interim += text;
      }
      if (finalText) {
        liveRef.current = (liveRef.current + " " + finalText).trim();
      }
      const combined = (liveRef.current + " " + interim).trim();
      setTranscript(combined);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  const canSubmit = transcript.trim().length > 0 && !pending && !listening;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="transcript" value={transcript} />

      {/* The mic surface — big enough to tap by feel while walking. */}
      <div className="flex flex-col items-center gap-3 py-6">
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          disabled={supported === false}
          className={`relative w-24 h-24 flex items-center justify-center border transition-colors ${
            listening
              ? "bg-brand text-brand-ink border-brand"
              : "bg-foreground text-background border-foreground hover:bg-brand hover:border-brand"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label={listening ? "Stop recording" : "Start recording"}
        >
          {listening ? <MicOff size={32} /> : <Mic size={32} />}
          {listening && (
            <span
              aria-hidden
              className="absolute inset-0 border border-brand animate-ping"
            />
          )}
        </button>
        <div className="text-sm text-muted h-5">
          {listening
            ? "Listening — tap to stop"
            : supported === false
              ? "This browser doesn't support speech. Tap the box and use your keyboard's mic."
              : supported === null
                ? ""
                : "Tap the mic and say the client's details"}
        </div>
      </div>

      <Textarea
        rows={6}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="e.g. Add buyer John Smith at 916-335-4203, john@foo.com, looking in East Sac up to $900,000. Preapproved through Guild Mortgage."
      />

      {state && !state.ok && (
        <div className="flex items-start gap-2 text-sm text-brand">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      {state?.ok && (
        <div className="flex items-start gap-2 text-sm text-accent">
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
          <span>Saved {state.display_name}. Opening…</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-soft max-w-xs">
          Name, phone, email, address, role, budget, neighborhoods, notes — anything
          you say gets parsed. The full transcript is saved under notes.
        </p>
        <Button type="submit" disabled={!canSubmit}>
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Parsing
            </>
          ) : (
            "Save contact"
          )}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Mic, Square, Upload, Volume2, VolumeX } from "lucide-react";

type VoiceMessage = {
  role: "user" | "assistant";
  content: string;
  confidence?: string;
};

type TalkBackVoice = "system" | "sarvam";
type VoiceLanguage = "auto" | "en-IN" | "te-IN";
type TranscriptionProvider = "auto" | "openai" | "sarvam";

export function VoiceRecorder() {
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const draftMediaStream = useRef<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const answerAudio = useRef<HTMLAudioElement | null>(null);
  const answerAudioUrl = useRef<string | null>(null);
  const draftAudioUrl = useRef<string | null>(null);
  const speechUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const talkBackEnabled = useRef(false);
  const askInFlight = useRef(false);
  const chatHistory = useRef<VoiceMessage[]>([]);
  const partialTranscript = useRef("");
  const turnStartedAt = useRef<number | null>(null);
  const [listening, setListening] = useState(false);
  const [recordingDraft, setRecordingDraft] = useState(false);
  const [draftAudio, setDraftAudio] = useState<Blob | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>("auto");
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>("auto");
  const [talkBack, setTalkBack] = useState(false);
  const [talkBackVoice, setTalkBackVoice] = useState<TalkBackVoice>("system");
  const [speaking, setSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [typedNote, setTypedNote] = useState("");
  const [status, setStatus] = useState("Record one voice note, then create a draft. Stock will not change until you confirm.");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    talkBackEnabled.current = talkBack;
  }, [talkBack]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopDraftRecording();
      if (draftAudioUrl.current) URL.revokeObjectURL(draftAudioUrl.current);
    };
  }, []);

  function preferredAudioMimeType() {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  async function startDraftRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setError("Voice recording is not available in this browser. Type a short note instead.");
      return;
    }

    if (listening) stopRealtime();
    if (draftAudioUrl.current) URL.revokeObjectURL(draftAudioUrl.current);
    draftAudioUrl.current = null;
    setDraftAudio(null);
    audioChunks.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      draftMediaStream.current = stream;
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunks.current, { type });
        setDraftAudio(blob);
        draftAudioUrl.current = URL.createObjectURL(blob);
        draftMediaStream.current?.getTracks().forEach((track) => track.stop());
        draftMediaStream.current = null;
        mediaRecorder.current = null;
        setRecordingDraft(false);
        setStatus("Voice note captured. Create draft to transcribe and structure it, or record again.");
      };

      recorder.start();
      setRecordingDraft(true);
      setStatus("Recording voice note. Speak one truck, sale, or expense. Use Telugu or English, then stop.");
    } catch (error) {
      setRecordingDraft(false);
      setError(error instanceof Error ? error.message : "Could not start voice recording.");
      setStatus("Voice recording was not started.");
    }
  }

  function stopDraftRecording() {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
      return;
    }

    draftMediaStream.current?.getTracks().forEach((track) => track.stop());
    draftMediaStream.current = null;
    mediaRecorder.current = null;
    setRecordingDraft(false);
  }

  async function startRealtime() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice is not available in this browser. Type a short note instead.");
      return;
    }

    try {
      setStatus("Starting OpenAI realtime voice...");
      const [sessionResponse, stream] = await Promise.all([
        fetch("/api/voice/realtime/session", { method: "POST" }),
        navigator.mediaDevices.getUserMedia({ audio: true })
      ]);
      const session = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(session.error ?? "Realtime voice session failed.");

      const pc = new RTCPeerConnection();
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus(talkBackEnabled.current
            ? "Connected. Ask a question, then pause so I can answer."
            : "Connected. Speak one truck, sale, or expense, then pause."
          );
        }
        if (["failed", "disconnected"].includes(pc.connectionState)) {
          setStatus("Live voice connection dropped. Stop and start live again.");
        }
      };
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const channel = pc.createDataChannel("oai-events");
      channel.onopen = () => {
        setStatus(talkBackEnabled.current
          ? "Listening live. Ask a question, then pause so I can answer aloud."
          : "Listening live. Speak one truck, sale, or expense, then pause."
        );
      };
      channel.onerror = () => setError("Realtime event channel failed. Stop and start live again.");
      channel.onmessage = (event) => handleRealtimeEvent(event.data);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.client_secret}`,
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });

      if (!sdpResponse.ok) {
        const message = await sdpResponse.text().catch(() => sdpResponse.statusText);
        throw new Error(`Realtime connection failed: ${sdpResponse.status} ${message || sdpResponse.statusText}`);
      }
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpResponse.text() });

      peerConnection.current = pc;
      mediaStream.current = stream;
      dataChannel.current = channel;
      setListening(true);
    } catch (error) {
      stopRealtime();
      setError(error instanceof Error ? error.message : "Realtime voice failed.");
      setStatus("Realtime voice was not started.");
    }
  }

  function stopRealtime() {
    dataChannel.current?.close();
    peerConnection.current?.close();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    dataChannel.current = null;
    peerConnection.current = null;
    mediaStream.current = null;
    partialTranscript.current = "";
    setListening(false);
    setStatus("Stopped. Review the transcript, then create a draft.");
  }

  function handleRealtimeEvent(raw: string) {
    try {
      const event = JSON.parse(raw);
      if (event.type === "conversation.item.input_audio_transcription.delta" && typeof event.delta === "string") {
        partialTranscript.current += event.delta;
        setStatus(`Hearing: ${partialTranscript.current.slice(-120)}`);
      }
      if (event.type === "conversation.item.input_audio_transcription.completed" && typeof event.transcript === "string") {
        const transcript = event.transcript.trim();
        if (!transcript) return;
        partialTranscript.current = "";
        setLiveTranscript((current) => [current, transcript].filter(Boolean).join("\n"));
        if (talkBackEnabled.current) {
          void askFromTranscript(transcript);
        } else {
          setStatus("Transcript updated. Continue speaking or stop and create draft.");
        }
      }
      if (event.type === "input_audio_buffer.committed") setStatus("Audio turn captured. Transcribing...");
      if (event.type === "input_audio_buffer.speech_started") {
        turnStartedAt.current = performance.now();
        setStatus("Listening... speak clearly.");
      }
      if (event.type === "input_audio_buffer.speech_stopped") setStatus("Processing spoken words...");
      if (event.type === "error") setError(event.error?.message ?? "Realtime voice error.");
    } catch {
      // Ignore non-JSON protocol messages.
    }
  }

  async function askFromTranscript(transcript: string) {
    if (askInFlight.current) {
      setStatus("I am answering the previous question. Wait one second, then ask again.");
      return;
    }

    askInFlight.current = true;
    setError(null);
    setStatus("Checking mill data...");
    appendMessage({ role: "user", content: transcript });

    try {
      const history = chatHistory.current.slice(-8).map((message) => ({
        role: message.role,
        content: message.content
      }));
      const askStartedAt = performance.now();
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: transcript, history })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Assistant could not answer.");

      const message = {
        role: "assistant" as const,
        content: String(json.answer ?? "I could not answer from current data."),
        confidence: String(json.confidence ?? "low")
      };
      appendMessage(message);
      const speechStartedAt = performance.now();
      await speakAnswer(message.content);
      const totalMs = turnStartedAt.current ? performance.now() - turnStartedAt.current : null;
      const askMs = performance.now() - askStartedAt;
      const speechMs = performance.now() - speechStartedAt;
      setStatus(
        `Answered in ${formatLatency(askMs)}. ${voiceLabel(talkBackVoice)} audio started in ${formatLatency(speechMs)}${totalMs ? `, ${formatLatency(totalMs)} from speech start` : ""}.`
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Assistant could not answer.");
      setStatus("Spoken answer failed.");
    } finally {
      askInFlight.current = false;
    }
  }

  function appendMessage(message: VoiceMessage) {
    chatHistory.current = [...chatHistory.current, message].slice(-12);
    setMessages(chatHistory.current);
  }

  function formatLatency(ms: number) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  async function speakAnswer(text: string) {
    if (talkBackVoice === "sarvam") {
      await speakCloud(text, "sarvam");
      return;
    }

    speakNow(text);
  }

  async function speakCloud(text: string, provider: "sarvam") {
    stopSpeaking();
    setSpeaking(true);

    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, text })
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? `${voiceLabel(provider)} voice failed.`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      answerAudio.current = audio;
      answerAudioUrl.current = audioUrl;
      audio.onended = () => {
        setSpeaking(false);
        cleanupAudio();
      };
      audio.onerror = () => {
        setSpeaking(false);
        cleanupAudio();
        speakNow(text);
      };
      await audio.play();
    } catch (error) {
      setError(error instanceof Error ? `${error.message} Falling back to system voice.` : "Cloud voice failed. Falling back to system voice.");
      speakNow(text);
    }
  }

  function voiceLabel(provider: TalkBackVoice) {
    return provider === "sarvam" ? "Sarvam" : "System";
  }

  function speakNow(text: string) {
    stopSpeaking();
    setSpeaking(true);

    if (!("speechSynthesis" in window)) {
      setSpeaking(false);
      setError("This browser cannot play system voice. The text answer is shown below.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    speechUtterance.current = utterance;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      if (speechUtterance.current === utterance) {
        speechUtterance.current = null;
        setSpeaking(false);
      }
    };
    utterance.onerror = () => {
      if (speechUtterance.current === utterance) {
        speechUtterance.current = null;
        setSpeaking(false);
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    answerAudio.current?.pause();
    cleanupAudio();
    window.speechSynthesis?.cancel();
    speechUtterance.current = null;
    setSpeaking(false);
  }

  function cleanupAudio() {
    answerAudio.current = null;
    if (answerAudioUrl.current) URL.revokeObjectURL(answerAudioUrl.current);
    answerAudioUrl.current = null;
  }

  async function submitVoice() {
    setError(null);
    const transcript = [liveTranscript.trim(), typedNote.trim()].filter(Boolean).join("\n");
    if (!transcript && !draftAudio) {
      setError("Record a voice note, speak live, or type a short note first.");
      return;
    }

    if (listening) stopRealtime();
    if (recordingDraft) stopDraftRecording();
    setSubmitting(true);
    setStatus(draftAudio ? "Transcribing audio and creating voice draft. Stock will not change until you confirm." : "Creating voice draft. Stock will not change until you confirm.");
    try {
      const formData = new FormData();
      formData.append("text", transcript);
      formData.append("language", voiceLanguage);
      formData.append("transcription_provider", transcriptionProvider);
      if (draftAudio) {
        const extension = draftAudio.type.includes("mp4") ? "mp4" : "webm";
        formData.append("audio", draftAudio, `voice-note.${extension}`);
      }

      const response = await fetch("/api/voice/draft", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Voice entry failed.");
      window.location.href = json.review_url ?? json.confirm_url;
    } catch (error) {
      setSubmitting(false);
      setStatus("Voice draft was not saved.");
      setError(error instanceof Error ? error.message : "Voice entry failed.");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <p className="text-sm font-bold text-leaf">Speak</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Voice note to draft</h2>
        <p className="mt-2 text-sm text-ink/65">
          Record one entry to create a draft, or turn on Talk with assistant and ask about current mill data.
        </p>
        <p className="mt-2 text-xs text-ink/55">For Telugu drafts, use the voice note recorder. Live assistant is best for quick English questions.</p>

        <div className="mt-4 grid gap-3 rounded-md border border-ink/10 bg-field p-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase text-ink/55">Input language</span>
            <select
              value={voiceLanguage}
              onChange={(event) => setVoiceLanguage(event.target.value as VoiceLanguage)}
              className="mt-1 h-11 w-full rounded-md border border-ink/10 bg-white px-3 text-sm font-bold"
            >
              <option value="auto">Auto / code-mix</option>
              <option value="te-IN">Telugu</option>
              <option value="en-IN">English India</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-ink/55">Transcription</span>
            <select
              value={transcriptionProvider}
              onChange={(event) => setTranscriptionProvider(event.target.value as TranscriptionProvider)}
              className="mt-1 h-11 w-full rounded-md border border-ink/10 bg-white px-3 text-sm font-bold"
            >
              <option value="auto">Auto provider</option>
              <option value="sarvam">Sarvam STT</option>
              <option value="openai">OpenAI STT</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={recordingDraft ? stopDraftRecording : startDraftRecording}
            disabled={submitting || listening}
            className="tap-target rounded-md bg-leaf px-4 py-3 text-base font-bold text-white disabled:opacity-60"
          >
            {recordingDraft ? <Square className="mr-2 inline h-5 w-5" /> : <Mic className="mr-2 inline h-5 w-5" />}
            {recordingDraft ? "Stop note" : "Record note"}
          </button>
          <button
            type="button"
            onClick={submitVoice}
            disabled={submitting || recordingDraft || (!draftAudio && !liveTranscript.trim() && !typedNote.trim())}
            className="tap-target rounded-md bg-ink px-4 py-3 text-base font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            <Upload className="mr-2 inline h-5 w-5" />
            {submitting ? "Creating draft..." : "Create draft"}
          </button>
        </div>

        {draftAudio && draftAudioUrl.current ? (
          <div className="mt-3 rounded-md border border-ink/10 bg-white p-3">
            <p className="mb-2 text-xs font-bold uppercase text-ink/55">Captured voice note</p>
            <audio controls src={draftAudioUrl.current} className="w-full" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            const next = !talkBack;
            setTalkBack(next);
            talkBackEnabled.current = next;
            setStatus(next
              ? "Talk with assistant is on. Speak a question and I will answer aloud."
              : "Talk with assistant is off. Transcript can be used to create a draft."
            );
          }}
          className={`mt-4 flex w-full items-center justify-center rounded-md border px-4 py-3 text-base font-bold ${
            talkBack
              ? "border-leaf bg-leaf/10 text-leaf"
              : "border-ink/10 bg-field text-ink"
          }`}
        >
          {talkBack ? <Volume2 className="mr-2 h-5 w-5" /> : <Bot className="mr-2 h-5 w-5" />}
          {talkBack ? "Talk with assistant: on" : "Talk with assistant: off"}
        </button>

        {talkBack ? (
          <div className="mt-3 grid grid-cols-2 rounded-md border border-ink/10 bg-field p-1">
            {(["system", "sarvam"] as TalkBackVoice[]).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => setTalkBackVoice(provider)}
                className={`rounded px-3 py-2 text-sm font-bold ${
                  talkBackVoice === provider ? "bg-white text-ink shadow-soft" : "text-ink/60"
                }`}
              >
                {voiceLabel(provider)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={listening ? stopRealtime : startRealtime}
            disabled={submitting || recordingDraft}
            className="tap-target rounded-md border border-ink/10 bg-white px-4 py-3 text-base font-bold text-ink disabled:opacity-60"
          >
            {listening ? <Square className="mr-2 inline h-5 w-5" /> : <Mic className="mr-2 inline h-5 w-5" />}
            {listening ? "Stop live" : "Start live"}
          </button>
          <div className="rounded-md border border-ink/10 bg-field px-3 py-2 text-xs font-semibold leading-5 text-ink/60">
            Live mode uses browser realtime transcript. Recorded notes use backend transcription.
          </div>
        </div>

        {speaking ? (
          <button
            type="button"
            onClick={stopSpeaking}
            className="mt-3 flex w-full items-center justify-center rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-bold"
          >
            <VolumeX className="mr-2 h-4 w-4" />
            Stop speaking
          </button>
        ) : null}

        <p className="mt-3 rounded-md bg-field p-3 text-sm text-ink/70">{status}</p>
        {error ? <p className="mt-3 rounded-md bg-rust/10 p-3 text-sm font-semibold text-rust">{error}</p> : null}
      </section>

      {messages.length > 0 ? (
        <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <h2 className="text-sm font-bold">Voice conversation</h2>
          <div className="mt-3 space-y-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "assistant" ? "rounded-md bg-leaf/10 p-3" : "rounded-md bg-field p-3"}>
                <p className="text-xs font-bold uppercase text-ink/55">
                  {message.role}{message.confidence ? ` | ${message.confidence}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-ink">{message.content}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <label className="block">
          <span className="text-sm font-bold">Live transcript</span>
          <textarea
            value={liveTranscript}
            onChange={(event) => setLiveTranscript(event.target.value)}
            rows={5}
            className="mt-2 w-full rounded-md border border-ink/15 bg-field px-3 py-2 text-base"
            placeholder="Realtime transcript appears here. You can edit before creating draft."
          />
        </label>
        <button
          type="button"
          onClick={() => setLiveTranscript("")}
          disabled={submitting || !liveTranscript}
          className="mt-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Clear transcript
        </button>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <label className="block">
          <span className="text-sm font-bold">Type fallback / extra words</span>
          <textarea
            value={typedNote}
            onChange={(event) => setTypedNote(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-md border border-ink/15 bg-field px-3 py-2 text-base"
            placeholder="Example: Government paddy from Mallapur, 460 bags, truck number unknown, moisture not checked."
          />
        </label>
        <p className="mt-2 text-xs text-ink/55">This creates an AI draft only. You still confirm before ledger or stock changes.</p>
      </section>
    </div>
  );
}

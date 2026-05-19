// Player custom no padrão COSLU LABZ (substitui os controls nativos).
// Play/pause · ±10s · scrubber · tempo · velocidade 0.5×–2× · mute.
// Dirige o elemento <audio>/<video> via ref; sem lib.

import { useEffect, useRef, useState, type RefObject } from "react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function mmss(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function MediaControls({
  el,
}: {
  el: RefObject<HTMLMediaElement | null>;
}) {
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const seeking = useRef(false);

  useEffect(() => {
    const m = el.current;
    if (!m) return;
    const onTime = () => !seeking.current && setCur(m.currentTime);
    const onDur = () => setDur(m.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    m.addEventListener("timeupdate", onTime);
    m.addEventListener("loadedmetadata", onDur);
    m.addEventListener("durationchange", onDur);
    m.addEventListener("play", onPlay);
    m.addEventListener("pause", onPause);
    m.addEventListener("ended", onPause);
    onDur();
    return () => {
      m.removeEventListener("timeupdate", onTime);
      m.removeEventListener("loadedmetadata", onDur);
      m.removeEventListener("durationchange", onDur);
      m.removeEventListener("play", onPlay);
      m.removeEventListener("pause", onPause);
      m.removeEventListener("ended", onPause);
    };
  }, [el]);

  const m = () => el.current;
  const toggle = () => {
    const v = m();
    if (!v) return;
    v.paused ? void v.play() : v.pause();
  };
  const skip = (d: number) => {
    const v = m();
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d));
  };
  const seek = (t: number) => {
    const v = m();
    if (v) {
      v.currentTime = t;
      setCur(t);
    }
  };
  const setSpeed = (r: number) => {
    const v = m();
    if (v) v.playbackRate = r;
    setRate(r);
  };
  const toggleMute = () => {
    const v = m();
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div className="mc">
      <div className="mc-row">
        <button className="mc-btn" onClick={() => skip(-10)} title="-10s">
          «10
        </button>
        <button className="mc-btn mc-play" onClick={toggle}>
          {playing ? "❚❚" : "▶"}
        </button>
        <button className="mc-btn" onClick={() => skip(10)} title="+10s">
          10»
        </button>

        <span className="mc-time">{mmss(cur)}</span>
        <input
          className="mc-seek"
          type="range"
          min={0}
          max={dur || 0}
          step={0.01}
          value={Math.min(cur, dur || 0)}
          onMouseDown={() => (seeking.current = true)}
          onMouseUp={() => (seeking.current = false)}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span className="mc-time">{mmss(dur)}</span>

        <button className="mc-btn" onClick={toggleMute} title="mudo">
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="mc-row mc-speeds">
        <span className="mc-lbl">velocidade</span>
        {SPEEDS.map((sp) => (
          <button
            key={sp}
            className={`mc-chip${sp === rate ? " on" : ""}`}
            onClick={() => setSpeed(sp)}
          >
            {sp}×
          </button>
        ))}
      </div>
    </div>
  );
}

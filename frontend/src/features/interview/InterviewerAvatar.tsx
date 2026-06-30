import { Mic, Radio } from 'lucide-react';

import heroBackground from '../../assets/interview-hero.png';
import { InterviewerScene } from './avatar3d/InterviewerScene';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATE_LABEL: Record<AvatarState, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

interface InterviewerAvatarProps {
  name: string;
  state: AvatarState;
  /** 0-1 real-time speech amplitude, used to drive the mouth while speaking. */
  audioLevel?: number;
}

export const InterviewerAvatar = ({ name, state, audioLevel = 0 }: InterviewerAvatarProps) => {
  const isActive = state !== 'idle';

  return (
    <div
      className={`relative h-[380px] overflow-hidden rounded-md border transition-colors duration-300 ${
        isActive ? 'border-signal/50' : 'border-white/10'
      }`}
    >
      {/* Blurred office backdrop, like a real video-call background */}
      <img
        src={heroBackground}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-md"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/80 via-canvas/55 to-canvas/85" />

      {/* 3D character feed */}
      <div className="absolute inset-0">
        <InterviewerScene state={state} audioLevel={audioLevel} />
      </div>

      {/* Vignette to sell the "webcam feed" look */}
      <div
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_30px_rgba(0,0,0,0.65)]"
        aria-hidden="true"
      />

      {/* Live indicator */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-canvas/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-graphite backdrop-blur">
        <Radio size={11} className={isActive ? 'text-red-400' : 'text-graphite'} aria-hidden="true" />
        Live
      </div>

      {/* Name tag + status, modeled on a real video-call tile */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-canvas/70 px-3 py-1.5 backdrop-blur">
        <span
          className={`grid h-5 w-5 place-items-center rounded-full transition-colors ${
            state === 'speaking' ? 'bg-signal text-canvas' : 'bg-white/10 text-graphite'
          }`}
        >
          <Mic size={11} aria-hidden="true" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-semibold text-ink">{name}</p>
          <p
            className={`text-[10px] font-medium ${
              state === 'listening'
                ? 'text-signal'
                : state === 'thinking'
                  ? 'text-amberline'
                  : state === 'speaking'
                    ? 'text-signal'
                    : 'text-graphite'
            }`}
          >
            {STATE_LABEL[state]}
          </p>
        </div>
      </div>
    </div>
  );
};

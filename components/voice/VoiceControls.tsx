'use client';

import type { VoiceGuidanceControls } from './useVoiceGuidance';

export function VoiceControls({
  guidance,
}: {
  guidance: VoiceGuidanceControls;
}) {
  return (
    <section className="voice-guidance" aria-label="Voice guidance controls">
      <div className="voice-guidance-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={guidance.enabled ? guidance.disable : guidance.enable}
          aria-label={
            guidance.enabled ? 'Mute voice guidance' : 'Unmute voice guidance'
          }
          aria-pressed={!guidance.enabled}
        >
          {guidance.enabled ? 'Mute' : 'Unmute'}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={guidance.replay}
          disabled={!guidance.enabled || !guidance.currentInstruction}
        >
          Repeat
        </button>
        <button
          type="button"
          className="text-button"
          onClick={guidance.testVoice}
          disabled={!guidance.enabled}
        >
          Test voice
        </button>
      </div>
      <div className="voice-guidance-settings">
        <label className="voice-volume">
          Volume <span>{Math.round(guidance.volume * 100)}%</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={guidance.volume}
            onChange={(event) => guidance.setVolume(Number(event.target.value))}
          />
        </label>
      </div>
      {guidance.status && (
        <p role="status" className="muted">
          {guidance.status}
        </p>
      )}
      <p className="voice-guidance-note">
        On-screen guidance remains available.
      </p>
    </section>
  );
}

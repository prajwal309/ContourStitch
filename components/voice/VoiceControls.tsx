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
        >
          {guidance.enabled
            ? 'Disable voice guidance'
            : 'Enable voice guidance'}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={guidance.replay}
          disabled={!guidance.enabled || !guidance.currentInstruction}
        >
          Replay instruction
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
        Uses the first available English voice automatically. On-screen
        instructions remain available if speech cannot play.
      </p>
    </section>
  );
}

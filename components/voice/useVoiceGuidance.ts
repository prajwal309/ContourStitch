'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  offlineVoiceInstructions,
  VoiceGuidanceService,
} from '@/lib/voice/voice-guidance';

export type VoiceGuidanceControls = {
  enabled: boolean;
  volume: number;
  status: string;
  currentInstruction: string | undefined;
  setVolume: (volume: number) => void;
  enable: () => void;
  disable: () => void;
  replay: () => void;
  announce: (text: string) => void;
};

export function useVoiceGuidance(currentInstruction?: string) {
  const [volume, setVolume] = useState(0.9);
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState('');
  const [service] = useState(() => new VoiceGuidanceService());
  const settingsRef = useRef({ volume });
  const currentInstructionRef = useRef(currentInstruction);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    settingsRef.current = { volume };
    currentInstructionRef.current = currentInstruction;
    enabledRef.current = enabled;
  }, [volume, currentInstruction, enabled]);

  const play = useCallback(
    (text: string, repeat = false) => {
      const settings = settingsRef.current;
      service.speak(text, {
        volume: settings.volume,
        repeat,
        onStatus: setStatus,
      });
    },
    [service],
  );

  useEffect(() => {
    if (!enabled || !currentInstruction) {
      service.cancel();
      return;
    }
    play(currentInstruction);
    return () => service.cancel(true);
  }, [enabled, currentInstruction, play, service]);

  useEffect(
    () => () => {
      service.cancel(true);
    },
    [service],
  );

  const enable = useCallback(() => {
    enabledRef.current = true;
    setEnabled(true);
    setStatus('');
    play(
      currentInstructionRef.current ?? offlineVoiceInstructions.welcome.text,
      true,
    );
  }, [play]);

  const disable = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    service.cancel(true);
    setStatus('');
  }, [service]);

  const replay = useCallback(() => {
    if (!enabledRef.current || !currentInstructionRef.current) return;
    play(currentInstructionRef.current, true);
  }, [play]);

  const announce = useCallback(
    (text: string) => {
      if (enabledRef.current) play(text);
    },
    [play],
  );

  return {
    enabled,
    volume,
    status,
    currentInstruction,
    setVolume,
    enable,
    disable,
    replay,
    announce,
  } satisfies VoiceGuidanceControls;
}

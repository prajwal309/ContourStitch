'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  offlineVoiceInstructions,
  voiceGuidanceConfig,
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
  announce: (text: string, priority?: boolean) => void;
  announceAcquisition: (text: string) => void;
};

export function useVoiceGuidance(currentInstruction?: string) {
  const [volume, setVolume] = useState(0.9);
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState('');
  const [service] = useState(() => new VoiceGuidanceService());
  const settingsRef = useRef({ volume });
  const currentInstructionRef = useRef(currentInstruction);
  const enabledRef = useRef(enabled);
  const lastSpeechRef = useRef({
    text: '',
    timestamp: 0,
    priority: false,
  });
  const pendingInstructionRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);
  const routineSpeechTimesRef = useRef(new Map<string, number>());

  useEffect(() => {
    settingsRef.current = { volume };
    currentInstructionRef.current = currentInstruction;
    enabledRef.current = enabled;
  }, [volume, currentInstruction, enabled]);

  const clearPending = useCallback(() => {
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    pendingInstructionRef.current = null;
  }, []);

  const playNow = useCallback(
    (text: string, repeat = false, priority = false) => {
      clearPending();
      const instruction = text.trim();
      if (!instruction) return;
      lastSpeechRef.current = {
        text: instruction,
        timestamp: Date.now(),
        priority,
      };
      if (!priority) routineSpeechTimesRef.current.set(instruction, Date.now());
      service.speak(instruction, {
        volume: settingsRef.current.volume,
        repeat: repeat || priority,
        onStatus: setStatus,
      });
    },
    [clearPending, service],
  );

  const queueInstruction = useCallback(
    (text: string) => {
      if (!enabledRef.current || !text.trim()) return;
      clearPending();
      const last = lastSpeechRef.current;
      const instruction = text.trim();
      const now = Date.now();
      const previousSamePrompt = routineSpeechTimesRef.current.get(instruction);
      const repeatedPromptWait =
        previousSamePrompt === undefined
          ? 0
          : Math.max(
              0,
              voiceGuidanceConfig.instructionCooldownMs -
                (now - previousSamePrompt),
            );
      const priorityWait =
        last.text &&
        last.priority &&
        now - last.timestamp < voiceGuidanceConfig.instructionCooldownMs
          ? voiceGuidanceConfig.instructionCooldownMs - (now - last.timestamp)
          : 0;
      const remaining = Math.max(repeatedPromptWait, priorityWait);
      if (!remaining) {
        playNow(instruction);
        return;
      }

      pendingInstructionRef.current = instruction;
      pendingTimerRef.current = window.setTimeout(() => {
        const pending = pendingInstructionRef.current;
        pendingTimerRef.current = null;
        pendingInstructionRef.current = null;
        if (pending && enabledRef.current) playNow(pending);
      }, remaining);
    },
    [clearPending, playNow],
  );

  useEffect(() => {
    if (!enabled || !currentInstruction) {
      clearPending();
      service.cancel();
      return;
    }
    queueInstruction(currentInstruction);
    return () => {
      clearPending();
      const last = lastSpeechRef.current;
      const priorityIsRecent =
        last.text &&
        last.priority &&
        Date.now() - last.timestamp < voiceGuidanceConfig.instructionCooldownMs;
      if (!priorityIsRecent) service.cancel(true);
    };
  }, [enabled, currentInstruction, clearPending, queueInstruction, service]);

  useEffect(
    () => () => {
      clearPending();
      service.cancel(true);
    },
    [clearPending, service],
  );

  const enable = useCallback(() => {
    enabledRef.current = true;
    setEnabled(true);
    setStatus('');
    playNow(
      currentInstructionRef.current ?? offlineVoiceInstructions.welcome.text,
      true,
      true,
    );
  }, [playNow]);

  const disable = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    clearPending();
    service.cancel(true);
    setStatus('');
  }, [clearPending, service]);

  const replay = useCallback(() => {
    if (!enabledRef.current || !currentInstructionRef.current) return;
    playNow(currentInstructionRef.current, true, true);
  }, [playNow]);

  const announce = useCallback(
    (text: string, priority = false) => {
      if (!enabledRef.current) return;
      if (priority) playNow(text, true, true);
      else queueInstruction(text);
    },
    [playNow, queueInstruction],
  );

  const announceAcquisition = useCallback(
    (text: string) => {
      if (!enabledRef.current) return;
      service.playConfirmationChime(settingsRef.current.volume, () =>
        setStatus(
          'Confirmation sound unavailable. Spoken guidance remains on.',
        ),
      );
      playNow(text, true, true);
    },
    [playNow, service],
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
    announceAcquisition,
  } satisfies VoiceGuidanceControls;
}

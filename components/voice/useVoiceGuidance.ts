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
  testVoice: () => void;
  announce: (text: string, priority?: boolean) => void;
  announceAcquisition: (text: string) => void;
};

export type VoiceGuidanceOptions = {
  service?: VoiceGuidanceService;
  autoSpeak?: boolean;
  suspended?: boolean;
};

export function useVoiceGuidance(
  currentInstruction?: string,
  options: VoiceGuidanceOptions = {},
) {
  const [volume, setVolume] = useState(0.9);
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState('');
  const [service] = useState(
    () => options.service ?? new VoiceGuidanceService(),
  );
  const ownsService = !options.service;
  const settingsRef = useRef({ volume });
  const currentInstructionRef = useRef(currentInstruction);
  const enabledRef = useRef(enabled);
  const lastSpeechRef = useRef({
    text: service.getLastInstruction(),
    timestamp: service.getLastInstructionAt(),
    priority: false,
  });
  const pendingInstructionRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);
  const autoSpeak = options.autoSpeak ?? true;
  const suspended = options.suspended ?? false;

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
      service.speak(instruction, {
        volume: settingsRef.current.volume,
        repeat: repeat || priority,
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
      if (last.text === instruction) return;
      const remaining =
        last.text &&
        now - last.timestamp < voiceGuidanceConfig.instructionCooldownMs
          ? voiceGuidanceConfig.instructionCooldownMs - (now - last.timestamp)
          : 0;
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
    if (!enabled || suspended) {
      clearPending();
      service.cancel();
      return;
    }
    if (!autoSpeak || !currentInstruction) {
      clearPending();
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
  }, [
    autoSpeak,
    enabled,
    currentInstruction,
    clearPending,
    queueInstruction,
    service,
    suspended,
  ]);

  useEffect(() => {
    service.initialize();
    const unsubscribe = service.subscribeStatus(setStatus);
    return () => {
      clearPending();
      unsubscribe();
      if (ownsService) service.dispose();
    };
  }, [clearPending, ownsService, service]);

  const enable = useCallback(() => {
    enabledRef.current = true;
    setEnabled(true);
    setStatus('');
    service.initialize();
    playNow(
      currentInstructionRef.current ?? offlineVoiceInstructions.welcome.text,
      true,
      true,
    );
  }, [playNow, service]);

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

  const testVoice = useCallback(() => {
    if (!enabledRef.current) return;
    service.initialize();
    playNow('Voice guidance is working.', true, true);
  }, [playNow, service]);

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
    testVoice,
    announce,
    announceAcquisition,
  } satisfies VoiceGuidanceControls;
}

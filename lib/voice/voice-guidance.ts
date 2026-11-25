export const offlineVoiceInstructions = {
  welcome: {
    text: 'Welcome to ContourStitch.',
    src: '/audio/instructions/welcome.mp3',
  },
  stepBackward: {
    text: 'Please step backward.',
    src: '/audio/instructions/step-backward.mp3',
  },
  stepForward: {
    text: 'Please step forward.',
    src: '/audio/instructions/step-forward.mp3',
  },
  standStraight: {
    text: 'Stand straight and face the camera.',
    src: '/audio/instructions/stand-straight.mp3',
  },
  raiseArms: {
    text: 'Raise your arms slightly.',
    src: '/audio/instructions/raise-arms.mp3',
  },
  turnLeft: {
    text: 'Turn to your left.',
    src: '/audio/instructions/turn-left.mp3',
  },
  turnRight: {
    text: 'Turn to your right.',
    src: '/audio/instructions/turn-right.mp3',
  },
  turnAround: {
    text: 'Turn around.',
    src: '/audio/instructions/turn-around.mp3',
  },
  holdStill: {
    text: 'Hold still.',
    src: '/audio/instructions/hold-still.mp3',
  },
  countdown: {
    text: 'Three, two, one.',
    src: '/audio/instructions/countdown.mp3',
  },
  measurementCaptured: {
    text: 'Measurement captured successfully.',
    src: '/audio/instructions/measurement-captured.mp3',
  },
  sessionComplete: {
    text: 'Your measurement session is complete.',
    src: '/audio/instructions/session-complete.mp3',
  },
} as const;

export const voiceGuidanceConfig = {
  instructionCooldownMs: 2600,
  speechRate: 0.96,
  speechPitch: 1,
} as const;

export function isEnglishLanguage(language: string) {
  return /^en(?:[-_]|$)/i.test(language.trim());
}

export function voiceIdentity(voice: SpeechSynthesisVoice) {
  return voice.voiceURI || `${voice.name}|${voice.lang}`;
}

export function selectEnglishVoice(voices: readonly SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => isEnglishLanguage(voice.lang));
  return (
    englishVoices.find((voice) =>
      /\b(?:natural|neural|premium|enhanced)\b/i.test(voice.name),
    ) ??
    englishVoices[0] ??
    null
  );
}

export function offlineAudioForInstruction(text: string) {
  const message = text.toLowerCase().replace(/[’']/g, "'");
  const matches: readonly [RegExp, keyof typeof offlineVoiceInstructions][] = [
    [/\bwelcome to contourstitch\b/, 'welcome'],
    [
      /\b(?:step|move)\s+(?:a little\s+)?back(?:ward)?\b|\bfarther back\b/,
      'stepBackward',
    ],
    [
      /\b(?:step|move)\s+(?:a little\s+)?forward\b|\bmove (?:a little )?closer\b/,
      'stepForward',
    ],
    [
      /\b(?:stand|face)\b.*\b(?:straight|upright|camera|front)\b/,
      'standStraight',
    ],
    [
      /\barms?\b.*\b(?:slightly|away|raise|raised|out)\b|\braise your arms\b/,
      'raiseArms',
    ],
    [/\bturn\b.*\bleft\b/, 'turnLeft'],
    [/\bturn\b.*\bright\b/, 'turnRight'],
    [/\bturn around\b|\brotate\b.*\b360\b/, 'turnAround'],
    [/\bhold still\b|\bstay still\b/, 'holdStill'],
    [/\bthree\b.*\btwo\b.*\bone\b/, 'countdown'],
    [
      /\bmeasurement acquired\b|\bmeasurement captured successfully\b|\bcapture[d] successfully\b/,
      'measurementCaptured',
    ],
    [
      /\bsession is complete\b|\bscan is complete\b|\bscan complete\b/,
      'sessionComplete',
    ],
  ];

  const match = matches.find(([pattern]) => pattern.test(message));
  return match ? offlineVoiceInstructions[match[1]].src : null;
}

type AudioPlayer = {
  play(
    volume: number,
    onStart: () => void,
    onError: () => void,
    onEnd: () => void,
  ): void | Promise<void>;
  pause(): void;
};

let confirmationAudioContext: AudioContext | null = null;
const audioPlayers = new Map<string, HTMLAudioElement>();

function playConfirmationTone(volume: number, onError: () => void) {
  if (typeof window === 'undefined') {
    onError();
    return;
  }
  const compatibleWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor =
    window.AudioContext ?? compatibleWindow.webkitAudioContext;
  if (!AudioContextConstructor) {
    onError();
    return;
  }

  try {
    confirmationAudioContext ??= new AudioContextConstructor();
    const context = confirmationAudioContext;
    const play = () => {
      try {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.14);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(
          Math.max(0.0001, 0.045 * volume),
          now + 0.025,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.26);
      } catch {
        onError();
      }
    };

    if (context.state === 'running') play();
    else void context.resume().then(play, onError);
  } catch {
    onError();
  }
}

export type VoiceGuidanceEnvironment = {
  getVoices(): readonly SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  createUtterance(text: string): SpeechSynthesisUtterance | null;
  createAudio(src: string): AudioPlayer | null;
  playConfirmationChime(volume: number, onError: () => void): void;
  browserLanguage(): string;
};

function getSynthesis() {
  return typeof window === 'undefined' ? null : window.speechSynthesis;
}

const browserEnvironment: VoiceGuidanceEnvironment = {
  getVoices: () => getSynthesis()?.getVoices() ?? [],
  speak: (utterance) => {
    const synthesis = getSynthesis();
    if (!synthesis) throw new Error('Speech synthesis is unavailable.');
    synthesis.speak(utterance);
  },
  cancel: () => getSynthesis()?.cancel(),
  createUtterance: (text) =>
    typeof SpeechSynthesisUtterance === 'undefined'
      ? null
      : new SpeechSynthesisUtterance(text),
  createAudio: (src) => {
    if (typeof Audio === 'undefined') return null;
    let audio = audioPlayers.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = 'auto';
      audioPlayers.set(src, audio);
    }
    return {
      play(volume, onStart, onError, onEnd) {
        audio.volume = volume;
        audio.onplaying = onStart;
        audio.onerror = onError;
        audio.onended = onEnd;
        audio.currentTime = 0;
        return audio.play();
      },
      pause() {
        audio.pause();
        audio.currentTime = 0;
      },
    };
  },
  playConfirmationChime: playConfirmationTone,
  browserLanguage: () =>
    typeof navigator === 'undefined' ? '' : navigator.language,
};

type SpeakOptions = {
  volume?: number;
  repeat?: boolean;
  onStatus?: (message: string) => void;
};

const interruptedErrors = new Set(['canceled', 'interrupted']);

export class VoiceGuidanceService {
  private generation = 0;
  private activeAudio: AudioPlayer | null = null;
  private lastInstruction = '';

  constructor(
    private readonly environment: VoiceGuidanceEnvironment = browserEnvironment,
  ) {}

  cancel(resetInstruction = false) {
    this.generation += 1;
    this.environment.cancel();
    this.activeAudio?.pause();
    this.activeAudio = null;
    if (resetInstruction) this.lastInstruction = '';
  }

  speak(text: string, options: SpeakOptions = {}) {
    const instruction = text.trim();
    if (!instruction) return;
    if (!options.repeat && instruction === this.lastInstruction) return;

    this.cancel();
    const generation = this.generation;
    this.lastInstruction = instruction;
    const volume = Math.max(0, Math.min(1, options.volume ?? 1));
    const report = options.onStatus ?? (() => {});
    const voice = selectEnglishVoice(this.environment.getVoices());

    if (voice) {
      this.speakWithVoice(
        instruction,
        voice,
        volume,
        generation,
        report,
        new Set([voiceIdentity(voice)]),
      );
      return;
    }

    this.playOfflineThenDefault(instruction, volume, generation, report);
  }

  playConfirmationChime(volume: number, onError: () => void) {
    this.environment.playConfirmationChime(volume, onError);
  }

  private tryNextEnglishVoice(
    text: string,
    volume: number,
    generation: number,
    report: (message: string) => void,
    attempted: Set<string>,
  ) {
    const next = selectEnglishVoice(
      this.environment
        .getVoices()
        .filter((voice) => !attempted.has(voiceIdentity(voice))),
    );
    if (next) {
      attempted.add(voiceIdentity(next));
      this.speakWithVoice(text, next, volume, generation, report, attempted);
    } else {
      this.playOfflineThenDefault(text, volume, generation, report);
    }
  }

  private isCurrent(generation: number) {
    return generation === this.generation;
  }

  private speakWithVoice(
    text: string,
    voice: SpeechSynthesisVoice,
    volume: number,
    generation: number,
    report: (message: string) => void,
    attempted: Set<string>,
  ) {
    const utterance = this.environment.createUtterance(text);
    if (!utterance) {
      this.playOfflineThenDefault(text, volume, generation, report);
      return;
    }

    let started = false;
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.volume = volume;
    utterance.rate = voiceGuidanceConfig.speechRate;
    utterance.pitch = voiceGuidanceConfig.speechPitch;
    utterance.onstart = () => {
      started = true;
      if (this.isCurrent(generation)) report('');
    };
    utterance.onend = () => {
      if (this.isCurrent(generation)) report('');
    };
    utterance.onerror = (event) => {
      if (!this.isCurrent(generation) || interruptedErrors.has(event.error))
        return;
      if (started) {
        report('Voice playback stopped. Replay the instruction to try again.');
        return;
      }
      this.tryNextEnglishVoice(text, volume, generation, report, attempted);
    };

    try {
      this.environment.speak(utterance);
    } catch {
      this.tryNextEnglishVoice(text, volume, generation, report, attempted);
    }
  }

  private playOfflineThenDefault(
    text: string,
    volume: number,
    generation: number,
    report: (message: string) => void,
  ) {
    const src = offlineAudioForInstruction(text);
    const audio = src ? this.environment.createAudio(src) : null;
    if (!audio) {
      this.speakWithBrowserDefault(text, volume, generation, report);
      return;
    }

    this.activeAudio = audio;
    let started = false;
    let failed = false;
    const fail = () => {
      if (failed || !this.isCurrent(generation)) return;
      failed = true;
      audio.pause();
      this.activeAudio = null;
      if (started) {
        report('Offline audio stopped. Replay the instruction to try again.');
      } else {
        this.speakWithBrowserDefault(text, volume, generation, report);
      }
    };
    const onStart = () => {
      started = true;
      if (this.isCurrent(generation)) report('Using an offline instruction.');
    };
    const onEnd = () => {
      if (!this.isCurrent(generation)) return;
      this.activeAudio = null;
      report('');
    };

    try {
      const playback = audio.play(volume, onStart, fail, onEnd);
      if (playback) void playback.catch(fail);
    } catch {
      fail();
    }
  }

  private speakWithBrowserDefault(
    text: string,
    volume: number,
    generation: number,
    report: (message: string) => void,
  ) {
    if (!this.isCurrent(generation)) return;
    const voices = this.environment.getVoices();
    const defaultVoice = voices.find((voice) => voice.default);
    const language = this.environment.browserLanguage();
    const suitable =
      defaultVoice !== undefined
        ? isEnglishLanguage(defaultVoice.lang)
        : isEnglishLanguage(language);
    const utterance = suitable ? this.environment.createUtterance(text) : null;
    if (!utterance) {
      report(
        'Voice guidance could not play. Use the on-screen instructions or replay to try again.',
      );
      return;
    }

    utterance.voice = null;
    utterance.lang = isEnglishLanguage(language) ? language : 'en-US';
    utterance.volume = volume;
    utterance.rate = voiceGuidanceConfig.speechRate;
    utterance.pitch = voiceGuidanceConfig.speechPitch;
    utterance.onstart = () => {
      if (this.isCurrent(generation)) report('');
    };
    utterance.onerror = (event) => {
      if (this.isCurrent(generation) && !interruptedErrors.has(event.error))
        report(
          'Voice guidance could not play. Use the on-screen instructions or replay to try again.',
        );
    };
    try {
      this.environment.speak(utterance);
    } catch {
      report(
        'Voice guidance could not play. Use the on-screen instructions or replay to try again.',
      );
    }
  }
}

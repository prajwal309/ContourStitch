import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceControls } from '@/components/voice/VoiceControls';
import { useVoiceGuidance } from '@/components/voice/useVoiceGuidance';
import {
  offlineVoiceInstructions,
  selectEnglishVoice,
  VoiceGuidanceService,
  type VoiceGuidanceEnvironment,
} from '@/lib/voice/voice-guidance';

class FakeUtterance extends EventTarget {
  readonly text: string;
  lang = '';
  pitch = 1;
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  volume = 1;
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
  onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
  onend: ((event: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
  onmark: ((event: SpeechSynthesisEvent) => void) | null = null;
  onpause: ((event: SpeechSynthesisEvent) => void) | null = null;
  onresume: ((event: SpeechSynthesisEvent) => void) | null = null;

  constructor(text: string) {
    super();
    this.text = text;
  }
}

function makeVoice(
  name: string,
  lang: string,
  localService: boolean,
  isDefault = false,
): SpeechSynthesisVoice {
  return {
    default: isDefault,
    lang,
    localService,
    name,
    voiceURI: `${name}-${lang}`,
  };
}

function makeEnvironment({
  voices = [],
  language = 'en-US',
  playAudio = vi.fn(() => Promise.resolve()),
}: {
  voices?: SpeechSynthesisVoice[];
  language?: string;
  playAudio?: (
    volume: number,
    onStart: () => void,
    onError: () => void,
    onEnd: () => void,
  ) => void | Promise<void>;
} = {}) {
  const spoken: SpeechSynthesisUtterance[] = [];
  const audioSources: string[] = [];
  const paused: string[] = [];
  const environment: VoiceGuidanceEnvironment = {
    getVoices: () => voices,
    speak: (utterance) => spoken.push(utterance),
    cancel: vi.fn(),
    createUtterance: (text) => new FakeUtterance(text),
    createAudio: (src) => {
      audioSources.push(src);
      return {
        play: playAudio,
        pause: () => paused.push(src),
      };
    },
    browserLanguage: () => language,
  };
  return { environment, spoken, audioSources, paused };
}

function GuidancePanel({ instruction }: { instruction: string }) {
  const guidance = useVoiceGuidance(instruction);
  return <VoiceControls guidance={guidance} />;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('English voice selection', () => {
  it('selects the first available English voice in browser list order', () => {
    const french = makeVoice('French', 'fr-FR', true);
    const remoteUs = makeVoice('Remote US', 'en-US', false);
    const localGb = makeVoice('Local GB', 'en-GB', true);
    const localUs = makeVoice('Local US', 'en_US', true);

    expect(selectEnglishVoice([french, remoteUs, localGb, localUs])).toBe(
      remoteUs,
    );
    expect(selectEnglishVoice([french])).toBeNull();
  });

  it('supports English locale variants and ignores non-English voices', () => {
    const french = makeVoice('French', 'fr-FR', true);
    const australian = makeVoice('Australian English', 'en-AU', false);
    const british = makeVoice('British English', 'en-GB', true);

    expect(selectEnglishVoice([french, australian, british])).toBe(australian);
  });

  it('uses a browser-provided English voice when no local voice exists', () => {
    const remote = makeVoice('Browser English', 'en-AU', false);
    const { environment, spoken } = makeEnvironment({ voices: [remote] });
    const service = new VoiceGuidanceService(environment);

    service.speak('Hold still.');

    expect(spoken[0].voice).toBe(remote);
  });

  it('tries another available English voice when the first one cannot start', () => {
    const first = makeVoice('First English', 'en-GB', false);
    const fallback = makeVoice('Fallback English', 'en-US', true);
    const { environment, spoken, audioSources } = makeEnvironment({
      voices: [first, fallback],
    });
    const service = new VoiceGuidanceService(environment);

    service.speak('Hold still.');
    spoken[0].onerror?.(
      Object.assign(new Event('error'), {
        error: 'synthesis-failed',
      }) as SpeechSynthesisErrorEvent,
    );

    expect(spoken).toHaveLength(2);
    expect(spoken[1].voice).toBe(fallback);
    expect(audioSources).toHaveLength(0);
  });
});

describe('VoiceGuidanceService', () => {
  it('uses the bundled audio prompt when no English browser voice is available', () => {
    const { environment, audioSources, spoken } = makeEnvironment({
      voices: [makeVoice('French', 'fr-FR', true)],
      language: 'fr-FR',
    });
    const service = new VoiceGuidanceService(environment);

    service.speak('Please step backward.');

    expect(audioSources).toEqual([offlineVoiceInstructions.stepBackward.src]);
    expect(spoken).toHaveLength(0);
  });

  it('falls back to bundled audio when browser speech fails before playback', () => {
    const { environment, audioSources, spoken } = makeEnvironment({
      voices: [makeVoice('English', 'en-US', true)],
    });
    const service = new VoiceGuidanceService(environment);

    service.speak('Hold still.');
    spoken[0].onerror?.(
      Object.assign(new Event('error'), {
        error: 'synthesis-failed',
      }) as SpeechSynthesisErrorEvent,
    );

    expect(audioSources).toEqual([offlineVoiceInstructions.holdStill.src]);
  });

  it('does not duplicate repeated instructions unless replay is requested', () => {
    const { environment, spoken } = makeEnvironment({
      voices: [makeVoice('English', 'en-US', true)],
    });
    const service = new VoiceGuidanceService(environment);

    service.speak('Hold still.');
    service.speak('Hold still.');
    service.speak('Hold still.', { repeat: true });

    expect(spoken).toHaveLength(2);
    expect(environment.cancel).toHaveBeenCalledTimes(2);
  });

  it('uses the browser default only after offline audio fails and English is suitable', async () => {
    const { environment, spoken } = makeEnvironment({
      language: 'en-GB',
      playAudio: vi.fn(() => Promise.reject(new Error('Audio unavailable'))),
    });
    const service = new VoiceGuidanceService(environment);

    service.speak('Please step forward.');
    await waitFor(() => expect(spoken).toHaveLength(1));

    expect(spoken[0].voice).toBeNull();
    expect(spoken[0].lang).toBe('en-GB');
  });
});

describe('VoiceControls', () => {
  it('keeps the toggle and on-screen fallback when no English voice is available', () => {
    const synthesis = Object.assign(new EventTarget(), {
      getVoices: () => [makeVoice('French', 'fr-FR', true)],
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    vi.stubGlobal('speechSynthesis', synthesis);
    render(<GuidancePanel instruction="" />);

    expect(
      screen.getByRole('button', { name: 'Disable voice guidance' }),
    ).toBeVisible();
    expect(
      screen.getByText(/On-screen instructions remain available/),
    ).toBeVisible();
    expect(screen.queryByLabelText('English voice')).not.toBeInTheDocument();
  });

  it('automatically uses the first English voice after the browser list loads', async () => {
    let available: SpeechSynthesisVoice[] = [];
    const synthesis = Object.assign(new EventTarget(), {
      getVoices: () => available,
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    vi.stubGlobal('speechSynthesis', synthesis);
    render(<GuidancePanel instruction="Hold still." />);
    expect(screen.queryByLabelText('English voice')).not.toBeInTheDocument();

    const french = makeVoice('French', 'fr-FR', true);
    const firstEnglish = makeVoice('First English', 'en-GB', false);
    const secondEnglish = makeVoice('Second English', 'en-US', true);
    await act(async () => {
      available = [french, firstEnglish, secondEnglish];
      synthesis.dispatchEvent(new Event('voiceschanged'));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Replay instruction' }));
    await waitFor(() =>
      expect(synthesis.speak).toHaveBeenLastCalledWith(
        expect.objectContaining({ voice: firstEnglish }),
      ),
    );
  });

  it('starts enabled, uses the first available voice, and remains toggleable', () => {
    const firstEnglish = makeVoice('First English', 'en-GB', false);
    const secondEnglish = makeVoice('Second English', 'en-US', true);
    const synthesis = Object.assign(new EventTarget(), {
      getVoices: () => [firstEnglish, secondEnglish],
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    vi.stubGlobal('speechSynthesis', synthesis);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    render(<GuidancePanel instruction="Hold still." />);
    expect(
      screen.getByRole('button', { name: 'Disable voice guidance' }),
    ).toBeVisible();
    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    expect(synthesis.speak).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Hold still.', voice: firstEnglish }),
    );

    fireEvent.change(screen.getByRole('slider'), {
      target: { value: '0.35' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Replay instruction' }));
    expect(synthesis.speak).toHaveBeenCalledTimes(2);
    expect(synthesis.speak).toHaveBeenLastCalledWith(
      expect.objectContaining({ voice: firstEnglish, volume: 0.35 }),
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Disable voice guidance' }),
    );
    expect(
      screen.getByRole('button', { name: 'Enable voice guidance' }),
    ).toBeVisible();
  });

  it('cancels the previous prompt when the measurement stage changes', () => {
    const voice = makeVoice('Local English', 'en-US', true);
    const synthesis = Object.assign(new EventTarget(), {
      getVoices: () => [voice],
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    vi.stubGlobal('speechSynthesis', synthesis);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    const view = render(<GuidancePanel instruction="Hold still." />);
    view.rerender(<GuidancePanel instruction="Turn to your left." />);

    expect(synthesis.cancel).toHaveBeenCalled();
    expect(synthesis.speak).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Turn to your left.' }),
    );
  });
});

export const demoCycleSeconds = 16;
const stageSeconds = 4;

export const demoStages = [
  { id: 'front', title: 'Front View', shortTitle: 'Front' },
  { id: 'side', title: 'Side View', shortTitle: 'Side' },
  { id: 'review', title: 'Review', shortTitle: 'Review' },
  { id: 'results', title: 'Measurement Results', shortTitle: 'Results' },
] as const;

export type DemoStage = (typeof demoStages)[number]['id'];
export type DemoTimelineRef = { current: { elapsedSeconds: number } };

export type DemoFrame = {
  elapsedSeconds: number;
  stage: DemoStage;
  stageIndex: number;
  progress: number;
  secondsIntoStage: number;
  rotation: number;
};

function smoothstep(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

export function getDemoFrame(seconds: number): DemoFrame {
  const elapsedSeconds =
    ((Number.isFinite(seconds) ? seconds : 0) % demoCycleSeconds) +
    demoCycleSeconds;
  const cycleTime = elapsedSeconds % demoCycleSeconds;
  const stageIndex = Math.floor(cycleTime / stageSeconds);
  const secondsIntoStage = cycleTime - stageIndex * stageSeconds;
  const progress = secondsIntoStage / stageSeconds;
  let rotation = 0;

  if (stageIndex === 1) {
    rotation = (Math.PI / 2) * smoothstep(progress);
  } else if (stageIndex === 2) {
    rotation = Math.PI / 2 + Math.PI * smoothstep(progress);
  } else if (stageIndex === 3) {
    if (secondsIntoStage <= 1.2) {
      rotation =
        (Math.PI * 3) / 2 + (Math.PI / 3) * smoothstep(secondsIntoStage / 1.2);
    } else if (secondsIntoStage <= 3) {
      rotation = (Math.PI * 11) / 6;
    } else {
      rotation =
        (Math.PI * 11) / 6 +
        (Math.PI / 6) * smoothstep((secondsIntoStage - 3) / 1);
    }
  }

  return {
    elapsedSeconds: cycleTime,
    stage: demoStages[stageIndex].id,
    stageIndex,
    progress,
    secondsIntoStage,
    rotation,
  };
}

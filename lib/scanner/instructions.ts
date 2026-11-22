import type { InstructionId } from './types';
export const instructions: Record<InstructionId, string> = {
  FIND_PERSON:
    'Stand in front of the camera. Only one person should be visible.',
  SHOW_FULL_BODY: 'Make sure your head and both feet are visible.',
  MOVE_CLOSER: 'Move a little closer.',
  MOVE_BACK: 'Move a little farther back.',
  MOVE_LEFT: 'Move slightly toward the left edge of the preview.',
  MOVE_RIGHT: 'Move slightly toward the right edge of the preview.',
  STAND_STRAIGHT: 'Stand upright, with the camera level around waist height.',
  ARMS_OUT: 'Keep your arms slightly away from your torso.',
  HOLD_STILL: 'Perfect. Hold still.',
  FACE_FRONT: 'Face the camera squarely.',
  START_TURNING: 'Now turn slowly to your right.',
  KEEP_TURNING: 'Keep turning slowly to your right.',
  TURN_SLOWER: 'Slow down slightly.',
  TURN_FASTER: 'Keep turning a little at a time.',
  RETURN_TO_FRONT: 'Almost finished. Face the camera again.',
  IMPROVE_LIGHT: 'Use brighter lighting and pause for a sharp view.',
  SCAN_COMPLETE: 'Scan complete.',
  RETRY: 'Scan interrupted. Restart and turn slowly through every view.',
};

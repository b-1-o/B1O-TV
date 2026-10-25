export interface ViewMotionTiming {
  exitMs: number;
  enterMs: number;
}

/**
 * Keep TV transitions visible but short enough to preserve remote-control responsiveness.
 * Reduced-motion preference always wins over the runtime profile.
 */
export function getViewMotionTiming(reduceMotion: boolean, tvRuntime: boolean): ViewMotionTiming | null {
  if (reduceMotion) return null;
  return tvRuntime
    ? { exitMs: 90, enterMs: 190 }
    : { exitMs: 170, enterMs: 430 };
}

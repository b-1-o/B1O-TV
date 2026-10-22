import { init, setKeyMap } from '@noriginmedia/norigin-spatial-navigation';

let initialized = false;

/** Initialize once before the React focus tree mounts. */
export function initializeSpatialNavigation(): void {
  if (initialized) return;

  init({
    debug: false,
    visualDebug: false,
    throttle: 55,
    throttleKeypresses: true,
  });

  setKeyMap({
    left: [37, 'ArrowLeft'],
    right: [39, 'ArrowRight'],
    up: [38, 'ArrowUp'],
    down: [40, 'ArrowDown'],
    enter: [13, 'Enter'],
  });

  initialized = true;
}

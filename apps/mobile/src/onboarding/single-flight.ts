export type SingleFlightGuard = {
  tryStart: () => boolean;
  finish: () => void;
  isBusy: () => boolean;
};

export function createSingleFlightGuard(): SingleFlightGuard {
  let busy = false;
  return {
    tryStart() {
      if (busy) return false;
      busy = true;
      return true;
    },
    finish() {
      busy = false;
    },
    isBusy() {
      return busy;
    }
  };
}

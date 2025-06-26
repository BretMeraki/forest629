// @ts-nocheck

export const format = {
  combine: (...args) => args,
  timestamp: () => () => {},
  errors: () => () => {},
  printf: fn => fn,
  json: () => () => {},
  colorize: () => () => {},
};

export const transports = {
  Console: class {},
  File: class {
    constructor() {
      /* noop */
    }
  },
};

export const addColors = () => {};

export function createLogger() {
  const noop = () => {};
  return {
    log: noop,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    child: () => createLogger(),
  };
}

export default {
  format,
  transports,
  addColors,
  createLogger,
}; 
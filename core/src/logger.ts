/**
 * pluggable logger — replaces silent catch blocks and console.log throughout
 * the codebase. defaults to console; consumers can swap via setLogger().
 */

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

let current: Logger = console;

export function setLogger(logger: Logger): void {
  current = logger;
}

export const log = {
  debug(msg: string, ...args: unknown[]): void {
    current.debug(msg, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    current.warn(msg, ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    current.error(msg, ...args);
  },
};

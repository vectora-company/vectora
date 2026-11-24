export interface GraphicsInfoReporterOptions<T> {
  enabled: boolean;
  getInfo: () => Promise<T>;
  log: (reason: string, info: T) => void;
  warn: (reason: string, error: unknown) => void;
}

/** Creates a one-shot Chromium GPU diagnostic reporter. */
export function createGraphicsInfoReporter<T>(
  options: GraphicsInfoReporterOptions<T>,
): (reason: string) => Promise<void> {
  let requested = false;

  return async (reason: string): Promise<void> => {
    if (!options.enabled || requested) return;
    requested = true;

    try {
      options.log(reason, await options.getInfo());
    } catch (error) {
      options.warn(reason, error);
    }
  };
}

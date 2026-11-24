const xnnpackInfo = 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.';

let activeInitializations = 0;
let originalConsoleError: typeof console.error | null = null;
let routedConsoleError: typeof console.error | null = null;

export async function withMediaPipeStartupLogging<T>(
  initialize: () => Promise<T>,
): Promise<T> {
  if (activeInitializations === 0) {
    originalConsoleError = console.error;
    routedConsoleError = (...args: Parameters<typeof console.error>) => {
      if (typeof args[0] === 'string' && args[0].startsWith(xnnpackInfo)) {
        console.info(args[0]);
        return;
      }
      originalConsoleError?.apply(console, args);
    };
    console.error = routedConsoleError;
  }
  activeInitializations++;

  try {
    return await initialize();
  } finally {
    activeInitializations--;
    if (activeInitializations === 0) {
      if (console.error === routedConsoleError && originalConsoleError)
        console.error = originalConsoleError;
      originalConsoleError = null;
      routedConsoleError = null;
    }
  }
}

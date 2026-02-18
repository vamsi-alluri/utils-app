/**
 * Favicon Manager
 *
 * Handles dynamic favicon updates for different app states:
 * - Default: Regular app icon
 * - Loading: Spinner animation
 * - Done: Success checkmark with sparkle animation (for notifications)
 */

type FaviconState = "default" | "loading" | "done";

const FAVICON_PATHS: Record<FaviconState, string> = {
  default: "/favicon.svg",
  loading: "/favicon-loading.svg",
  done: "/favicon-done.svg",
};

let currentFaviconState: FaviconState = "default";
let faviconResetTimeout: number | null = null;
let doneAnimationInterval: number | null = null;
let originalTitle: string = "";

/**
 * Get the favicon link element
 */
function getFaviconElement(): HTMLLinkElement | null {
  return document.querySelector('link[rel="icon"][id="dynamic-favicon"]');
}

/**
 * Update the favicon to a specific state
 */
export function setFavicon(state: FaviconState): void {
  const favicon = getFaviconElement();
  if (!favicon) return;

  currentFaviconState = state;
  favicon.href = FAVICON_PATHS[state];
}

/**
 * Set loading favicon (shows spinner)
 */
export function setFaviconLoading(): void {
  clearFaviconTimers();
  setFavicon("loading");
}

/**
 * Set done/favicon with sparkle animation
 * Automatically resets after specified duration
 *
 * @param resetDurationMs - How long to show the done state before resetting (default: 10s)
 */
export function setFaviconDone(resetDurationMs: number = 10000): void {
  clearFaviconTimers();

  // Store original title
  if (!originalTitle) {
    originalTitle = document.title;
  }

  setFavicon("done");

  // Pulse the title to draw attention
  const titlePulseInterval = setInterval(() => {
    document.title = document.title === "✓ Analysis Complete!"
      ? originalTitle
      : "✓ Analysis Complete!";
  }, 1000);

  doneAnimationInterval = titlePulseInterval as unknown as number;

  // Reset after duration
  faviconResetTimeout = window.setTimeout(() => {
    resetFavicon();
  }, resetDurationMs);
}

/**
 * Reset favicon to default state
 */
export function resetFavicon(): void {
  clearFaviconTimers();
  setFavicon("default");

  // Reset title
  if (originalTitle) {
    document.title = originalTitle;
  }
}

/**
 * Clear any active timeouts/intervals
 */
function clearFaviconTimers(): void {
  if (faviconResetTimeout !== null) {
    clearTimeout(faviconResetTimeout);
    faviconResetTimeout = null;
  }
  if (doneAnimationInterval !== null) {
    clearInterval(doneAnimationInterval);
    doneAnimationInterval = null;
  }
}

/**
 * Get current favicon state
 */
export function getFaviconState(): FaviconState {
  return currentFaviconState;
}

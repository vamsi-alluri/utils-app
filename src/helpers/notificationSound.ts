/**
 * Notification Sound
 *
 * Creates a "boing" notification sound using Web Audio API.
 * No external audio files needed.
 */

let audioContext: AudioContext | null = null;

/**
 * Initialize the audio context (must be called after user interaction)
 */
function initAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a "boing" notification sound
 *
 * The sound is created by combining:
 * - A rising pitch slide (like a cartoon "boing" ascending)
 * - A slight decay for natural sound
 * - A harmonious tone that's pleasant but attention-grabbing
 */
export function playNotificationSound(): void {
  try {
    const ctx = initAudioContext();

    // Resume context if suspended (required after user interaction)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Main oscillator for the boing sound
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Create the characteristic "boing" - a quick pitch slide upward
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.2);

    // Envelope for the sound (quick attack, smooth decay)
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play the sound
    oscillator.start(now);
    oscillator.stop(now + 0.4);

    // Add a second harmonic for richness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(600, now);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(900, now + 0.2);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now);
    osc2.stop(now + 0.3);
  } catch (error) {
    console.warn("Could not play notification sound:", error);
  }
}

/**
 * Play notification sound with a delay
 * Useful for ensuring sound plays after page becomes visible
 */
export function playNotificationSoundDelayed(delayMs: number = 100): void {
  setTimeout(() => {
    playNotificationSound();
  }, delayMs);
}

/**
 * Check if audio is supported
 */
export function isAudioSupported(): boolean {
  return !!(window.AudioContext || (window as any).webkitAudioContext);
}

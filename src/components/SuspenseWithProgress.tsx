import { useState, useEffect, useRef, Suspense, type ReactNode } from "react";

interface ProgressBarProps {
  theme?: "blue" | "red" | "green" | "purple" | "orange" | "pink";
  height?: number;
}

/**
 * Progress bar component that animates when visible
 */
function ProgressBar({ theme = "blue", height = 2 }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const themeColors = {
    blue: "bg-blue-600",
    red: "bg-red-600",
    green: "bg-green-600",
    purple: "bg-purple-600",
    orange: "bg-orange-600",
    pink: "bg-pink-600",
  };

  useEffect(() => {
    // Start progress animation
    setProgress(0);

    const timers = [
      setTimeout(() => setProgress(30), 50),
      setTimeout(() => setProgress(60), 200),
      setTimeout(() => setProgress(80), 600),
      setTimeout(() => setProgress(90), 1000),
      setTimeout(() => setProgress(95), 1500),
    ];

    timersRef.current = timers;

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  if (progress === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] ${themeColors[theme]} transition-all duration-300 ease-out shadow-lg`}
      style={{
        width: `${progress}%`,
        height: `${height}px`,
      }}
    />
  );
}

/**
 * Loading fallback that shows the progress bar
 */
export function LoadingFallback({
  theme = "blue",
  height = 2,
  children,
}: ProgressBarProps & { children?: ReactNode }) {
  return (
    <>
      <ProgressBar theme={theme} height={height} />
      {children}
    </>
  );
}

/**
 * Suspense wrapper with integrated progress bar.
 * Only shows progress bar when Suspense actually triggers (lazy loading).
 *
 * Usage:
 * ```tsx
 * <SuspenseWithProgress fallback={<div>Loading...</div>}>
 *   <LazyComponent />
 * </SuspenseWithProgress>
 * ```
 */
export function SuspenseWithProgress({
  children,
  fallback,
  theme = "blue",
  height = 2,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  theme?: "blue" | "red" | "green" | "purple" | "orange" | "pink";
  height?: number;
}) {
  return (
    <Suspense
      fallback={
        <LoadingFallback theme={theme} height={height}>
          {fallback}
        </LoadingFallback>
      }
    >
      {children}
    </Suspense>
  );
}

export default SuspenseWithProgress;

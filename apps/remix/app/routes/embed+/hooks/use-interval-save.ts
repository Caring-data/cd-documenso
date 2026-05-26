import { useEffect, useRef } from 'react';

type UseIntervalSaveOptions = {
  onSave: () => Promise<void> | void;
  intervalMs?: number;
  enabled?: boolean;
};

export const useIntervalSave = ({
  onSave,
  intervalMs = 10 * 60 * 1000,
  enabled = true,
}: UseIntervalSaveOptions) => {
  const onSaveRef = useRef(onSave);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const runTick = async () => {
      if (cancelled) return;

      try {
        await onSaveRef.current();
      } catch (err) {
        console.error('Interval save failed:', err);
      }

      if (!cancelled) {
        timerRef.current = setTimeout(scheduleTick, intervalMs);
      }
    };

    const scheduleTick = () => {
      void runTick();
    };

    timerRef.current = setTimeout(scheduleTick, intervalMs);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, intervalMs]);
};

import { useEffect, useRef } from 'react';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { tabHighlightDuration } from '@/components/workspace-tab-highlight';

const EASE_IN_OUT_CUBIC = Easing.inOut(Easing.cubic);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function useTravelingTabProgress(activeIndex: number): {
  enabled: SharedValue<number>;
  progress: SharedValue<number>;
} {
  const reduced = useReducedMotion();
  const progress = useSharedValue(Math.max(0, activeIndex));
  const enabled = useSharedValue(activeIndex >= 0 ? 1 : 0);
  const previousIndex = useRef(activeIndex);

  useEffect(() => {
    if (activeIndex < 0) {
      enabled.set(reduced ? 0 : withTiming(0, { duration: 168, easing: EASE_OUT }));
      return;
    }

    enabled.set(reduced ? 1 : withTiming(1, { duration: 168, easing: EASE_OUT }));

    const fromIndex = previousIndex.current;
    previousIndex.current = activeIndex;

    if (reduced || fromIndex < 0 || fromIndex === activeIndex) {
      progress.set(activeIndex);
      return;
    }

    progress.set(
      withTiming(activeIndex, {
        duration: tabHighlightDuration(fromIndex, activeIndex),
        easing: EASE_IN_OUT_CUBIC,
      }),
    );
  }, [activeIndex, enabled, progress, reduced]);

  return { enabled, progress };
}

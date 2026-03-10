import {
  Extrapolation,
  interpolate,
  type SharedValue,
  useDerivedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

export type SectionLayout = {
  y: number;
  height: number;
};

export function useHeroPieceStyle(progress: SharedValue<number>, distance: number) {
  return useAnimatedStyle(
    () => ({
      opacity: progress.value,
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [distance, 0], Extrapolation.CLAMP),
        },
      ],
    }),
    [distance],
  );
}

export function useSectionRevealStyle(
  scrollY: SharedValue<number>,
  layout: SectionLayout | undefined,
  viewportHeight: number,
  intensity: number,
) {
  return useAnimatedStyle(
    () => {
      const y = layout?.y ?? viewportHeight * 2;
      const travel = viewportHeight < 820 ? 72 * intensity : 96 * intensity;
      const start = y - viewportHeight * 0.92;
      const midpoint = y - viewportHeight * 0.42;
      const settle = y - viewportHeight * 0.1;

      return {
        opacity: interpolate(scrollY.value, [start, midpoint, settle], [0.12, 0.52, 1], Extrapolation.CLAMP),
        transform: [
          {
            translateY: interpolate(
              scrollY.value,
              [start, midpoint, settle],
              [travel, travel * 0.22, 0],
              Extrapolation.CLAMP,
            ),
          },
          {
            scale: interpolate(scrollY.value, [start, midpoint, settle], [0.9, 0.96, 1], Extrapolation.CLAMP),
          },
        ],
      };
    },
    [layout?.y, intensity, viewportHeight],
  );
}

export function useParallaxStyle(
  scrollY: SharedValue<number>,
  layout: SectionLayout | undefined,
  viewportHeight: number,
  distance: number,
) {
  return useAnimatedStyle(
    () => {
      const y = layout?.y ?? viewportHeight * 2;
      const sectionHeight = layout?.height ?? viewportHeight;

      return {
        transform: [
          {
            translateY: interpolate(
              scrollY.value,
              [y - viewportHeight, y + sectionHeight],
              [-distance, distance],
              Extrapolation.CLAMP,
            ),
          },
        ],
      };
    },
    [distance, layout?.height, layout?.y, viewportHeight],
  );
}

export function usePinnedSceneProgress(
  scrollY: SharedValue<number>,
  layout: SectionLayout | undefined,
  viewportHeight: number,
) {
  return useDerivedValue(
    () => {
      const y = layout?.y ?? viewportHeight * 2;
      const sectionHeight = layout?.height ?? viewportHeight * 1.8;
      const start = y - viewportHeight * 0.16;
      const end = y + sectionHeight - viewportHeight * 0.88;

      return interpolate(scrollY.value, [start, end], [0, 1], Extrapolation.CLAMP);
    },
    [layout?.height, layout?.y, viewportHeight],
  );
}

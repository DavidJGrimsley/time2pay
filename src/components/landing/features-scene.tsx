import { createElement, type PropsWithChildren } from 'react';
import {
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import {
  features,
  featuresSection,
} from '../../content/landing-content';
import { FeatureCard } from './feature-card';
import {
  type SectionLayout,
  usePinnedSceneProgress,
} from './landing-motion';
import { SemanticText } from './semantic-elements';

type FeaturesSceneProps = {
  scrollY: SharedValue<number>;
  layout: SectionLayout | undefined;
  viewportHeight: number;
  viewportWidth: number;
  onLayout?: (event: LayoutChangeEvent) => void;
};

type FeatureCardWidth = '100%' | '48.5%' | '31.8%';

function StickyFrame({
  enabled,
  top,
  height,
  children,
}: PropsWithChildren<{
  enabled: boolean;
  top: number;
  height: number;
}>) {
  if (process.env.EXPO_OS === 'web' && enabled) {
    return createElement(
      'div',
      {
        className: 'sticky',
        style: {
          top,
          height,
        },
      },
      children,
    );
  }

  return <View style={enabled ? { minHeight: height } : undefined}>{children}</View>;
}

function PinnedFeatureCard({
  feature,
  index,
  progress,
  compact,
}: {
  feature: (typeof features)[number];
  index: number;
  progress: SharedValue<number>;
  compact: boolean;
}) {
  const cardStyle = useAnimatedStyle(() => {
    const base = 0.08 + index * 0.27;
    const enter = base + 0.14;
    const hold = enter + 0.16;
    const exit = index === features.length - 1 ? 1 : hold + 0.14;

    return {
      opacity: interpolate(
        progress.value,
        index === features.length - 1 ? [base, enter, 1] : [base, enter, hold, exit],
        index === features.length - 1 ? [0, 1, 1] : [0, 1, 1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            progress.value,
            index === features.length - 1 ? [base, enter, hold, 1] : [base, enter, hold, exit],
            index === features.length - 1 ? [180, 0, -8, -22] : [180, 0, 0, -210],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(progress.value, [base, enter, hold], [22, 0, 0], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(
            progress.value,
            index === features.length - 1 ? [base, enter, 1] : [base, enter, exit],
            index === features.length - 1 ? [0.94, 1, 0.98] : [0.94, 1, 0.96],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [index, progress]);

  return (
    <Animated.View className="absolute inset-0" style={cardStyle}>
      <FeatureCard
        eyebrow={feature.eyebrow}
        title={feature.title}
        body={feature.body}
        detail={feature.detail}
        compact={compact}
        variant="showcase"
      />
    </Animated.View>
  );
}

export function FeaturesScene({
  scrollY,
  layout,
  viewportHeight,
  viewportWidth,
  onLayout,
}: FeaturesSceneProps) {
  const isShortViewport = viewportHeight < 900;
  const isVeryShortViewport = viewportHeight < 780;
  const isPinnedScene = process.env.EXPO_OS === 'web' && viewportWidth >= 1040 && viewportHeight >= 720;
  const isCompactScene = viewportWidth < 1280 || isShortViewport;
  const stickyTop = isShortViewport ? 56 : 64;
  const stickyHeight = Math.max(
    viewportHeight - stickyTop - (isVeryShortViewport ? 12 : 18),
    isVeryShortViewport ? 540 : isShortViewport ? 570 : 620,
  );
  const sectionMinHeight = isPinnedScene ? stickyHeight * (isShortViewport ? 3.05 : 3.2) : undefined;
  const fallbackCardWidth: FeatureCardWidth =
    viewportWidth >= 1180 ? '31.8%' : viewportWidth >= 900 ? '48.5%' : '100%';
  const fallbackCompact = isCompactScene || fallbackCardWidth !== '100%';
  const titleClassName = isVeryShortViewport
    ? 'text-[38px] font-bold leading-[1.02] md:text-[46px]'
    : isCompactScene
      ? 'text-[44px] font-bold leading-[1.02] md:text-[56px]'
      : 'text-[48px] font-bold leading-[1.02] md:text-[64px]';
  const bodyClassName = isCompactScene ? 'text-base leading-7' : 'text-base leading-8 md:text-lg';
  const progress = usePinnedSceneProgress(scrollY, layout, viewportHeight);

  const frameStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.value, [0, 0.16], [18, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14], [0.76, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 0.18], [22, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.34, 1], [0.14, 0.22, 0.16], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-28, 34], Extrapolation.CLAMP),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [-12, 20], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View
      nativeID={featuresSection.id}
      onLayout={onLayout}
      className="relative w-full border-b border-border bg-primary/10"
      style={{ minHeight: sectionMinHeight }}
    >
      <View style={{ minHeight: sectionMinHeight }}>
        <StickyFrame enabled={isPinnedScene} top={stickyTop} height={stickyHeight}>
          <Animated.View
            className={`relative overflow-hidden px-5 ${isCompactScene ? 'py-8 md:px-7 md:py-10' : 'py-10 md:px-8 md:py-12'}`}
            style={[
              {
                minHeight: isPinnedScene ? stickyHeight : undefined,
              },
              frameStyle,
            ]}
          >
            <Animated.View
              className="absolute -left-12 top-8 h-56 w-56 rounded-full bg-primary"
              style={[{ opacity: 0.14 }, glowStyle]}
            />

            <View className={`relative z-10 mx-auto flex h-full w-full max-w-[1200px] flex-col justify-center ${isCompactScene ? 'gap-8' : 'gap-10'} md:flex-row md:items-center md:justify-between`}>
              <Animated.View className="md:w-[34%]" style={copyStyle}>
                <View className={isCompactScene ? 'gap-4' : 'gap-5'}>
                  <SemanticText as="p" className="text-xs font-bold uppercase tracking-[2px] text-muted">
                    {featuresSection.eyebrow}
                  </SemanticText>
                  <SemanticText as="h2" className={titleClassName}>
                    {featuresSection.title}
                  </SemanticText>
                  {featuresSection.body.map((paragraph) => (
                    <SemanticText key={paragraph} as="p" className={`${bodyClassName} text-foreground`}>
                      {paragraph}
                    </SemanticText>
                  ))}
                </View>
              </Animated.View>

              <View className="md:w-[61%]">
                {isPinnedScene ? (
                  <View
                    className="relative"
                    style={{
                      minHeight: isVeryShortViewport ? 420 : isShortViewport ? 456 : 520,
                    }}
                  >
                    {features.map((feature, index) => (
                      <PinnedFeatureCard
                        key={feature.id}
                        feature={feature}
                        index={index}
                        progress={progress}
                        compact={isCompactScene}
                      />
                    ))}
                  </View>
                ) : (
                  <View className={`flex-row flex-wrap justify-between ${isCompactScene ? 'gap-3' : 'gap-4'}`}>
                    {features.map((feature) => (
                      <View key={feature.id} style={{ width: fallbackCardWidth }}>
                        <FeatureCard
                          eyebrow={feature.eyebrow}
                          title={feature.title}
                          body={feature.body}
                          detail={feature.detail}
                          compact={fallbackCompact}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </StickyFrame>
      </View>
    </View>
  );
}

import { createElement, type PropsWithChildren } from 'react';
import {
  Image,
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
  mercuryBullets,
  mercuryCallout,
  type LandingBullet,
} from '../../content/landing-content';
import {
  type SectionLayout,
  usePinnedSceneProgress,
} from './landing-motion';
import { SemanticText } from './semantic-elements';

const MERCURY_NAVY = '#272735';
const MERCURY_SURFACE = '#ffffff';
const MERCURY_BACKGROUND = '#f6f8fb';
const MERCURY_LINE = '#dce2ea';
const MERCURY_SOFT = '#eef2f7';
const MERCURY_LOGO_HORIZONTAL = '/mercury-brand-kit/mercury-brand-kit/mercury_logo_horizontal.png';
const MERCURY_LOGO_ICON = '/mercury-brand-kit/mercury-brand-kit/mercury_logo_icon.png';
type MercuryCardWidth = '100%' | '48.6%';

type MercurySceneProps = {
  scrollY: SharedValue<number>;
  layout: SectionLayout | undefined;
  viewportHeight: number;
  viewportWidth: number;
  onLayout?: (event: LayoutChangeEvent) => void;
};

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

function MercuryBulletCard({
  bullet,
  index,
  progress,
  width,
  compact,
}: {
  bullet: LandingBullet;
  index: number;
  progress: SharedValue<number>;
  width: MercuryCardWidth;
  compact: boolean;
}) {
  const cardStyle = useAnimatedStyle(() => {
    const start = index * 0.12;
    const settle = Math.min(start + 0.22, 1);

    return {
      opacity: interpolate(progress.value, [start, settle], [0.35, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(progress.value, [start, settle], [42, 0], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(progress.value, [start, settle], [0.96, 1], Extrapolation.CLAMP),
        },
      ],
    };
  }, [index, progress]);

  return (
    <Animated.View
      className="rounded-[28px] border px-5 py-5"
      style={[
        {
          width,
          minHeight: compact ? 136 : 176,
          borderColor: MERCURY_LINE,
          backgroundColor: MERCURY_SURFACE,
          boxShadow: '0 20px 46px rgba(39, 39, 53, 0.08)',
        },
        cardStyle,
      ]}
    >
      <View className="gap-3">
        <SemanticText
          as="p"
          className="text-xs font-bold uppercase tracking-[2px]"
          style={{ color: MERCURY_NAVY, opacity: 0.56 }}
        >
          0{index + 1}
        </SemanticText>
        <SemanticText
          as="h3"
          className={compact ? 'text-[17px] font-semibold leading-tight' : 'text-xl font-semibold leading-tight'}
          style={{ color: MERCURY_NAVY }}
        >
          {bullet.title}
        </SemanticText>
        <SemanticText
          as="p"
          className={compact ? 'text-sm leading-6' : 'text-base leading-7'}
          style={{ color: MERCURY_NAVY, opacity: 0.82 }}
        >
          {bullet.body}
        </SemanticText>
      </View>
    </Animated.View>
  );
}

export function MercuryScene({
  scrollY,
  layout,
  viewportHeight,
  viewportWidth,
  onLayout,
}: MercurySceneProps) {
  const isShortViewport = viewportHeight < 900;
  const isVeryShortViewport = viewportHeight < 780;
  const isPinnedScene = process.env.EXPO_OS === 'web' && viewportWidth >= 920 && viewportHeight >= 760;
  const isCompactScene = viewportWidth < 1280 || isShortViewport;
  const stickyTop = isShortViewport ? 56 : 64;
  const stickyHeight = Math.max(
    viewportHeight - stickyTop - (isVeryShortViewport ? 12 : 16),
    isVeryShortViewport ? 520 : isShortViewport ? 560 : 600,
  );
  const sectionMinHeight = isPinnedScene ? stickyHeight * (isShortViewport ? 1.74 : 1.9) : undefined;
  const bulletWidth = viewportWidth >= 1040 ? '48.6%' : '100%';
  const logoWidth = isVeryShortViewport ? 210 : isCompactScene ? 240 : 320;
  const titleClassName = isVeryShortViewport
    ? 'text-[36px] font-bold leading-[0.98] md:text-[44px]'
    : isCompactScene
      ? 'text-[40px] font-bold leading-[0.98] md:text-[50px]'
      : 'text-[44px] font-bold leading-[1] md:text-[60px]';
  const progress = usePinnedSceneProgress(scrollY, layout, viewportHeight);

  const frameStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(progress.value, [0, 0.18], [18, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14, 1], [0.7, 1, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 0.24], [28, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.04, 0.2], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(progress.value, [0.04, 0.2], [18, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.18, 0.62, 1], [0, 0.04, 0.13, 0.1, 0.02], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [184, -264], Extrapolation.CLAMP),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [-68, 118], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(progress.value, [0, 0.36, 1], [12, -4, -18], Extrapolation.CLAMP)}deg`,
      },
      {
        scale: interpolate(progress.value, [0, 0.22, 0.64, 1], [0.84, 1, 1.06, 1.18], Extrapolation.CLAMP),
      },
    ],
  }));

  const accentOrbStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35, 1], [0.4, 0.64, 0.5], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-40, 52], Extrapolation.CLAMP),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [-18, 22], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <View
      nativeID={mercuryCallout.id}
      onLayout={onLayout}
      className="relative w-full border-b"
      style={{
        minHeight: sectionMinHeight,
        backgroundColor: MERCURY_BACKGROUND,
        borderBottomColor: MERCURY_LINE,
      }}
    >
      <View style={{ minHeight: sectionMinHeight }}>
        <StickyFrame enabled={isPinnedScene} top={stickyTop} height={stickyHeight}>
          <Animated.View
            className={`relative w-full border-y px-5 ${isCompactScene ? 'py-5 md:px-7 md:py-6' : 'py-6 md:px-8 md:py-8'}`}
            style={[
              {
                minHeight: isPinnedScene ? stickyHeight : undefined,
                backgroundColor: MERCURY_BACKGROUND,
                borderColor: MERCURY_LINE,
              },
              frameStyle,
            ]}
          >
            <View className="absolute inset-0 overflow-hidden">
              <Animated.View
                className="absolute left-[-80px] top-[72px] h-64 w-64 rounded-full"
                style={[
                  {
                    backgroundColor: MERCURY_SOFT,
                  },
                  accentOrbStyle,
                ]}
              />

              <Animated.View
                className="absolute right-[-120px] top-1/2"
                style={[
                  {
                    marginTop: -220,
                  },
                  iconStyle,
                ]}
              >
                <Image
                  source={{ uri: MERCURY_LOGO_ICON }}
                  style={{ width: 440, height: 440 }}
                  resizeMode="contain"
                  accessibilityLabel="Mercury icon watermark"
                />
              </Animated.View>
            </View>

            <View className={`relative z-10 mx-auto flex h-full w-full max-w-[1400px] flex-col justify-center ${isCompactScene ? 'gap-7 md:gap-8' : 'gap-8 md:gap-10'} md:flex-row md:items-center md:justify-between`}>
              <Animated.View className="md:w-[41%]" style={copyStyle}>
                <View className={isCompactScene ? 'gap-3.5' : 'gap-5'}>
                  <Animated.View
                    className="self-start rounded-full px-4 py-2"
                    style={[
                      {
                        backgroundColor: '#e8edf6',
                      },
                      badgeStyle,
                    ]}
                  >
                    <SemanticText
                      as="p"
                      className="text-xs font-bold uppercase tracking-[2px]"
                      style={{ color: MERCURY_NAVY }}
                    >
                      Mercury integration
                    </SemanticText>
                  </Animated.View>

                  <Image
                    source={{ uri: MERCURY_LOGO_HORIZONTAL }}
                    style={{ width: logoWidth, height: isCompactScene ? 48 : 72 }}
                    resizeMode="contain"
                    accessibilityLabel="Mercury wordmark"
                  />

                  <View className={isCompactScene ? 'gap-3' : 'gap-4'}>
                    <SemanticText
                      as="p"
                      className="text-xs font-bold uppercase tracking-[2px]"
                      style={{ color: MERCURY_NAVY, opacity: 0.56 }}
                    >
                      {mercuryCallout.eyebrow}
                    </SemanticText>
                    <SemanticText
                      as="h2"
                      className={titleClassName}
                      style={{ color: MERCURY_NAVY }}
                    >
                      {mercuryCallout.title}
                    </SemanticText>
                  </View>

                  <View className={isCompactScene ? 'gap-2.5' : 'gap-4'}>
                    {(isCompactScene ? mercuryCallout.body.slice(0, 1) : mercuryCallout.body).map((paragraph) => (
                      <SemanticText
                        key={paragraph}
                        as="p"
                        className={isCompactScene ? 'text-base leading-7' : 'text-base leading-8 md:text-lg'}
                        style={{ color: MERCURY_NAVY, opacity: 0.82 }}
                      >
                        {paragraph}
                      </SemanticText>
                    ))}
                  </View>

                  <View
                    className={`rounded-[28px] border px-5 ${isCompactScene ? 'py-3.5' : 'py-4'}`}
                    style={{
                      borderColor: MERCURY_LINE,
                      backgroundColor: MERCURY_SURFACE,
                    }}
                  >
                    <View className="gap-2">
                      <SemanticText
                        as="p"
                        className="text-xs font-bold uppercase tracking-[2px]"
                        style={{ color: MERCURY_NAVY, opacity: 0.56 }}
                      >
                        Direction of travel
                      </SemanticText>
                      <SemanticText
                        as="p"
                        className={isCompactScene ? 'text-sm leading-6' : 'text-base leading-7'}
                        style={{ color: MERCURY_NAVY, opacity: 0.82 }}
                      >
                        {isCompactScene
                          ? mercuryCallout.body[1]
                          : 'Time2Pay is being shaped as a Mercury-connected invoicing and payment workspace, with more bank-aware product depth still to come.'}
                      </SemanticText>
                    </View>
                  </View>
                </View>
              </Animated.View>

              <View className="md:w-[54%]">
                <View className={`flex-row flex-wrap justify-between ${isCompactScene ? 'gap-3' : 'gap-4'}`}>
                  {mercuryBullets.map((bullet, index) => (
                    <MercuryBulletCard
                      key={bullet.id}
                      bullet={bullet}
                      index={index}
                      progress={progress}
                      width={bulletWidth}
                      compact={isCompactScene}
                    />
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        </StickyFrame>
      </View>
    </View>
  );
}

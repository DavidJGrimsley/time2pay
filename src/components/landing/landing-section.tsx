import type { PropsWithChildren } from 'react';
import type { LayoutChangeEvent, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SemanticText } from './semantic-elements';

const toneClasses = {
  default: 'bg-background',
  surface: 'bg-card',
  accent: 'bg-primary/10',
  dark: 'bg-black',
} as const;

const densityClasses = {
  default: {
    container: 'mx-auto w-full gap-8 px-6 py-16 md:px-8 md:py-24',
    title: 'text-4xl font-bold leading-tight md:text-5xl',
  },
  compact: {
    container: 'mx-auto w-full gap-6 px-5 py-10 md:px-8 md:py-14',
    title: 'text-3xl font-bold leading-tight md:text-[44px]',
  },
  tight: {
    container: 'mx-auto w-full gap-5 px-5 py-8 md:px-7 md:py-10',
    title: 'text-[30px] font-bold leading-tight md:text-[40px]',
  },
} as const;

type LandingSectionProps = PropsWithChildren<{
  id: string;
  eyebrow?: string;
  title?: string;
  tone?: keyof typeof toneClasses;
  density?: keyof typeof densityClasses;
  minHeight?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  sectionStyle?: StyleProp<ViewStyle>;
  eyebrowClassName?: string;
  titleClassName?: string;
  eyebrowStyle?: StyleProp<TextStyle>;
  titleStyle?: StyleProp<TextStyle>;
}>;

export function LandingSection({
  id,
  eyebrow,
  title,
  tone = 'default',
  density = 'default',
  minHeight,
  onLayout,
  sectionStyle,
  eyebrowClassName,
  titleClassName,
  eyebrowStyle,
  titleStyle,
  children,
}: LandingSectionProps) {
  const densityClass = densityClasses[density];

  return (
    <View
      nativeID={id}
      onLayout={onLayout}
      className={`relative w-full border-b border-border ${toneClasses[tone]}`}
      style={{ minHeight, scrollMarginTop: 88 } as ViewStyle}
    >
      <Animated.View
        className={densityClass.container}
        style={[{ maxWidth: 1120 }, sectionStyle]}
      >
        {eyebrow || title ? (
          <View className="max-w-[760px] gap-3">
            {eyebrow ? (
              <SemanticText
                as="p"
                className={`text-xs font-bold uppercase tracking-[2px] text-muted ${eyebrowClassName ?? ''}`}
                nativeStyle={eyebrowStyle}
                style={eyebrowStyle as never}
              >
                {eyebrow}
              </SemanticText>
            ) : null}
            {title ? (
              <SemanticText
                as="h2"
                className={`${densityClass.title} text-heading ${titleClassName ?? ''}`}
                nativeStyle={titleStyle}
                style={titleStyle as never}
              >
                {title}
              </SemanticText>
            ) : null}
          </View>
        ) : null}

        {children}
      </Animated.View>
    </View>
  );
}

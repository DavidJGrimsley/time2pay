import type { StyleProp, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

type FeatureCardProps = {
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
  compact?: boolean;
  variant?: 'default' | 'showcase';
  style?: StyleProp<ViewStyle>;
};

export function FeatureCard({
  eyebrow,
  title,
  body,
  detail,
  compact = false,
  variant = 'default',
  style,
}: FeatureCardProps) {
  const isShowcase = variant === 'showcase';
  const shellClassName = isShowcase
    ? compact
      ? 'h-full overflow-hidden rounded-[34px] border border-border bg-background p-6'
      : 'h-full overflow-hidden rounded-[38px] border border-border bg-background p-8 md:p-9'
    : `overflow-hidden rounded-[28px] border border-border bg-background ${compact ? 'p-5' : 'p-6'}`;
  const gapClassName = isShowcase ? (compact ? 'gap-4' : 'gap-5') : compact ? 'gap-3' : 'gap-4';
  const titleClassName = isShowcase
    ? compact
      ? 'text-[30px] font-bold leading-tight text-heading'
      : 'text-[34px] font-bold leading-tight text-heading md:text-[38px]'
    : `${compact ? 'text-xl' : 'text-2xl'} font-bold leading-tight text-heading`;
  const bodyClassName = isShowcase
    ? compact
      ? 'text-base leading-7 text-foreground'
      : 'text-lg leading-8 text-foreground'
    : `${compact ? 'text-sm leading-6' : 'text-base leading-7'} text-foreground`;
  const detailWrapperClassName = isShowcase
    ? `rounded-[24px] border border-border bg-card px-5 ${compact ? 'py-3.5' : 'py-4'}`
    : `rounded-[20px] border border-border bg-card px-4 ${compact ? 'py-2.5' : 'py-3'}`;
  const detailTextClassName = isShowcase
    ? compact
      ? 'text-sm leading-6 text-muted'
      : 'text-base leading-7 text-muted'
    : 'text-sm leading-6 text-muted';

  return (
    <Animated.View
      className={shellClassName}
      style={[{ boxShadow: '0 18px 42px rgba(15, 23, 42, 0.08)' }, style]}
    >
      <View className={gapClassName}>
        <Text className="text-xs font-bold uppercase tracking-[2px] text-muted">{eyebrow}</Text>
        <Text className={titleClassName}>{title}</Text>
        <Text className={bodyClassName}>{body}</Text>
        <View className={detailWrapperClassName}>
          <Text className={detailTextClassName}>{detail}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

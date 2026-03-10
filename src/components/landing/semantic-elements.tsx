import { createElement, type CSSProperties, type PropsWithChildren } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

const isWeb = process.env.EXPO_OS === 'web';

type SemanticViewTag = 'div' | 'header' | 'footer' | 'section';
type SemanticTextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span';

type SemanticViewProps = PropsWithChildren<{
  as: SemanticViewTag;
  className?: string;
  style?: CSSProperties | StyleProp<ViewStyle>;
  nativeClassName?: string;
  nativeStyle?: StyleProp<ViewStyle>;
  id?: string;
}>;

type SemanticTextProps = PropsWithChildren<{
  as: SemanticTextTag;
  className?: string;
  style?: CSSProperties | StyleProp<TextStyle>;
  nativeClassName?: string;
  nativeStyle?: StyleProp<TextStyle>;
}>;

export function SemanticView({
  as,
  className,
  style,
  nativeClassName,
  nativeStyle,
  id,
  children,
}: SemanticViewProps) {
  if (isWeb) {
    return createElement(as, { className, id, style: style as CSSProperties }, children);
  }

  return (
    <View nativeID={id} className={nativeClassName ?? className} style={nativeStyle ?? (style as StyleProp<ViewStyle>)}>
      {children}
    </View>
  );
}

export function SemanticText({
  as,
  className,
  style,
  nativeClassName,
  nativeStyle,
  children,
}: SemanticTextProps) {
  if (isWeb) {
    return createElement(as, { className, style: style as CSSProperties }, children);
  }

  return (
    <Text className={nativeClassName ?? className} style={nativeStyle ?? (style as StyleProp<TextStyle>)}>
      {children}
    </Text>
  );
}

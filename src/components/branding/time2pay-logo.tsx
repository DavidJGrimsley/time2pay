import { useId, type ComponentProps } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
  type SvgProps,
} from 'react-native-svg';
import Animated from 'react-native-reanimated';
import {
  TIME2PAY_DOLLAR_PATH,
  TIME2PAY_HOUR_HAND_PATH,
  TIME2PAY_MINUTE_HAND_PATH,
  TIME2PAY_TOUPEE_PATH,
} from './time2pay-logo-paths';
import {
  getClockHandAngles,
  getDollarFillClip,
  TIME2PAY_DOLLAR_FILL_BOUNDS,
  type Time2PayLogoBadge,
} from './time2pay-logo-motion';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export const TIME2PAY_LOGO_CENTER_X = 354.6673;
export const TIME2PAY_LOGO_CENTER_Y = 370.74576;
// The supplied hour hand is drawn at roughly the two-o'clock angle. This
// offset lets the same artwork represent a true 12 o'clock at zero rotation.
export const TIME2PAY_HOUR_ARTWORK_OFFSET = -57.7;

const ROOT_TRANSFORM = 'matrix(0.85378591 0 0 0.76138175 -49.284531 7.3962117)';
const TICK_TRANSFORMS = [
  undefined,
  'matrix(0.86602536 0.56068189 -0.44588564 0.86602537 213.60744 -151.18959)',
  'matrix(0.5 0.97112948 -0.77229661 0.5 466.01018 -162.35777)',
  'matrix(0 1.1213638 -0.89177127 0 689.5771 -30.512081)',
  'matrix(-0.5 0.97112948 -0.77229661 -0.5 824.40363 209.01957)',
  'matrix(-0.86602536 0.56068189 -0.44588564 -0.86602537 834.36311 492.05485)',
  'rotate(180 358.39345 371.37735)',
  'matrix(-0.86602536 -0.56068189 0.44588564 -0.86602537 503.17946 893.94429)',
  'matrix(-0.5 -0.97112948 0.77229661 -0.5 250.77672 905.11247)',
  'matrix(0 -1.1213638 0.89177127 0 27.209798 773.26678)',
  'matrix(0.5 -0.97112948 0.77229661 0.5 -107.61673 533.73513)',
  'matrix(0.86602536 -0.56068189 0.44588564 0.86602537 -117.57621 250.69985)',
] as const;

type AnimatedGroupProps = ComponentProps<typeof AnimatedG>['animatedProps'];
type AnimatedRectangleProps = ComponentProps<typeof AnimatedRect>['animatedProps'];

export type Time2PayLogoProps = {
  size?: number;
  foregroundColor?: string;
  accentColor?: string;
  statusColor?: string;
  errorColor?: string;
  status?: Time2PayLogoBadge;
  accessibilityLabel?: string;
  displayTime?: Date | number;
  dollarFillProgress?: number;
  showToupee?: boolean;
  testID?: string;
  style?: SvgProps['style'];
};

type Time2PayLogoArtworkProps = Time2PayLogoProps & {
  bodyAnimatedProps?: AnimatedGroupProps;
  hourAnimatedProps?: AnimatedGroupProps;
  minuteAnimatedProps?: AnimatedGroupProps;
  dollarAnimatedProps?: AnimatedGroupProps;
  toupeeAnimatedProps?: AnimatedGroupProps;
  badgeAnimatedProps?: AnimatedGroupProps;
  dollarClipAnimatedProps?: AnimatedRectangleProps;
};

function sanitizeSvgId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

function StatusBadge({
  status,
  statusColor,
  errorColor,
}: {
  status: Time2PayLogoBadge;
  statusColor: string;
  errorColor: string;
}) {
  if (status === 'none') return null;

  const fill = status === 'error' ? errorColor : statusColor;

  return (
    <G pointerEvents="none">
      <Circle cx={440} cy={414} r={39} fill={fill} stroke="#ffffff" strokeWidth={6} />
      {status === 'pause' ? (
        <>
          <Rect x={425} y={395} width={10} height={38} rx={4} fill="#ffffff" />
          <Rect x={445} y={395} width={10} height={38} rx={4} fill="#ffffff" />
        </>
      ) : null}
      {status === 'in' ? (
        <>
          <SvgText x={420} y={421} fill="#ffffff" fontSize={22} fontWeight="800" textAnchor="middle">
            IN
          </SvgText>
          <Path
            d="M 439 415 L 449 425 L 464 403"
            fill="none"
            stroke="#ffffff"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {status === 'out' ? (
        <SvgText x={440} y={421} fill="#ffffff" fontSize={18} fontWeight="800" textAnchor="middle">
          OUT
        </SvgText>
      ) : null}
      {status === 'error' ? (
        <>
          <Rect x={435} y={391} width={10} height={29} rx={5} fill="#ffffff" />
          <Circle cx={440} cy={431} r={5} fill="#ffffff" />
        </>
      ) : null}
    </G>
  );
}

export function Time2PayLogoArtwork({
  size = 256,
  foregroundColor = '#1a1f16',
  accentColor = '#79d279',
  statusColor = '#25834c',
  errorColor = '#dc2626',
  status = 'none',
  accessibilityLabel = 'Time2Pay logo',
  displayTime,
  dollarFillProgress = 1,
  showToupee = true,
  testID,
  style,
  bodyAnimatedProps,
  hourAnimatedProps,
  minuteAnimatedProps,
  dollarAnimatedProps,
  toupeeAnimatedProps,
  badgeAnimatedProps,
  dollarClipAnimatedProps,
}: Time2PayLogoArtworkProps) {
  const generatedId = useId();
  const dollarClipId = `time2pay-dollar-fill-${sanitizeSvgId(generatedId)}`;
  const handAngles = getClockHandAngles(displayTime ?? new Date());
  const dollarClip = getDollarFillClip(dollarFillProgress);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
      testID={testID}
      style={[{ overflow: 'visible' }, style]}
    >
      <Defs>
        <ClipPath id={dollarClipId}>
          <AnimatedRect
            x={TIME2PAY_DOLLAR_FILL_BOUNDS.x}
            y={dollarClip.y}
            width={TIME2PAY_DOLLAR_FILL_BOUNDS.width}
            height={dollarClip.height}
            animatedProps={dollarClipAnimatedProps}
          />
        </ClipPath>
      </Defs>

      <G transform={ROOT_TRANSFORM} pointerEvents="none">
        <AnimatedG
          animatedProps={bodyAnimatedProps}
          originX={TIME2PAY_LOGO_CENTER_X}
          originY={TIME2PAY_LOGO_CENTER_Y}
          pointerEvents="none"
        >
          <Ellipse
            cx={TIME2PAY_LOGO_CENTER_X}
            cy={TIME2PAY_LOGO_CENTER_Y}
            rx={211.41132}
            ry={237.06898}
            fill="none"
            stroke={foregroundColor}
            strokeWidth={12.4029}
          />
          {TICK_TRANSFORMS.map((transform, index) => (
            <Line
              key={index}
              x1={354.60719}
              y1={157.45082}
              x2={354.7274}
              y2={199.59474}
              stroke={foregroundColor}
              strokeWidth={10.4302}
              strokeLinecap="round"
              transform={transform}
            />
          ))}

          <AnimatedG
            animatedProps={hourAnimatedProps}
            rotation={handAngles.hour + TIME2PAY_HOUR_ARTWORK_OFFSET}
            originX={TIME2PAY_LOGO_CENTER_X}
            originY={TIME2PAY_LOGO_CENTER_Y}
            pointerEvents="none"
          >
            <Path d={TIME2PAY_HOUR_HAND_PATH} fill={foregroundColor} />
          </AnimatedG>
          <AnimatedG
            animatedProps={minuteAnimatedProps}
            rotation={handAngles.minute}
            originX={TIME2PAY_LOGO_CENTER_X}
            originY={TIME2PAY_LOGO_CENTER_Y}
            pointerEvents="none"
          >
            <Path d={TIME2PAY_MINUTE_HAND_PATH} fill={foregroundColor} />
          </AnimatedG>

          <AnimatedG
            animatedProps={dollarAnimatedProps}
            originX={TIME2PAY_LOGO_CENTER_X}
            originY={TIME2PAY_LOGO_CENTER_Y}
            pointerEvents="none"
          >
            <Path d={TIME2PAY_DOLLAR_PATH} fill={foregroundColor} opacity={0.15} />
            <Path d={TIME2PAY_DOLLAR_PATH} fill={accentColor} clipPath={`url(#${dollarClipId})`} />
          </AnimatedG>
        </AnimatedG>

        {showToupee ? (
          <AnimatedG
            animatedProps={toupeeAnimatedProps}
            originX={TIME2PAY_LOGO_CENTER_X}
            originY={180}
            pointerEvents="none"
          >
            <Path d={TIME2PAY_TOUPEE_PATH} fill={foregroundColor} />
          </AnimatedG>
        ) : null}
      </G>

      <AnimatedG animatedProps={badgeAnimatedProps} pointerEvents="none">
        <StatusBadge status={status} statusColor={statusColor} errorColor={errorColor} />
      </AnimatedG>
    </Svg>
  );
}

export function Time2PayLogo(props: Time2PayLogoProps) {
  return <Time2PayLogoArtwork {...props} />;
}

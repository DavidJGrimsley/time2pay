import { useEffect, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  TIME2PAY_HOUR_ARTWORK_OFFSET,
  TIME2PAY_LOGO_CENTER_X,
  TIME2PAY_LOGO_CENTER_Y,
  Time2PayLogoArtwork,
  type Time2PayLogoProps,
} from './time2pay-logo';
import {
  getClockHandAngles,
  getDollarFillClip,
  getLogoAccessibilityLabel,
  getLogoBadge,
  getMinuteFillProgress,
  getSessionMinuteFillProgress,
  isFiniteLogoState,
  isPendingLogoState,
  resolveLogoDate,
  TIME2PAY_LOGO_MOTION_METRICS,
  type Time2PayLogoMotion,
  type Time2PayLogoState,
  type Time2PayStableLogoState,
} from './time2pay-logo-motion';

const FAST_EASE = Easing.bezier(0.3, 0, 0.2, 1);
const LANDING_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const CLUNK_EASE = Easing.bezier(0.68, -0.35, 0.32, 1.35);

export type AnimatedTime2PayLogoProps = Omit<
  Time2PayLogoProps,
  'displayTime' | 'dollarFillProgress' | 'showToupee' | 'status'
> & {
  state: Time2PayLogoState;
  displayTime?: Date | number;
  sessionElapsedSeconds?: number;
  alarmTime?: Date | number;
  motion?: Time2PayLogoMotion;
  replayKey?: string | number;
  previousStableState?: Time2PayStableLogoState;
  landingFlightDistance?: number;
  onAnimationComplete?: (state: Time2PayLogoState) => void;
};

function durationForState(state: Time2PayLogoState, reducedMotion: boolean): number {
  if (reducedMotion) return isFiniteLogoState(state) ? 140 : 0;

  switch (state) {
    case 'landing-spin':
      return 1050;
    case 'landing-toupee':
      return 1820;
    case 'alarm':
      return 1540;
    case 'clock-in-success':
      return 1080;
    case 'pause-success':
      return 560;
    case 'resume-success':
      return 720;
    case 'clock-out-success':
      return 1120;
    case 'error':
      return 620;
    default:
      return 0;
  }
}

export function AnimatedTime2PayLogo({
  state,
  displayTime,
  sessionElapsedSeconds,
  alarmTime,
  motion = 'system',
  replayKey = 0,
  previousStableState = 'clocked-out-idle',
  landingFlightDistance = 560,
  onAnimationComplete,
  accessibilityLabel,
  ...logoProps
}: AnimatedTime2PayLogoProps) {
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = motion === 'reduced' || (motion === 'system' && systemReducedMotion);
  const displayTimestamp = displayTime instanceof Date ? displayTime.getTime() : displayTime;
  const alarmTimestamp = alarmTime instanceof Date ? alarmTime.getTime() : alarmTime;
  const initialDate = resolveLogoDate(displayTimestamp);
  const initialAngles = getClockHandAngles(initialDate);
  const initialMinuteFill =
    sessionElapsedSeconds === undefined
      ? getMinuteFillProgress(initialDate)
      : getSessionMinuteFillProgress(sessionElapsedSeconds);

  const hourRotation = useSharedValue(initialAngles.hour + TIME2PAY_HOUR_ARTWORK_OFFSET);
  const minuteRotation = useSharedValue(initialAngles.minute);
  const bodyTranslateX = useSharedValue(0);
  const bodyScaleX = useSharedValue(1);
  const bodyScaleY = useSharedValue(1);
  const dollarProgress = useSharedValue(
    state === 'clocked-in-idle' || state === 'paused-idle' ? initialMinuteFill : 0,
  );
  const dollarTranslateY = useSharedValue(0);
  const dollarScale = useSharedValue(1);
  const toupeeTranslateX = useSharedValue(0);
  const toupeeTranslateY = useSharedValue(0);
  const toupeeRotation = useSharedValue(0);
  const toupeeOpacity = useSharedValue(state === 'landing-spin' ? 0 : 1);
  const badgeOpacity = useSharedValue(getLogoBadge(state) === 'none' ? 0 : 1);
  const previousStateRef = useRef<Time2PayLogoState>(state);
  const completionRef = useRef(onAnimationComplete);
  const sessionElapsedSecondsRef = useRef(sessionElapsedSeconds);

  useEffect(() => {
    completionRef.current = onAnimationComplete;
  }, [onAnimationComplete]);

  useEffect(() => {
    sessionElapsedSecondsRef.current = sessionElapsedSeconds;
  }, [sessionElapsedSeconds]);

  const bodyAnimatedProps = useAnimatedProps(() => ({
    translateX: bodyTranslateX.get(),
    scaleX: bodyScaleX.get(),
    scaleY: bodyScaleY.get(),
    originX: TIME2PAY_LOGO_CENTER_X,
    originY: TIME2PAY_LOGO_CENTER_Y,
  }));

  const hourAnimatedProps = useAnimatedProps(() => ({
    rotation: hourRotation.get(),
    originX: TIME2PAY_LOGO_CENTER_X,
    originY: TIME2PAY_LOGO_CENTER_Y,
  }));

  const minuteAnimatedProps = useAnimatedProps(() => ({
    rotation: minuteRotation.get(),
    originX: TIME2PAY_LOGO_CENTER_X,
    originY: TIME2PAY_LOGO_CENTER_Y,
  }));

  const dollarAnimatedProps = useAnimatedProps(() => ({
    translateY: dollarTranslateY.get(),
    scale: dollarScale.get(),
    originX: TIME2PAY_LOGO_CENTER_X,
    originY: 375,
  }));

  const toupeeAnimatedProps = useAnimatedProps(() => ({
    translateX: toupeeTranslateX.get(),
    translateY: toupeeTranslateY.get(),
    rotation: toupeeRotation.get(),
    opacity: toupeeOpacity.get(),
    originX: TIME2PAY_LOGO_CENTER_X,
    originY: 180,
  }));

  const badgeAnimatedProps = useAnimatedProps(() => ({
    opacity: badgeOpacity.get(),
  }));

  const dollarClipAnimatedProps = useAnimatedProps(() => {
    return getDollarFillClip(dollarProgress.get());
  });

  useEffect(() => {
    const animatedValues = [
      hourRotation,
      minuteRotation,
      bodyTranslateX,
      bodyScaleX,
      bodyScaleY,
      dollarProgress,
      dollarTranslateY,
      dollarScale,
      toupeeTranslateX,
      toupeeTranslateY,
      toupeeRotation,
      toupeeOpacity,
      badgeOpacity,
    ];
    animatedValues.forEach((value) => cancelAnimation(value));

    const previousState = previousStateRef.current;
    previousStateRef.current = state;
    const settleDuration = isPendingLogoState(previousState) && previousState !== state ? 180 : 0;
    const settle = (value: typeof bodyTranslateX, target: number) => {
      value.set(settleDuration > 0 ? withTiming(target, { duration: settleDuration, easing: FAST_EASE }) : target);
    };

    settle(bodyTranslateX, 0);
    settle(bodyScaleX, 1);
    settle(bodyScaleY, 1);
    const boundaryAngles = getClockHandAngles(resolveLogoDate(displayTimestamp));
    settle(hourRotation, boundaryAngles.hour + TIME2PAY_HOUR_ARTWORK_OFFSET);
    settle(minuteRotation, boundaryAngles.minute);
    settle(dollarTranslateY, 0);
    settle(dollarScale, 1);
    settle(toupeeTranslateX, 0);
    settle(toupeeTranslateY, 0);
    settle(toupeeRotation, 0);
    settle(toupeeOpacity, state === 'landing-spin' || (reducedMotion && state === 'landing-toupee') ? 0 : 1);
    settle(badgeOpacity, getLogoBadge(state) === 'none' ? 0 : 1);

    let phaseTimer: ReturnType<typeof setTimeout> | undefined;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;

    const runPhase = () => {
      const now = resolveLogoDate(displayTimestamp);
      const nowAngles = getClockHandAngles(now);
      const targetHour = nowAngles.hour + TIME2PAY_HOUR_ARTWORK_OFFSET;
      const targetMinute = nowAngles.minute;
      const minuteFill =
        sessionElapsedSecondsRef.current === undefined
          ? getMinuteFillProgress(now)
          : getSessionMinuteFillProgress(sessionElapsedSecondsRef.current);
      const alarmAngles = getClockHandAngles(resolveLogoDate(alarmTimestamp));

      if (reducedMotion) {
        hourRotation.set(targetHour);
        minuteRotation.set(targetMinute);
        dollarProgress.set(
          state === 'clocked-in-idle' || state === 'clock-in-success' || state === 'resume-success'
            ? minuteFill
            : previousStableState !== 'clocked-out-idle' && state === 'error'
              ? minuteFill
              : 0,
        );
        toupeeOpacity.set(withTiming(state === 'landing-spin' ? 0 : 1, { duration: 140 }));
        badgeOpacity.set(withTiming(getLogoBadge(state) === 'none' ? 0 : 1, { duration: 140 }));
        return;
      }

      switch (state) {
        case 'static':
          hourRotation.set(targetHour);
          minuteRotation.set(targetMinute);
          dollarProgress.set(1);
          break;
        case 'clocked-out-idle':
          hourRotation.set(targetHour);
          minuteRotation.set(targetMinute);
          dollarProgress.set(0);
          break;
        case 'clocked-in-idle':
          hourRotation.set(targetHour);
          minuteRotation.set(targetMinute);
          dollarProgress.set(minuteFill);
          break;
        case 'paused-idle':
          hourRotation.set(targetHour);
          minuteRotation.set(targetMinute);
          dollarProgress.set(minuteFill);
          break;
        case 'landing-spin':
          hourRotation.set(targetHour - 720);
          minuteRotation.set(targetMinute - 720);
          hourRotation.set(withTiming(targetHour, { duration: 1050, easing: LANDING_EASE }));
          minuteRotation.set(withTiming(targetMinute, { duration: 1050, easing: LANDING_EASE }));
          dollarProgress.set(0);
          break;
        case 'landing-toupee': {
          const flight = Math.max(440, landingFlightDistance);
          hourRotation.set(targetHour);
          minuteRotation.set(targetMinute);
          dollarProgress.set(0);
          toupeeTranslateY.set(-flight);
          toupeeTranslateX.set(-18);
          toupeeRotation.set(-14);
          toupeeOpacity.set(1);
          toupeeTranslateY.set(
            withSequence(
              withTiming(-flight * 0.58, {
                duration: 360,
                easing: Easing.in(Easing.quad),
              }),
              withTiming(-flight * 0.25, {
                duration: 520,
                easing: Easing.linear,
              }),
              withTiming(-44, {
                duration: 360,
                easing: Easing.in(Easing.cubic),
              }),
              withTiming(0, { duration: 210, easing: CLUNK_EASE }),
            ),
          );
          toupeeTranslateX.set(
            withSequence(
              withTiming(22, { duration: 330 }),
              withTiming(-16, { duration: 410 }),
              withTiming(11, { duration: 370 }),
              withTiming(0, { duration: 340 }),
            ),
          );
          toupeeRotation.set(
            withSequence(
              withTiming(9, { duration: 520 }),
              withTiming(-7, { duration: 560 }),
              withTiming(11, { duration: 370, easing: CLUNK_EASE }),
              withTiming(-5, { duration: 130, easing: CLUNK_EASE }),
              withTiming(2.5, { duration: 110, easing: CLUNK_EASE }),
              withTiming(0, { duration: 130, easing: CLUNK_EASE }),
            ),
          );
          break;
        }
        case 'alarm': {
          const alarmHour = alarmAngles.hour + TIME2PAY_HOUR_ARTWORK_OFFSET;
          hourRotation.set(alarmHour - 1080);
          minuteRotation.set(alarmAngles.minute - 1080);
          hourRotation.set(withTiming(alarmHour, { duration: 920, easing: LANDING_EASE }));
          minuteRotation.set(
            withTiming(alarmAngles.minute, {
              duration: 920,
              easing: LANDING_EASE,
            }),
          );
          bodyTranslateX.set(
            withDelay(
              920,
              withSequence(
                withTiming(-9, { duration: 70 }),
                withTiming(9, { duration: 70 }),
                withTiming(-6, { duration: 70 }),
                withTiming(6, { duration: 70 }),
                withTiming(0, { duration: 80 }),
              ),
            ),
          );
          toupeeRotation.set(
            withDelay(
              900,
              withSequence(
                withTiming(-8, { duration: 90 }),
                withTiming(8, { duration: 90 }),
                withTiming(-4, { duration: 90 }),
                withTiming(0, { duration: 110 }),
              ),
            ),
          );
          break;
        }
        case 'clocking-in':
          dollarProgress.set(0);
          hourRotation.set(
            withRepeat(
              withSequence(
                withTiming(targetHour - 55, {
                  duration: 360,
                  easing: FAST_EASE,
                }),
                withTiming(targetHour + 360, {
                  duration: 620,
                  easing: LANDING_EASE,
                }),
                withTiming(targetHour, { duration: 220, easing: FAST_EASE }),
              ),
              -1,
              false,
            ),
          );
          minuteRotation.set(
            withRepeat(
              withSequence(
                withTiming(targetMinute - 80, {
                  duration: 360,
                  easing: FAST_EASE,
                }),
                withTiming(targetMinute + 720, {
                  duration: 620,
                  easing: LANDING_EASE,
                }),
                withTiming(targetMinute, { duration: 220, easing: FAST_EASE }),
              ),
              -1,
              false,
            ),
          );
          dollarScale.set(
            withRepeat(
              withSequence(
                withTiming(0.82, { duration: 360 }),
                withTiming(1.2, { duration: 150 }),
                withTiming(1, { duration: 690, easing: CLUNK_EASE }),
              ),
              -1,
              false,
            ),
          );
          bodyScaleY.set(
            withRepeat(withSequence(withTiming(0.94, { duration: 520 }), withTiming(1, { duration: 680 })), -1, false),
          );
          toupeeTranslateY.set(
            withRepeat(withSequence(withTiming(-12, { duration: 510 }), withTiming(0, { duration: 690 })), -1, false),
          );
          break;
        case 'clock-in-success':
          hourRotation.set(
            withTiming(targetHour + 360, {
              duration: 760,
              easing: LANDING_EASE,
            }),
          );
          minuteRotation.set(
            withTiming(targetMinute + 720, {
              duration: 760,
              easing: LANDING_EASE,
            }),
          );
          dollarScale.set(
            withSequence(
              withTiming(0.74, { duration: 100, easing: FAST_EASE }),
              withTiming(TIME2PAY_LOGO_MOTION_METRICS.clockInSuccess.dollarPunchScale, {
                duration: 160,
                easing: LANDING_EASE,
              }),
              withTiming(0.9, { duration: 170, easing: FAST_EASE }),
              withTiming(1, { duration: 350, easing: CLUNK_EASE }),
            ),
          );
          bodyScaleX.set(
            withSequence(
              withTiming(1.1, { duration: 150, easing: FAST_EASE }),
              withTiming(0.98, { duration: 180, easing: CLUNK_EASE }),
              withTiming(1, { duration: 380, easing: CLUNK_EASE }),
            ),
          );
          bodyScaleY.set(
            withSequence(
              withTiming(TIME2PAY_LOGO_MOTION_METRICS.clockInSuccess.bodySquashY, {
                duration: 150,
                easing: FAST_EASE,
              }),
              withTiming(1.08, { duration: 180, easing: CLUNK_EASE }),
              withTiming(1, { duration: 380, easing: CLUNK_EASE }),
            ),
          );
          toupeeTranslateY.set(
            withSequence(
              withTiming(TIME2PAY_LOGO_MOTION_METRICS.clockInSuccess.toupeeLiftY, {
                duration: 190,
                easing: LANDING_EASE,
              }),
              withTiming(TIME2PAY_LOGO_MOTION_METRICS.clockInSuccess.toupeeLiftY - 10, {
                duration: 90,
                easing: FAST_EASE,
              }),
              withTiming(-18, { duration: 310, easing: Easing.linear }),
              withTiming(8, { duration: 110, easing: CLUNK_EASE }),
              withTiming(-3, { duration: 120, easing: CLUNK_EASE }),
              withTiming(0, { duration: 150, easing: CLUNK_EASE }),
            ),
          );
          toupeeRotation.set(
            withSequence(
              withTiming(-9, { duration: 190, easing: LANDING_EASE }),
              withTiming(7, { duration: 400, easing: FAST_EASE }),
              withTiming(-4, { duration: 110, easing: CLUNK_EASE }),
              withTiming(2, { duration: 120, easing: CLUNK_EASE }),
              withTiming(0, { duration: 150, easing: CLUNK_EASE }),
            ),
          );
          dollarProgress.set(withDelay(230, withTiming(minuteFill, { duration: 520, easing: LANDING_EASE })));
          badgeOpacity.set(withDelay(360, withTiming(1, { duration: 180 })));
          break;
        case 'pausing':
          hourRotation.set(
            withRepeat(
              withSequence(withTiming(targetHour - 12, { duration: 380 }), withTiming(targetHour, { duration: 500 })),
              -1,
              false,
            ),
          );
          minuteRotation.set(
            withRepeat(
              withSequence(
                withTiming(targetMinute - 24, { duration: 380 }),
                withTiming(targetMinute, { duration: 500 }),
              ),
              -1,
              false,
            ),
          );
          dollarProgress.set(minuteFill);
          break;
        case 'pause-success':
          hourRotation.set(withTiming(targetHour, { duration: 360, easing: LANDING_EASE }));
          minuteRotation.set(withTiming(targetMinute, { duration: 360, easing: LANDING_EASE }));
          dollarProgress.set(minuteFill);
          badgeOpacity.set(withTiming(1, { duration: 180 }));
          break;
        case 'resuming':
          dollarProgress.set(minuteFill);
          minuteRotation.set(
            withRepeat(
              withSequence(
                withTiming(targetMinute + 42, { duration: 420 }),
                withTiming(targetMinute, { duration: 520 }),
              ),
              -1,
              false,
            ),
          );
          toupeeRotation.set(
            withRepeat(withSequence(withTiming(2.5, { duration: 420 }), withTiming(0, { duration: 520 })), -1, false),
          );
          break;
        case 'resume-success':
          hourRotation.set(
            withTiming(targetHour + 360, {
              duration: 620,
              easing: LANDING_EASE,
            }),
          );
          minuteRotation.set(
            withTiming(targetMinute + 720, {
              duration: 620,
              easing: LANDING_EASE,
            }),
          );
          dollarProgress.set(withTiming(minuteFill, { duration: 440, easing: LANDING_EASE }));
          badgeOpacity.set(withTiming(1, { duration: 160 }));
          break;
        case 'clocking-out':
          dollarProgress.set(minuteFill);
          hourRotation.set(
            withRepeat(
              withSequence(
                withTiming(targetHour + 360, {
                  duration: 760,
                  easing: LANDING_EASE,
                }),
                withTiming(targetHour, { duration: 240 }),
              ),
              -1,
              false,
            ),
          );
          minuteRotation.set(
            withRepeat(
              withSequence(
                withTiming(targetMinute + 720, {
                  duration: 760,
                  easing: LANDING_EASE,
                }),
                withTiming(targetMinute, { duration: 240 }),
              ),
              -1,
              false,
            ),
          );
          dollarTranslateY.set(
            withRepeat(
              withSequence(
                withTiming(-26, { duration: 420, easing: FAST_EASE }),
                withTiming(5, { duration: 230, easing: CLUNK_EASE }),
                withTiming(0, { duration: 350 }),
              ),
              -1,
              false,
            ),
          );
          break;
        case 'clock-out-success':
          hourRotation.set(
            withTiming(targetHour + 360, {
              duration: 720,
              easing: LANDING_EASE,
            }),
          );
          minuteRotation.set(
            withTiming(targetMinute + 720, {
              duration: 720,
              easing: LANDING_EASE,
            }),
          );
          dollarTranslateY.set(
            withSequence(
              withTiming(TIME2PAY_LOGO_MOTION_METRICS.clockOutSuccess.dollarEjectY, {
                duration: 380,
                easing: LANDING_EASE,
              }),
              withTiming(TIME2PAY_LOGO_MOTION_METRICS.clockOutSuccess.dollarEjectY - 14, {
                duration: 90,
                easing: FAST_EASE,
              }),
              withDelay(
                120,
                withTiming(TIME2PAY_LOGO_MOTION_METRICS.clockOutSuccess.finalDollarY, {
                  duration: 420,
                  easing: LANDING_EASE,
                }),
              ),
            ),
          );
          dollarScale.set(
            withSequence(
              withTiming(0.62, { duration: 380, easing: FAST_EASE }),
              withTiming(0.56, { duration: 90, easing: FAST_EASE }),
              withDelay(120, withTiming(0.9, { duration: 260, easing: LANDING_EASE })),
              withTiming(1, { duration: 160, easing: CLUNK_EASE }),
            ),
          );
          dollarProgress.set(withDelay(390, withTiming(0, { duration: 180 })));
          toupeeTranslateY.set(
            withSequence(
              withTiming(-34, { duration: 190, easing: LANDING_EASE }),
              withTiming(5, { duration: 360, easing: FAST_EASE }),
              withTiming(0, { duration: 230, easing: CLUNK_EASE }),
            ),
          );
          toupeeRotation.set(
            withSequence(
              withTiming(7, { duration: 190, easing: CLUNK_EASE }),
              withTiming(-4, { duration: 240, easing: CLUNK_EASE }),
              withTiming(2, { duration: 160, easing: CLUNK_EASE }),
              withTiming(0, { duration: 190, easing: CLUNK_EASE }),
            ),
          );
          badgeOpacity.set(withDelay(250, withTiming(1, { duration: 160 })));
          break;
        case 'error':
          dollarProgress.set(previousStableState !== 'clocked-out-idle' ? minuteFill : 0);
          bodyTranslateX.set(
            withSequence(
              withTiming(-10, { duration: 75 }),
              withTiming(10, { duration: 75 }),
              withTiming(-7, { duration: 75 }),
              withTiming(7, { duration: 75 }),
              withTiming(0, { duration: 100 }),
            ),
          );
          toupeeRotation.set(
            withSequence(withTiming(9, { duration: 180, easing: CLUNK_EASE }), withTiming(6, { duration: 220 })),
          );
          badgeOpacity.set(withTiming(1, { duration: 120 }));
          break;
      }
    };

    if (settleDuration > 0) {
      phaseTimer = setTimeout(runPhase, settleDuration);
    } else {
      runPhase();
    }

    if (isFiniteLogoState(state)) {
      completionTimer = setTimeout(
        () => {
          completionRef.current?.(state);
        },
        settleDuration + durationForState(state, reducedMotion),
      );
    }

    return () => {
      if (phaseTimer) clearTimeout(phaseTimer);
      if (completionTimer) clearTimeout(completionTimer);
      animatedValues.forEach((value) => cancelAnimation(value));
    };
  }, [
    alarmTimestamp,
    badgeOpacity,
    bodyScaleX,
    bodyScaleY,
    bodyTranslateX,
    displayTimestamp,
    dollarProgress,
    dollarScale,
    dollarTranslateY,
    hourRotation,
    landingFlightDistance,
    minuteRotation,
    previousStableState,
    reducedMotion,
    replayKey,
    state,
    toupeeOpacity,
    toupeeRotation,
    toupeeTranslateX,
    toupeeTranslateY,
  ]);

  useEffect(() => {
    if (state !== 'clocked-out-idle' && state !== 'clocked-in-idle') return undefined;
    if (displayTimestamp !== undefined) return undefined;

    const updateLiveTime = () => {
      const now = new Date();
      const angles = getClockHandAngles(now);
      hourRotation.set(
        withTiming(angles.hour + TIME2PAY_HOUR_ARTWORK_OFFSET, {
          duration: reducedMotion ? 0 : 260,
        }),
      );
      minuteRotation.set(withTiming(angles.minute, { duration: reducedMotion ? 0 : 260 }));

      if (state === 'clocked-in-idle') {
        const nextFill =
          sessionElapsedSeconds === undefined
            ? getMinuteFillProgress(now)
            : getSessionMinuteFillProgress(sessionElapsedSeconds);
        const currentFill = dollarProgress.get();
        dollarProgress.set(
          nextFill < currentFill || reducedMotion
            ? nextFill
            : withTiming(nextFill, { duration: 260, easing: Easing.linear }),
        );
      }
    };

    updateLiveTime();
    const interval = setInterval(updateLiveTime, 1000);
    return () => clearInterval(interval);
  }, [displayTimestamp, dollarProgress, hourRotation, minuteRotation, reducedMotion, sessionElapsedSeconds, state]);

  return (
    <Time2PayLogoArtwork
      {...logoProps}
      displayTime={displayTimestamp}
      showToupee={state !== 'landing-spin'}
      status={getLogoBadge(state)}
      accessibilityLabel={accessibilityLabel ?? getLogoAccessibilityLabel(state)}
      dollarFillProgress={0}
      bodyAnimatedProps={bodyAnimatedProps}
      hourAnimatedProps={hourAnimatedProps}
      minuteAnimatedProps={minuteAnimatedProps}
      dollarAnimatedProps={dollarAnimatedProps}
      toupeeAnimatedProps={toupeeAnimatedProps}
      badgeAnimatedProps={badgeAnimatedProps}
      dollarClipAnimatedProps={dollarClipAnimatedProps}
    />
  );
}

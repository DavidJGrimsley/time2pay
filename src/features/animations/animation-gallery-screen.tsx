import { Button, Host } from '@expo/ui';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AnimatedTime2PayLogo } from '@/components/branding/animated-time2pay-logo';
import {
  type Time2PayLogoMotion,
  type Time2PayLogoState,
  type Time2PayStableLogoState,
} from '@/components/branding/time2pay-logo-motion';
import type { TimerLogoAction } from '@/components/branding/timer-logo-controller';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';

const DIRECT_STATES: Time2PayLogoState[] = [
  'static',
  'clocked-out-idle',
  'clocked-in-idle',
  'paused-idle',
  'landing-spin',
  'landing-toupee',
  'alarm',
  'clock-in-success',
  'pause-success',
  'resume-success',
  'clock-out-success',
  'error',
];

const FLOW_PHASES: Record<
  TimerLogoAction,
  {
    pending: Time2PayLogoState;
    success: Time2PayLogoState;
    result: Time2PayStableLogoState;
  }
> = {
  'clock-in': {
    pending: 'clocking-in',
    success: 'clock-in-success',
    result: 'clocked-in-idle',
  },
  pause: {
    pending: 'pausing',
    success: 'pause-success',
    result: 'paused-idle',
  },
  resume: {
    pending: 'resuming',
    success: 'resume-success',
    result: 'clocked-in-idle',
  },
  'clock-out': {
    pending: 'clocking-out',
    success: 'clock-out-success',
    result: 'clocked-out-idle',
  },
};

const STATE_LABELS: Record<Time2PayLogoState, string> = {
  static: 'Static',
  alarm: 'Alarm',
  'landing-spin': 'Landing spin',
  'landing-toupee': 'Landing toupee',
  'clocked-out-idle': 'Clocked out',
  'clocking-in': 'Clocking in',
  'clock-in-success': 'Clock-in success',
  'clocked-in-idle': 'Clocked in',
  pausing: 'Pausing',
  'pause-success': 'Pause success',
  'paused-idle': 'Paused',
  resuming: 'Resuming',
  'resume-success': 'Resume success',
  'clocking-out': 'Clocking out',
  'clock-out-success': 'Clock-out success',
  error: 'Error',
};

type PreviewTheme = 'light' | 'dark';

function actionLabel(action: TimerLogoAction): string {
  return action
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AnimationGalleryScreen() {
  const { width } = useStableWindowDimensions();
  const [phase, setPhase] = useState<Time2PayLogoState>('clocked-out-idle');
  const [previousStableState, setPreviousStableState] = useState<Time2PayStableLogoState>('clocked-out-idle');
  const [activeFlow, setActiveFlow] = useState<TimerLogoAction | null>(null);
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>('light');
  const [motion, setMotion] = useState<Time2PayLogoMotion>('system');
  const [replayKey, setReplayKey] = useState(0);
  const [completionEvents, setCompletionEvents] = useState<string[]>([]);
  const previewSize = width >= 768 ? 360 : Math.min(280, Math.max(220, width - 64));
  const colors = useMemo(
    () =>
      previewTheme === 'dark'
        ? {
            background: '#11130f',
            card: '#1c2018',
            foreground: '#f8f7f3',
            muted: '#b8b9b2',
            border: '#3c4037',
            accent: '#8ae28a',
            status: '#86efac',
            danger: '#f87171',
          }
        : {
            background: '#f8f7f3',
            card: '#ffffff',
            foreground: '#1a1f16',
            muted: '#60655b',
            border: '#d9ddd3',
            accent: '#25834c',
            status: '#25834c',
            danger: '#dc2626',
          },
    [previewTheme],
  );

  const chooseState = useCallback((nextState: Time2PayLogoState) => {
    setActiveFlow(null);
    if (nextState === 'clocked-out-idle' || nextState === 'clocked-in-idle' || nextState === 'paused-idle') {
      setPreviousStableState(nextState);
    }
    setPhase(nextState);
    setReplayKey((current) => current + 1);
  }, []);

  const startFlow = useCallback(
    (action: TimerLogoAction) => {
      if (phase === 'clocked-out-idle' || phase === 'clocked-in-idle' || phase === 'paused-idle') {
        setPreviousStableState(phase);
      }
      setActiveFlow(action);
      setPhase(FLOW_PHASES[action].pending);
      setReplayKey((current) => current + 1);
    },
    [phase],
  );

  const finishFlow = useCallback(
    (outcome: 'success' | 'error') => {
      if (!activeFlow) return;
      setPhase(outcome === 'success' ? FLOW_PHASES[activeFlow].success : 'error');
    },
    [activeFlow],
  );

  const handleCompletion = useCallback(
    (completedState: Time2PayLogoState) => {
      setCompletionEvents((events) =>
        [`${new Date().toLocaleTimeString()} — ${completedState}`, ...events].slice(0, 6),
      );

      if (completedState === 'landing-spin' && activeFlow === null) {
        setPhase('landing-toupee');
        return;
      }

      if (completedState === 'landing-toupee') {
        setPreviousStableState('clocked-out-idle');
        setPhase('clocked-out-idle');
        return;
      }

      if (completedState === 'error') {
        setActiveFlow(null);
        setPhase(previousStableState);
        return;
      }

      if (activeFlow && completedState === FLOW_PHASES[activeFlow].success) {
        const result = FLOW_PHASES[activeFlow].result;
        setPreviousStableState(result);
        setActiveFlow(null);
        setPhase(result);
      }
    },
    [activeFlow, previousStableState],
  );

  const replaySequence = (sequence: 'landing' | 'alarm') => {
    setActiveFlow(null);
    setPhase(sequence === 'landing' ? 'landing-spin' : 'alarm');
    setReplayKey((current) => current + 1);
  };

  const reset = () => {
    setActiveFlow(null);
    setPreviousStableState('clocked-out-idle');
    setPhase('clocked-out-idle');
    setReplayKey((current) => current + 1);
    setCompletionEvents([]);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="items-center px-4 py-8 md:px-8 md:py-12"
      contentInsetAdjustmentBehavior="automatic"
    >
      <View className="w-full max-w-[1040px] gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-black text-heading md:text-5xl">Logo animation lab</Text>
          <Text className="max-w-[760px] text-base leading-7 text-muted">
            An unlisted test surface for each deterministic logo state. Only this preview is live; controls and phase
            text remain the primary feedback.
          </Text>
        </View>

        <View
          className="items-center justify-center overflow-hidden rounded-[28px] border p-6 md:p-10"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            minHeight: previewSize + 80,
          }}
          testID="animation-preview"
        >
          <AnimatedTime2PayLogo
            state={phase}
            previousStableState={previousStableState}
            size={previewSize}
            motion={motion}
            replayKey={replayKey}
            alarmTime={new Date(2026, 0, 1, 7, 30)}
            foregroundColor={colors.foreground}
            accentColor={colors.accent}
            statusColor={colors.status}
            errorColor={colors.danger}
            landingFlightDistance={620}
            onAnimationComplete={handleCompletion}
            testID="animation-live-logo"
          />
        </View>

        <View className="flex-col gap-4 md:flex-row">
          <View className="flex-1 rounded-2xl border border-border bg-card p-4">
            <Text className="text-xs font-bold uppercase tracking-[1.5px] text-muted">Current phase</Text>
            <Text className="mt-1 text-xl font-bold text-heading" testID="animation-current-phase">
              {phase}
            </Text>
            <Text className="mt-1 text-sm text-muted">
              Flow: {activeFlow ?? 'direct preview'} · Motion: {motion} · Theme: {previewTheme}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl border border-border bg-card p-4">
            <Text className="text-xs font-bold uppercase tracking-[1.5px] text-muted">Completion events</Text>
            <Text className="mt-1 text-sm leading-6 text-foreground" testID="animation-events">
              {completionEvents.length ? completionEvents.join('\n') : 'No finite animation has completed yet.'}
            </Text>
          </View>
        </View>

        <Host matchContents colorScheme={previewTheme} seedColor={colors.accent}>
          <View className="gap-6">
            <View className="gap-3 rounded-2xl border border-border bg-card p-4">
              <Text className="text-lg font-bold text-heading">Preview state</Text>
              <View className="flex-row flex-wrap gap-2">
                {DIRECT_STATES.map((state) => (
                  <Button
                    key={state}
                    label={STATE_LABELS[state]}
                    variant={phase === state ? 'filled' : 'outlined'}
                    onPress={() => chooseState(state)}
                    testID={`animation-state-${state}`}
                  />
                ))}
              </View>
            </View>

            <View className="gap-3 rounded-2xl border border-border bg-card p-4">
              <Text className="text-lg font-bold text-heading">Replay sequences</Text>
              <View className="flex-row flex-wrap gap-2">
                <Button label="Replay landing" onPress={() => replaySequence('landing')} />
                <Button label="Replay alarm" onPress={() => replaySequence('alarm')} />
              </View>
            </View>

            <View className="gap-3 rounded-2xl border border-border bg-card p-4">
              <Text className="text-lg font-bold text-heading">Timer flows</Text>
              {(['clock-in', 'pause', 'resume', 'clock-out'] as TimerLogoAction[]).map((action) => (
                <View key={action} className="gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <Text className="font-semibold text-heading">{actionLabel(action)}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    <Button label="Start" onPress={() => startFlow(action)} />
                    <Button
                      label="Succeed"
                      variant="outlined"
                      disabled={activeFlow !== action}
                      onPress={() => finishFlow('success')}
                    />
                    <Button
                      label="Fail"
                      variant="outlined"
                      disabled={activeFlow !== action}
                      onPress={() => finishFlow('error')}
                    />
                    <Button label="Reset" variant="text" onPress={reset} />
                  </View>
                </View>
              ))}
            </View>

            <View className="flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:flex-row">
              <View className="flex-1 gap-3">
                <Text className="text-lg font-bold text-heading">Preview theme</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['light', 'dark'] as PreviewTheme[]).map((theme) => (
                    <Button
                      key={theme}
                      label={theme === 'light' ? 'Light' : 'Dark'}
                      variant={previewTheme === theme ? 'filled' : 'outlined'}
                      onPress={() => setPreviewTheme(theme)}
                    />
                  ))}
                </View>
              </View>
              <View className="flex-1 gap-3">
                <Text className="text-lg font-bold text-heading">Motion</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['system', 'full', 'reduced'] as Time2PayLogoMotion[]).map((mode) => (
                    <Button
                      key={mode}
                      label={mode.charAt(0).toUpperCase() + mode.slice(1)}
                      variant={motion === mode ? 'filled' : 'outlined'}
                      onPress={() => setMotion(mode)}
                    />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Host>
      </View>
    </ScrollView>
  );
}

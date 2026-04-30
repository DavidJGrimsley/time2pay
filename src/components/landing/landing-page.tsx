import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Octicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedRef,
  useScrollOffset,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ctaSection,
  footerLinks,
  githubBullets,
  heroSection,
  MERCURY_REFERRAL_URL,
  pricingBullets,
  workflowSection,
  type LandingBullet,
  type LandingCta,
} from '../../content/landing-content';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import { FeaturesScene } from './features-scene';
import { LandingFooter } from './landing-footer';
import { LandingHeader } from './landing-header';
import { MercuryScene } from './mercury-scene';
import {
  type SectionLayout,
  useHeroPieceStyle,
  useParallaxStyle,
  useSectionRevealStyle,
} from './landing-motion';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { logRuntimeDiagnostic } from '@/services/runtime-diagnostics';
import { trackMercuryReferralClick } from '@/services/mercury-referrals';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import { LandingSection } from './landing-section';
import { SemanticText } from './semantic-elements';

type PercentageWidth = '100%' | '48.5%' | '31.8%';

function SectionBody({
  paragraphs,
  textClassName,
  textStyle,
  compact = false,
}: {
  paragraphs: string[];
  textClassName?: string;
  textStyle?: { opacity?: number };
  compact?: boolean;
}) {
  const baseTextClassName = compact ? 'text-base leading-7 md:text-base' : 'text-base leading-8 md:text-lg';

  return (
    <View className="max-w-[680px] gap-4">
      {paragraphs.map((paragraph) => (
        <SemanticText
          key={paragraph}
          as="p"
          className={`${baseTextClassName} text-foreground ${textClassName ?? ''}`}
          style={textStyle}
        >
          {paragraph}
        </SemanticText>
      ))}
    </View>
  );
}

function HeroStage({
  style,
  compact,
  stepCardStyle,
}: {
  style?: ReturnType<typeof useParallaxStyle>;
  compact: boolean;
  stepCardStyle: { width: PercentageWidth };
}) {
  const workflowSteps = [
    {
      title: 'Connect GitHub',
      body: 'Start from a repo URL or connected GitHub access and map owner, repo, and branch into your customer, project, and task records.',
    },
    {
      title: 'Track the work',
      body: 'Keep the timer, notes, commits, and pull requests tied to the same billable session while the work is moving.',
    },
    {
      title: 'Show the proof',
      body: 'Carry that GitHub context into invoices and PDFs so the client can trace billed time back to shipped work.',
    },
  ];

  return (
    <Animated.View className="w-full" style={style}>
      <View
        className={`overflow-hidden rounded-[32px] border border-border bg-card ${compact ? 'p-5 md:p-6' : 'p-6 md:p-8'}`}
        style={{ boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)' }}
      >
        <View className="flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <View className="flex-row items-center gap-3 md:max-w-[520px]">
            <View className="h-12 w-12 items-center justify-center rounded-[16px] bg-[#24292f]">
              <Octicons name="mark-github" size={24} color="#ffffff" />
            </View>
            <View>
              <Text className="text-sm font-semibold text-heading">GitHub integration</Text>
              <Text className="text-sm text-muted">Optional developer workflow for repo-aware billing proof</Text>
            </View>
          </View>

          <View className="self-start rounded-full border border-border bg-background px-3 py-1.5">
            <SemanticText as="span" className="text-xs font-bold uppercase tracking-[2px] text-muted">
              Optional for developers
            </SemanticText>
          </View>
        </View>

        <View className={`mt-5 flex-row flex-wrap justify-between ${compact ? 'gap-2.5' : 'gap-3'}`}>
          {workflowSteps.map((step, index) => (
            <View key={step.title} style={stepCardStyle}>
              <View
                className={`rounded-[24px] border border-border bg-background ${compact ? 'px-4 py-3.5' : 'px-4 py-4'}`}
              >
                <View className={`gap-3 ${stepCardStyle.width === '100%' ? 'md:flex-row md:items-start' : ''}`}>
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
                    <Text className="text-sm font-bold text-heading">0{index + 1}</Text>
                  </View>
                  <View className="flex-1 gap-1">
                    <SemanticText as="h3" className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-heading`}>
                      {step.title}
                    </SemanticText>
                    <SemanticText as="p" className={`${compact ? 'text-sm leading-5' : 'text-sm leading-6'} text-muted`}>
                      {step.body}
                    </SemanticText>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className={`mt-5 flex-col gap-3 border-t border-border ${compact ? 'pt-4' : 'pt-5'} md:flex-row md:items-center md:justify-between`}>
          <View>
            <SemanticText as="p" className="text-xs font-bold uppercase tracking-[2px] text-muted">
              GitHub-aware sessions
            </SemanticText>
            <SemanticText as="h3" className={`${compact ? 'text-base' : 'text-lg'} mt-1 font-semibold text-heading`}>
              Commits and pull requests can stay attached to the work
            </SemanticText>
          </View>
          <SemanticText as="p" className={`text-sm text-muted ${compact ? 'leading-5 md:max-w-[360px]' : 'leading-6 md:max-w-[320px]'}`}>
            Use pasted URLs or connected GitHub access so invoice reviews and PDFs can carry the context without making non-developers use GitHub at all.
          </SemanticText>
        </View>
      </View>
    </Animated.View>
  );
}

function BulletGrid({
  bullets,
  compact,
  dark = false,
  onPress,
}: {
  bullets: LandingBullet[];
  compact: boolean;
  dark?: boolean;
  onPress?: (href: string) => void;
}) {
  return (
    <View className={`flex-row flex-wrap justify-between ${compact ? 'gap-3' : 'gap-4'}`}>
      {bullets.map((bullet) => (
        <View
          key={bullet.id}
          className={`rounded-[24px] border px-5 ${compact ? 'py-4' : 'py-5'}`}
          style={{
            width: compact ? '100%' : '31.8%',
            minHeight: compact ? 132 : 168,
            borderColor: dark ? 'rgba(255, 255, 255, 0.3)' : undefined,
            backgroundColor: dark ? 'rgba(255, 255, 255, 0.08)' : undefined,
          }}
        >
          <View
            className="flex-1 gap-4"
            style={{ justifyContent: bullet.cta && onPress ? 'space-between' : 'flex-start' }}
          >
            <View className="gap-3">
              <SemanticText
                as="h3"
                className={`${compact ? 'text-lg' : 'text-xl'} font-bold leading-tight ${dark ? 'text-white' : 'text-heading'}`}
              >
                {bullet.title}
              </SemanticText>
              <SemanticText
                as="p"
                className={`${compact ? 'text-sm leading-6' : 'text-base leading-7'} ${dark ? 'text-white' : 'text-muted'}`}
                style={dark ? { opacity: 0.78 } : undefined}
              >
                {bullet.body}
              </SemanticText>
            </View>

            {bullet.cta && onPress ? (
              <Pressable
                className={
                  bullet.cta.kind === 'primary'
                    ? 'self-end rounded-full bg-primary px-4 py-2.5'
                    : 'self-end rounded-full border border-border bg-background px-4 py-2.5'
                }
                onPress={() => {
                  if (bullet.cta) {
                    onPress(bullet.cta.href);
                  }
                }}
              >
                <Text className="text-sm font-semibold text-heading">
                  {bullet.cta.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function PricingHighlight({ compact }: { compact: boolean }) {
  return (
    <View
      className={`w-full overflow-hidden rounded-[30px] border border-border bg-card ${compact ? 'p-5' : 'p-6 md:p-8'}`}
      style={{ boxShadow: '0 24px 60px rgba(15, 23, 42, 0.1)' }}
    >
      <View className="gap-3 md:max-w-[640px]">
        <SemanticText as="p" className="text-xs font-bold uppercase tracking-[2px] text-muted">
          Hosted Time2Pay
        </SemanticText>
        <View className="flex-row flex-wrap items-end gap-2">
          <SemanticText as="p" className="text-[56px] font-bold leading-none text-heading md:text-[72px]">
            $1
          </SemanticText>
          <SemanticText as="p" className="pb-2 text-lg font-semibold text-muted">
            /month
          </SemanticText>
        </View>
        <SemanticText as="p" className="text-base leading-7 text-foreground">
          Simple hosted access for contractors who want the app managed, connected, and ready from the browser. Pay $1/month for as long or as little as you need it, choose a one-time $10 lifetime membership if you are already a Mercury business customer or a referral does not qualify, or get hosted access free after a successful Mercury referral through Time2Pay.
        </SemanticText>
      </View>
    </View>
  );
}

function CtaButtons({
  ctas,
  onPress,
  centered = false,
}: {
  ctas: LandingCta[] | undefined;
  onPress: (href: string) => void;
  centered?: boolean;
}) {
  if (!ctas || ctas.length === 0) {
    return null;
  }

  return (
    <View className={`flex-row flex-wrap gap-3 ${centered ? 'md:justify-center' : ''}`}>
      {ctas.map((cta) => {
        const className =
          cta.kind === 'primary'
            ? 'rounded-full bg-primary px-5 py-3'
            : 'rounded-full border border-border bg-background px-5 py-3';

        return (
          <Pressable key={cta.label} className={className} onPress={() => onPress(cta.href)}>
            <Text className="text-sm font-semibold text-heading">{cta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LandingPage() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { dataMode, hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const startTour = useAuthUiStore((state) => state.startTour);
  const scrollRef = useAnimatedRef<ScrollView>();
  const scrollY = useScrollOffset(scrollRef);
  const heroCopyProgress = useSharedValue(0);
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, SectionLayout>>({});
  const { width, height } = useStableWindowDimensions();

  const viewportWidth = width > 0 ? width : 1280;
  const viewportHeight = height > 0 ? height : 900;
  const isDark = colorScheme === 'dark';
  const footerThemeColor = isDark ? '#f8f7f3' : '#1a1f16';
  const isDesktopViewport = viewportWidth >= 768;
  const isShortViewport = viewportHeight < 880;
  const isVeryShortViewport = viewportHeight < 760;
  const sectionDensity = isVeryShortViewport ? 'tight' : isShortViewport ? 'compact' : 'default';
  const viewportSectionFloor = Math.max(viewportHeight - (isVeryShortViewport ? 124 : isShortViewport ? 108 : 96), 0);
  const heroMinHeight = isDesktopViewport
    ? Math.max(viewportSectionFloor, isVeryShortViewport ? 520 : isShortViewport ? 560 : 620)
    : undefined;
  const baseSectionMinHeight = isDesktopViewport
    ? Math.max(viewportSectionFloor - (isVeryShortViewport ? 28 : isShortViewport ? 12 : 0), isVeryShortViewport ? 480 : 540)
    : undefined;
  const logoPanelMinHeight = viewportWidth >= 1200 ? (isShortViewport ? 420 : 540) : viewportWidth >= 768 ? (isShortViewport ? 340 : 440) : 280;
  const logoShellSize = viewportWidth >= 1200 ? (isShortViewport ? 360 : 420) : viewportWidth >= 768 ? (isShortViewport ? 280 : 320) : 220;
  const logoImageSize = Math.round(logoShellSize * 0.8);
  const workflowStepStyle = useMemo<{ width: PercentageWidth }>(() => {
    if (viewportWidth >= 1140 || (viewportWidth >= 900 && isShortViewport)) {
      return { width: '31.8%' };
    }

    if (viewportWidth >= 760) {
      return { width: '48.5%' };
    }

    return { width: '100%' };
  }, [isShortViewport, viewportWidth]);
  const sectionBodyCompact = isShortViewport;
  const heroTitleClassName = isVeryShortViewport
    ? 'text-[38px] font-bold leading-tight text-heading md:text-[52px]'
    : isShortViewport
      ? 'text-[42px] font-bold leading-tight text-heading md:text-[58px]'
      : 'text-4xl font-bold leading-tight text-heading md:text-6xl';

  useEffect(() => {
    heroCopyProgress.value = 0;

    heroCopyProgress.value = withTiming(1, {
      duration: 760,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [heroCopyProgress]);

  const registerSectionLayout = useCallback((id: string, event: LayoutChangeEvent) => {
    const { y, height: measuredHeight } = event.nativeEvent.layout;

    setSectionLayouts((current) => {
      const existing = current[id];

      if (
        existing &&
        Math.abs(existing.y - y) < 1 &&
        Math.abs(existing.height - measuredHeight) < 1
      ) {
        return current;
      }

      return {
        ...current,
        [id]: {
          y,
          height: measuredHeight,
        },
      };
    });
  }, []);

  const handleRoute = useCallback(
    (href: string) => {
      if (href === MERCURY_REFERRAL_URL) {
        trackMercuryReferralClick().catch(() => undefined);
      }

      if (href.startsWith('http')) {
        Linking.openURL(href).catch(() => undefined);
        return;
      }

      if (href === '/profile' && hostedMode && !isAuthenticated) {
        logRuntimeDiagnostic('landing.profileCta.redirectToHostedAuth', {
          dataMode,
          destination: '/sign-in',
          reason: 'hosted-unauthenticated',
        });
        router.push('/sign-in' as never);
        return;
      }

      router.push(href as never);
    },
    [dataMode, hostedMode, isAuthenticated, router],
  );

  const handleSignIn = useCallback(() => {
    if (!dataModeResolved) {
      logRuntimeDiagnostic('landing.signIn.blocked.dataModePending');
      return;
    }

    if (!hostedMode) {
      logRuntimeDiagnostic(
        'landing.signIn.localModeFallback',
        {
          dataMode,
          destination: '/dashboard',
          reason: 'hosted-auth-unavailable-in-local-build',
        },
        { level: 'warn' },
      );
      router.push('/dashboard' as never);
      return;
    }

    logRuntimeDiagnostic('landing.signIn.redirectToHostedAuth', {
      dataMode,
      destination: '/sign-in',
    });
    router.push('/sign-in' as never);
  }, [dataMode, dataModeResolved, hostedMode, router]);

  const handleTourExperience = useCallback(() => {
    if (!dataModeResolved) {
      logRuntimeDiagnostic('landing.tour.blocked.dataModePending');
      return;
    }

    const startsTourMode = hostedMode && !isAuthenticated;
    logRuntimeDiagnostic('landing.tour.start', {
      dataMode,
      destination: '/dashboard',
      startsTourMode,
    });

    if (hostedMode && !isAuthenticated) {
      startTour();
    }

    router.push('/dashboard' as never);
  }, [dataMode, dataModeResolved, hostedMode, isAuthenticated, router, startTour]);

  const heroCopyStyle = useHeroPieceStyle(heroCopyProgress, 40);
  const heroGlowPrimaryStyle = useParallaxStyle(scrollY, sectionLayouts[heroSection.id], viewportHeight, 32);
  const heroGlowSecondaryStyle = useParallaxStyle(scrollY, sectionLayouts[heroSection.id], viewportHeight, 54);
  const workflowMotion = useSectionRevealStyle(scrollY, sectionLayouts[workflowSection.id], viewportHeight, 0.94);
  const workflowPanelFloatStyle = useParallaxStyle(scrollY, sectionLayouts[workflowSection.id], viewportHeight, 18);
  const ctaMotion = useSectionRevealStyle(scrollY, sectionLayouts[ctaSection.id], viewportHeight, 0.92);

  return (
    <Animated.ScrollView
      ref={scrollRef}
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      stickyHeaderIndices={[0]}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      <LandingHeader
        onOpenSignIn={handleSignIn}
        onTourExperience={handleTourExperience}
      />

      <LandingSection
        id={heroSection.id}
        density={sectionDensity}
        minHeight={heroMinHeight}
        onLayout={(event) => registerSectionLayout(heroSection.id, event)}
      >
        <View className={`relative flex-col ${isShortViewport ? 'gap-8' : 'gap-10'} md:flex-row md:items-stretch md:justify-between`}>
          <Animated.View
            className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-primary"
            style={[{ opacity: 0.22 }, heroGlowPrimaryStyle]}
          />
          <Animated.View
            className="absolute right-0 top-20 h-40 w-40 rounded-full bg-secondary"
            style={[{ opacity: 0.14 }, heroGlowSecondaryStyle]}
          />

          <Animated.View className="md:w-[38%] md:self-stretch" style={heroCopyStyle}>
            <View
              className="flex-1 items-center justify-center rounded-[36px] border border-border bg-card px-6 py-8 md:px-8 md:py-10"
              style={{ minHeight: logoPanelMinHeight, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)' }}
            >
              <View
                className="items-center justify-center rounded-[42px] bg-background"
                style={{
                  width: logoShellSize,
                  height: logoShellSize,
                  boxShadow: '0 18px 42px rgba(15, 23, 42, 0.1)',
                }}
              >
                <Image
                  source={{ uri: '/images/time2payLogo.png' }}
                  style={{ width: logoImageSize, height: logoImageSize }}
                  accessibilityLabel="Time2Pay logo"
                />
              </View>
            </View>
          </Animated.View>

          <View className="flex-1 justify-center gap-8 md:max-w-[680px]">
            <Animated.View className="gap-5" style={heroCopyStyle}>
              <SemanticText as="p" className="text-xs font-bold uppercase tracking-[2px] text-muted">
                {heroSection.eyebrow}
              </SemanticText>
              <SemanticText as="h1" className={heroTitleClassName}>
                {heroSection.title}
              </SemanticText>
              <SectionBody paragraphs={heroSection.body} compact={sectionBodyCompact} />
              <View className="flex-row flex-wrap gap-3">
                <Pressable className="rounded-full bg-primary px-5 py-3" onPress={handleSignIn}>
                  <Text className="text-sm font-semibold text-heading">
                    {!dataModeResolved ? 'Continue' : hostedMode ? 'Sign In to Continue' : 'Open Dashboard'}
                  </Text>
                </Pressable>
                <Pressable
                  className="rounded-full border border-border bg-background px-5 py-3"
                  onPress={handleTourExperience}
                >
                  <Text className="text-sm font-semibold text-heading">Tour the Experience</Text>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </View>
      </LandingSection>

      <FeaturesScene
        scrollY={scrollY}
        layout={sectionLayouts.features}
        viewportHeight={viewportHeight}
        viewportWidth={viewportWidth}
        onLayout={(event) => registerSectionLayout('features', event)}
      />

      <LandingSection
        id={workflowSection.id}
        eyebrow={workflowSection.eyebrow}
        title={workflowSection.title}
        tone="surface"
        density={sectionDensity}
        minHeight={baseSectionMinHeight}
        onLayout={(event) => registerSectionLayout(workflowSection.id, event)}
        sectionStyle={workflowMotion}
      >
        <View className="gap-8">
          <SectionBody paragraphs={workflowSection.body} compact={sectionBodyCompact} />
          <HeroStage style={workflowPanelFloatStyle} compact={isShortViewport} stepCardStyle={workflowStepStyle} />
          <BulletGrid bullets={githubBullets} compact={viewportWidth < 920 || isShortViewport} />
        </View>
      </LandingSection>

      <MercuryScene
        scrollY={scrollY}
        layout={sectionLayouts['mercury-callout']}
        viewportHeight={viewportHeight}
        viewportWidth={viewportWidth}
        onLayout={(event) => registerSectionLayout('mercury-callout', event)}
        onOpenLink={handleRoute}
      />

      <LandingSection
        id={ctaSection.id}
        eyebrow={ctaSection.eyebrow}
        title={ctaSection.title}
        tone="dark"
        density={sectionDensity}
        minHeight={baseSectionMinHeight}
        onLayout={(event) => registerSectionLayout(ctaSection.id, event)}
        sectionStyle={ctaMotion}
        backgroundStyle={
          process.env.EXPO_OS === 'web'
            ? ({
                backgroundColor: footerThemeColor,
                backgroundImage:
                  isDark
                    ? 'linear-gradient(180deg, rgba(143, 212, 154, 0.92) 0%, rgba(201, 232, 206, 0.82) 38%, rgba(233, 242, 234, 0.92) 72%, #f8f7f3 95%, #f8f7f3 100%)'
                    : 'linear-gradient(180deg, rgba(175, 228, 183, 0.9) 0%, rgba(115, 145, 121, 0.72) 38%, rgba(46, 54, 42, 0.82) 72%, #1a1f16 95%, #1a1f16 100%)',
              } as const)
            : undefined
        }
        eyebrowClassName="text-white"
        titleClassName="text-white"
        eyebrowStyle={{ opacity: 0.9, color: '#f2f7ef' }}
        titleStyle={{ color: '#f7fbf5' }}
      >
        <View className="gap-8">
          <PricingHighlight compact={isShortViewport} />
          <BulletGrid
            bullets={pricingBullets}
            compact={viewportWidth < 920 || isShortViewport}
            dark
            onPress={handleRoute}
          />
        </View>
      </LandingSection>

      <LandingFooter links={footerLinks} onOpenLink={handleRoute} />
    </Animated.ScrollView>
  );
}

import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { InlineNotice } from '@/components/inline-notice';
import type {
  BillingSubscriptionAction,
  BillingSubscriptionSummary,
  HostedAccessResult,
  HostedOffer,
} from '@/database/hosted/billing/types';
import { EmbeddedBillingCheckout } from '@/features/billing/embedded-billing-checkout';
import { SubscriptionManager } from '@/features/billing/subscription-manager';
import {
  type BillingCheckoutTheme,
  createHostedCheckout,
  getBillingSubscription,
  getHostedBillingStatus,
  syncHostedBilling,
  updateBillingSubscription,
} from '@/services/billing';
import { getMercuryReferralStatus, type MercuryReferralStatus } from '@/services/mercury-referrals';
import { isHostedMode } from '@/services/runtime-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

type BillingScreenVariant = 'pricing' | 'settings' | 'access-required' | 'referral-status';

type BillingScreenProps = {
  variant: BillingScreenVariant;
};

function formatDate(value: string | null): string {
  if (!value) {
    return 'No expiration';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatAccessSource(access: HostedAccessResult): string {
  switch (access.source) {
    case 'mercury':
      return 'Mercury referral';
    case 'subscription':
      return 'Subscription';
    case 'lifetime_purchase':
      return 'Lifetime membership';
    case 'admin':
      return 'Administrative access';
    default:
      return 'No active access';
  }
}

function formatAccessStatus(access: HostedAccessResult): string {
  switch (access.status) {
    case 'active':
      return 'Active';
    case 'grace':
      return 'Grace period';
    case 'past_due':
      return 'Payment past due';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Access required';
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Billing could not be completed. Please try again.';
}

function singleSearchParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function hasResolvedCheckoutSessionId(value: string | null): value is string {
  return Boolean(value && !value.includes('CHECKOUT_SESSION_ID'));
}

function offerDetails(offer: HostedOffer): { title: string; price: string; detail: string; recommended?: boolean } {
  switch (offer) {
    case 'annual':
      return {
        title: 'Annual',
        price: '$20/year',
        detail: 'Less than $1.67 per month.',
        recommended: true,
      };
    case 'monthly':
      return {
        title: 'Monthly',
        price: '$2/month',
        detail: 'Flexible access with monthly renewal.',
      };
    case 'mercury_lifetime':
      return {
        title: 'Mercury lifetime',
        price: '$20 once',
        detail: 'Available after your verified Mercury outcome is confirmed.',
      };
  }
}

function OfferCard({
  title,
  price,
  detail,
  recommended = false,
  enabled,
  busy,
  onPress,
}: {
  title: string;
  price: string;
  detail: string;
  recommended?: boolean;
  enabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <View
      className={
        recommended
          ? 'gap-3 rounded-xl border-2 border-secondary bg-card p-4'
          : 'gap-3 rounded-xl border border-border bg-card p-4'
      }
    >
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="gap-1">
          <Text className="text-base font-bold text-heading">{title}</Text>
          <Text className="text-2xl font-bold text-heading">{price}</Text>
          <Text className="text-sm text-muted">{detail}</Text>
        </View>
        {recommended ? (
          <View className="rounded-full bg-secondary px-3 py-1">
            <Text className="text-xs font-bold text-white">Recommended</Text>
          </View>
        ) : null}
      </View>
      <Pressable
        className={
          enabled
            ? 'self-start rounded-md bg-secondary px-4 py-2'
            : 'self-start rounded-md border border-border px-4 py-2'
        }
        onPress={onPress}
        disabled={!enabled || busy}
        accessibilityRole="button"
      >
        <Text className={enabled ? 'font-semibold text-white' : 'font-semibold text-muted'}>
          {busy ? 'Loading checkout...' : enabled ? `Choose ${title}` : 'Available on web'}
        </Text>
      </Pressable>
    </View>
  );
}

export function BillingScreen({ variant }: BillingScreenProps) {
  const searchParams = useLocalSearchParams<{ checkout?: string | string[]; session_id?: string | string[] }>();
  const colorScheme = useColorScheme();
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const hostedMode = isHostedMode();
  const isWeb = process.env.EXPO_OS === 'web';
  const [access, setAccess] = useState<HostedAccessResult | null>(null);
  const [referral, setReferral] = useState<MercuryReferralStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyOffer, setBusyOffer] = useState<HostedOffer | null>(null);
  const [checkoutOffer, setCheckoutOffer] = useState<HostedOffer | null>(null);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<BillingSubscriptionSummary | null>(null);
  const [busySubscriptionAction, setBusySubscriptionAction] =
    useState<BillingSubscriptionAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncedCheckoutSession = useRef<string | null>(null);
  const activeAccessRequest = useRef<AbortController | null>(null);
  const accessRequestSequence = useRef(0);
  const checkoutState = singleSearchParam(searchParams.checkout);
  const checkoutSessionId = singleSearchParam(searchParams.session_id);
  const checkoutSyncKey = hasResolvedCheckoutSessionId(checkoutSessionId)
    ? checkoutSessionId
    : 'checkout-return-without-session-id';
  const isReferralScreen = variant === 'referral-status';
  const isBillingSettings = variant === 'settings';

  useEffect(() => {
    if (!hostedMode || !isAuthenticated || tourModeEnabled) {
      activeAccessRequest.current?.abort();
      activeAccessRequest.current = null;
      accessRequestSequence.current += 1;
      setAccess(null);
      setReferral(null);
      setSubscription(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const shouldSyncCheckout =
      isWeb &&
      (checkoutState === 'success' || checkoutState === 'return') &&
      syncedCheckoutSession.current !== checkoutSyncKey;
    const controller = new AbortController();
    activeAccessRequest.current?.abort();
    activeAccessRequest.current = controller;
    const requestSequence = accessRequestSequence.current + 1;
    accessRequestSequence.current = requestSequence;

    if (shouldSyncCheckout) {
      syncedCheckoutSession.current = checkoutSyncKey;
    }

    setIsLoading(!shouldSyncCheckout);
    setIsRefreshing(shouldSyncCheckout);
    setError(null);

    const accessRequest = shouldSyncCheckout
      ? syncHostedBilling(
          hasResolvedCheckoutSessionId(checkoutSessionId) ? checkoutSessionId : undefined,
          controller.signal,
        )
      : getHostedBillingStatus(controller.signal);

    Promise.all([
      accessRequest,
      isReferralScreen ? getMercuryReferralStatus() : Promise.resolve(null),
      isBillingSettings && isWeb
        ? getBillingSubscription(controller.signal)
        : Promise.resolve(null),
    ])
      .then(([nextAccess, nextReferral, nextSubscription]) => {
        if (!controller.signal.aborted && accessRequestSequence.current === requestSequence) {
          setAccess(nextAccess);
          setReferral(nextReferral);
          setSubscription(nextSubscription);
        }
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted && accessRequestSequence.current === requestSequence) {
          setError(formatError(loadError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && accessRequestSequence.current === requestSequence) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
        if (activeAccessRequest.current === controller) {
          activeAccessRequest.current = null;
        }
      });

    return () => {
      controller.abort();
      if (activeAccessRequest.current === controller) {
        activeAccessRequest.current = null;
      }
    };
  }, [
    checkoutSessionId,
    checkoutState,
    checkoutSyncKey,
    hostedMode,
    isAuthenticated,
    isBillingSettings,
    isReferralScreen,
    isWeb,
    tourModeEnabled,
  ]);

  async function refresh(): Promise<void> {
    if (!hostedMode || !isAuthenticated || tourModeEnabled) {
      return;
    }

    activeAccessRequest.current?.abort();
    const controller = new AbortController();
    activeAccessRequest.current = controller;
    const requestSequence = accessRequestSequence.current + 1;
    accessRequestSequence.current = requestSequence;

    setError(null);
    setIsLoading(false);
    setIsRefreshing(true);
    try {
      const [nextAccess, nextReferral, nextSubscription] = await Promise.all([
        syncHostedBilling(undefined, controller.signal),
        isReferralScreen ? getMercuryReferralStatus() : Promise.resolve(null),
        isBillingSettings && isWeb
          ? getBillingSubscription(controller.signal)
          : Promise.resolve(null),
      ]);
      if (!controller.signal.aborted && accessRequestSequence.current === requestSequence) {
        setAccess(nextAccess);
        setReferral(nextReferral);
        setSubscription(nextSubscription);
      }
    } catch (refreshError) {
      if (!controller.signal.aborted && accessRequestSequence.current === requestSequence) {
        setError(formatError(refreshError));
      }
    } finally {
      if (!controller.signal.aborted && accessRequestSequence.current === requestSequence) {
        setIsRefreshing(false);
      }
      if (activeAccessRequest.current === controller) {
        activeAccessRequest.current = null;
      }
    }
  }

  async function startCheckout(offer: HostedOffer): Promise<void> {
    if (!isWeb) {
      setError('Purchases are available on the web. Native purchase options will use the app stores.');
      return;
    }

    const checkoutTheme: BillingCheckoutTheme = colorScheme === 'dark' ? 'dark' : 'light';
    setBusyOffer(offer);
    setError(null);
    try {
      const session = await createHostedCheckout(offer, checkoutTheme);
      setCheckoutOffer(offer);
      setCheckoutClientSecret(session.clientSecret);
    } catch (checkoutError) {
      setCheckoutOffer(null);
      setError(formatError(checkoutError));
    } finally {
      setBusyOffer(null);
    }
  }

  const closeCheckout = useCallback((): void => {
    setCheckoutClientSecret(null);
    setCheckoutOffer(null);
    setBusyOffer(null);
  }, []);

  const completeEmbeddedCheckout = useCallback(async (): Promise<void> => {
    setCheckoutClientSecret(null);
    setCheckoutOffer(null);
    setBusyOffer(null);
    setIsRefreshing(true);
    setError(null);
    try {
      const [nextAccess, nextSubscription] = await Promise.all([
        syncHostedBilling(),
        isBillingSettings ? getBillingSubscription() : Promise.resolve(null),
      ]);
      setAccess(nextAccess);
      setSubscription(nextSubscription);
    } catch (checkoutError) {
      setError(formatError(checkoutError));
    } finally {
      setIsRefreshing(false);
    }
  }, [isBillingSettings]);

  async function manageSubscription(action: BillingSubscriptionAction): Promise<void> {
    setBusySubscriptionAction(action);
    setError(null);
    try {
      setSubscription(await updateBillingSubscription(action));
    } catch (subscriptionError) {
      setError(formatError(subscriptionError));
    } finally {
      setBusySubscriptionAction(null);
    }
  }

  const eligibleOffers = access?.eligibleOffers ?? [];
  const canStartCheckout =
    hostedMode &&
    isAuthenticated &&
    !tourModeEnabled &&
    isWeb &&
    checkoutClientSecret === null;
  const canShowSubscriptionManager =
    isBillingSettings && access?.source === 'subscription' && subscription !== null;
  const shouldShowOffers = !access?.hasAccess || variant === 'pricing';
  const shouldShowPurchaseFlow = shouldShowOffers || checkoutClientSecret !== null;
  const activeCheckoutOffer = checkoutOffer ? offerDetails(checkoutOffer) : null;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-5 p-6"
    >
      <View className="gap-2">
        <Text className="text-2xl font-bold text-heading">
          {variant === 'access-required'
            ? 'Access required'
            : variant === 'referral-status'
              ? 'Mercury referral status'
              : variant === 'settings'
                ? 'Billing & plan'
                : 'Plans & access'}
        </Text>
        <Text className="text-sm text-muted">
          {variant === 'access-required'
            ? 'Your data remains yours. Manage access here or keep using the free local version.'
            : variant === 'settings'
              ? 'Manage your plan, renewal, and secure checkout without leaving Time2Pay.'
              : 'Self-hosting remains free. Paid plans include managed sync and account convenience.'}
        </Text>
      </View>

      {!hostedMode ? (
        <View className="gap-2 rounded-xl border border-success/30 bg-success/10 p-4">
          <Text className="text-base font-bold text-heading">Local access is free</Text>
          <Text className="text-sm text-muted">
            Time2Pay data and core tracking features remain available without a paid plan.
          </Text>
        </View>
      ) : !isAuthenticated ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <Text className="text-base font-bold text-heading">Sign in to manage billing</Text>
          <Text className="text-sm text-muted">
            Annual and monthly plans are available after sign-in. Conditional lifetime access is verified by the server.
          </Text>
          <Link href="/sign-in" asChild>
            <Pressable className="self-start rounded-md bg-secondary px-4 py-2">
              <Text className="font-semibold text-white">Sign In</Text>
            </Pressable>
          </Link>
        </View>
      ) : tourModeEnabled ? (
        <View className="gap-2 rounded-xl border border-border bg-card p-4">
          <Text className="text-base font-bold text-heading">Tour mode has no billing state</Text>
          <Text className="text-sm text-muted">Sign in to view your real access and referral progress.</Text>
        </View>
      ) : isLoading ? (
        <View className="items-center gap-3 rounded-xl border border-border bg-card p-5">
          <ActivityIndicator color="#bb7e5d" />
          <Text className="text-sm text-muted">Loading billing...</Text>
        </View>
      ) : access ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="gap-1">
              <Text className="text-base font-bold text-heading">{formatAccessStatus(access)}</Text>
              <Text className="text-sm text-muted">{formatAccessSource(access)}</Text>
            </View>
            <View className={access.hasAccess ? 'rounded-full bg-success/15 px-3 py-1' : 'rounded-full bg-danger/10 px-3 py-1'}>
              <Text className={access.hasAccess ? 'text-xs font-bold text-success' : 'text-xs font-bold text-danger'}>
                {access.hasAccess ? 'Enabled' : 'Action needed'}
              </Text>
            </View>
          </View>
          <Text className="text-sm text-muted">
            {access.validUntil ? `Valid until ${formatDate(access.validUntil)}.` : 'No expiration is recorded.'}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              className="rounded-md border border-border px-4 py-2"
              onPress={() => {
                refresh().catch(() => undefined);
              }}
              disabled={isRefreshing}
            >
              <Text className="font-semibold text-heading">
                {isRefreshing ? 'Refreshing...' : 'Refresh access'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {canShowSubscriptionManager ? (
        <SubscriptionManager
          subscription={subscription}
          busyAction={busySubscriptionAction}
          onAction={(action) => {
            manageSubscription(action).catch(() => undefined);
          }}
        />
      ) : null}

      {checkoutState === 'canceled' ? (
        <InlineNotice tone="neutral" message="Checkout was canceled. No billing changes were made." />
      ) : null}
      {(checkoutState === 'success' || checkoutState === 'return') && isRefreshing ? (
        <InlineNotice tone="neutral" message="Confirming your access..." />
      ) : null}
      {error ? <InlineNotice tone="error" message={error} /> : null}

      {shouldShowPurchaseFlow ? (
        <Animated.View
          className="overflow-hidden rounded-2xl border border-border bg-card"
          layout={LinearTransition.duration(180)}
        >
          {checkoutClientSecret ? (
            <Animated.View
              key="checkout"
              className="gap-5 p-4 md:p-6"
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
            >
              <View className="flex-row flex-wrap items-start justify-between gap-3">
                <View className="max-w-3xl gap-1">
                  <Text className="text-lg font-bold text-heading">Secure checkout</Text>
                  {activeCheckoutOffer ? (
                    <Text className="text-sm font-semibold text-heading">
                      {activeCheckoutOffer.title} · {activeCheckoutOffer.price}
                    </Text>
                  ) : null}
                  <Text className="text-sm text-muted">
                    Payment details stay inside Stripe, but the flow stays here in Time2Pay.
                  </Text>
                </View>
                <Pressable
                  className="rounded-md border border-border px-4 py-2"
                  onPress={closeCheckout}
                  accessibilityRole="button"
                  accessibilityLabel="Back to plans"
                >
                  <Text className="font-semibold text-heading">Back</Text>
                </Pressable>
              </View>
              <EmbeddedBillingCheckout
                clientSecret={checkoutClientSecret}
                onClose={closeCheckout}
                onComplete={() => {
                  completeEmbeddedCheckout().catch(() => undefined);
                }}
              />
            </Animated.View>
          ) : (
            <Animated.View
              key="plans"
              className="gap-4 p-4"
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
            >
              <View className="gap-1">
                <Text className="text-lg font-bold text-heading">Plans</Text>
                <Text className="text-sm text-muted">
                  Choose the web plan that fits how you want to run Time2Pay.
                </Text>
              </View>
              <OfferCard
                {...offerDetails('annual')}
                enabled={canStartCheckout && eligibleOffers.includes('annual')}
                busy={busyOffer === 'annual'}
                onPress={() => {
                  startCheckout('annual').catch(() => undefined);
                }}
              />
              <OfferCard
                {...offerDetails('monthly')}
                enabled={canStartCheckout && eligibleOffers.includes('monthly')}
                busy={busyOffer === 'monthly'}
                onPress={() => {
                  startCheckout('monthly').catch(() => undefined);
                }}
              />
              {eligibleOffers.includes('mercury_lifetime') ? (
                <OfferCard
                  {...offerDetails('mercury_lifetime')}
                  enabled={canStartCheckout}
                  busy={busyOffer === 'mercury_lifetime'}
                  onPress={() => {
                    startCheckout('mercury_lifetime').catch(() => undefined);
                  }}
                />
              ) : null}
            </Animated.View>
          )}
        </Animated.View>
      ) : null}

      {isReferralScreen && isAuthenticated && !tourModeEnabled ? (
        <View className="gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-base font-bold text-heading">Referral progress</Text>
            <View className="rounded-full bg-warning/15 px-3 py-1">
              <Text className="text-xs font-bold text-heading">Coming soon</Text>
            </View>
          </View>
          <Text className="text-sm text-muted">
            Mercury attribution and qualification reporting are being connected. The free
            lifetime reward is not available until verification is reliable.
          </Text>
          <Text className="text-sm text-muted">
            {referral && referral.status !== 'not_started'
              ? `Status: ${referral.status.replaceAll('_', ' ')}.`
              : 'No Mercury referral activity has been verified yet.'}
          </Text>
          {referral?.qualificationDeadlineAt ? (
            <Text className="text-sm text-muted">
              Qualification deadline: {formatDate(referral.qualificationDeadlineAt)}.
            </Text>
          ) : null}
          {referral?.qualifiedAt ? (
            <Text className="text-sm text-success">Qualified on {formatDate(referral.qualifiedAt)}.</Text>
          ) : null}
          <Link href="/profile" asChild>
            <Pressable className="self-start rounded-md border border-border px-4 py-2">
              <Text className="font-semibold text-heading">Open Profile</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {isAuthenticated ? (
        <Link href="/profile" asChild>
          <Pressable className="self-start rounded-md border border-border px-4 py-2">
            <Text className="font-semibold text-heading">Data export and profile</Text>
          </Pressable>
        </Link>
      ) : null}
    </ScrollView>
  );
}

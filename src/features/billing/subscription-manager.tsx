import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  BillingSubscriptionAction,
  BillingSubscriptionPlanSwitchPreview,
  BillingSubscriptionSummary,
  HostedPlan,
} from '@/database/hosted/billing/types';

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatDate(value: string): string {
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

function formatCardBrand(value: string): string {
  return value
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function isRenewingSubscription(subscription: BillingSubscriptionSummary): boolean {
  return (
    (subscription.status === 'active' ||
      subscription.status === 'trialing' ||
      subscription.status === 'past_due') &&
    !subscription.cancelAtPeriodEnd
  );
}

export function SubscriptionManager({
  subscription,
  busyAction,
  onAction,
  busyPlan = null,
  planSwitchPreview = null,
  isPreviewingPlanChange = false,
  onPreviewPlanChange,
  onChangePlan,
  isPaymentMethodBusy = false,
  isRemovingPaymentMethod = false,
  onChangePaymentMethod,
  onRemovePaymentMethod,
}: {
  subscription: BillingSubscriptionSummary;
  busyAction: BillingSubscriptionAction | null;
  onAction: (action: BillingSubscriptionAction) => void;
  busyPlan?: HostedPlan | null;
  planSwitchPreview?: BillingSubscriptionPlanSwitchPreview | null;
  isPreviewingPlanChange?: boolean;
  onPreviewPlanChange?: (plan: HostedPlan) => void;
  onChangePlan: (plan: HostedPlan, prorationDate?: number) => void;
  isPaymentMethodBusy?: boolean;
  isRemovingPaymentMethod?: boolean;
  onChangePaymentMethod?: () => void;
  onRemovePaymentMethod?: () => void;
}) {
  const [isConfirmingCancellation, setIsConfirmingCancellation] = useState(false);
  const [isConfirmingPlanChange, setIsConfirmingPlanChange] = useState(false);
  const [isConfirmingCardRemoval, setIsConfirmingCardRemoval] = useState(false);
  const currentPlanLabel = subscription.plan === 'annual' ? 'Annual - $20/year' : 'Monthly - $2/month';
  const targetPlan = subscription.plan === 'annual' ? 'monthly' : 'annual';
  const targetPlanLabel = targetPlan === 'annual' ? 'Annual - $20/year' : 'Monthly - $2/month';
  const activePreview =
    planSwitchPreview?.targetPlan === targetPlan ? planSwitchPreview : null;
  const canConfirmPlanSwitch = Boolean(activePreview) && !isPreviewingPlanChange;
  const canRemovePaymentMethod =
    Boolean(subscription.paymentMethod && onRemovePaymentMethod) && !isRenewingSubscription(subscription);
  const isBusy =
    busyAction !== null ||
    isPaymentMethodBusy ||
    isRemovingPaymentMethod ||
    busyPlan !== null ||
    isPreviewingPlanChange;

  useEffect(() => {
    setIsConfirmingCancellation(false);
    setIsConfirmingPlanChange(false);
    setIsConfirmingCardRemoval(false);
  }, [subscription.cancelAtPeriodEnd, subscription.paymentMethod, subscription.plan]);

  return (
    <View className="gap-4 rounded-xl border border-border bg-card p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="gap-1">
          <Text className="text-base font-bold text-heading">Subscription</Text>
          <Text className="text-2xl font-bold text-heading">{currentPlanLabel}</Text>
        </View>
        <View className="rounded-full bg-success/15 px-3 py-1">
          <Text className="text-xs font-bold text-success">{titleCase(subscription.status)}</Text>
        </View>
      </View>

      <View className="gap-1">
        <Text className="text-sm font-semibold text-heading">
          {subscription.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal & access through'}
        </Text>
        <Text className="text-sm text-muted">{formatDate(subscription.currentPeriodEnd)}</Text>
      </View>

      <View className="gap-3 rounded-lg border border-border bg-background p-3">
        <View className="gap-1">
          <Text className="text-sm font-semibold text-heading">Change plan</Text>
          <Text className="text-sm text-muted">
            Move between monthly and annual with Stripe proration.
          </Text>
        </View>

        {isConfirmingPlanChange ? (
          <View className="gap-3 rounded-lg border border-secondary/30 bg-secondary/10 p-3">
            <Text className="font-semibold text-heading">Switch to {targetPlanLabel}?</Text>
            <Text className="text-sm text-muted">
              Stripe will prorate this change immediately and reset your renewal date.
            </Text>
            {isPreviewingPlanChange ? (
              <Text className="text-sm font-semibold text-heading">Calculating Stripe estimate...</Text>
            ) : activePreview ? (
              <View className="gap-2 rounded-lg border border-border bg-card p-3">
                <View className="flex-row justify-between gap-3">
                  <Text className="text-sm text-muted">
                    Estimated unused {subscription.plan === 'annual' ? 'annual' : 'monthly'} credit
                  </Text>
                  <Text className="text-sm font-semibold text-heading">
                    {formatMoney(activePreview.proratedCreditCents, activePreview.currency)}
                  </Text>
                </View>
                <View className="flex-row justify-between gap-3">
                  <Text className="text-sm text-muted">Estimated new charge/adjustments</Text>
                  <Text className="text-sm font-semibold text-heading">
                    {formatMoney(activePreview.immediateChargeCents, activePreview.currency)}
                  </Text>
                </View>
                <View className="flex-row justify-between gap-3">
                  <Text className="text-sm font-semibold text-heading">Estimated due today</Text>
                  <Text className="text-sm font-bold text-heading">
                    {formatMoney(activePreview.amountDueNowCents, activePreview.currency)}
                  </Text>
                </View>
                {activePreview.futureCreditCents > 0 ? (
                  <Text className="text-xs text-muted">
                    Estimated credit left after this switch:{' '}
                    {formatMoney(activePreview.futureCreditCents, activePreview.currency)}. Stripe applies
                    that credit to future invoices; it is not automatically refunded to the card.
                  </Text>
                ) : (
                  <Text className="text-xs text-muted">
                    The final Stripe invoice can vary slightly if taxes, discounts, or the clock changes
                    before confirmation.
                  </Text>
                )}
              </View>
            ) : (
              <Text className="text-sm text-muted">
                Waiting for Stripe to estimate the credit, charge, and amount due today.
              </Text>
            )}
            <View className="flex-row flex-wrap gap-2">
              <Pressable
                className="rounded-md border border-border bg-card px-4 py-2"
                onPress={() => setIsConfirmingPlanChange(false)}
                disabled={isBusy}
                accessibilityRole="button"
              >
                <Text className="font-semibold text-heading">Keep current plan</Text>
              </Pressable>
              <Pressable
                className="rounded-md bg-secondary px-4 py-2"
                onPress={() => onChangePlan(targetPlan, activePreview?.prorationDate)}
                disabled={isBusy || !canConfirmPlanSwitch}
                accessibilityRole="button"
              >
                <Text className="font-semibold text-white">
                  {busyPlan === targetPlan ? 'Switching plan...' : 'Confirm switch'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            className="self-start rounded-md border border-secondary/40 bg-secondary/10 px-4 py-2"
            onPress={() => {
              setIsConfirmingCancellation(false);
              setIsConfirmingCardRemoval(false);
              setIsConfirmingPlanChange(true);
              onPreviewPlanChange?.(targetPlan);
            }}
            disabled={isBusy}
            accessibilityRole="button"
          >
            <Text className="font-semibold text-heading">Change plan</Text>
          </Pressable>
        )}
      </View>

      {subscription.paymentMethod ? (
        <View className="gap-3 rounded-lg border border-border bg-background p-3">
          <View className="gap-1">
            <Text className="text-sm font-semibold text-heading">Payment method</Text>
            <Text className="text-base font-bold text-heading">
              {formatCardBrand(subscription.paymentMethod.brand)} ending in {subscription.paymentMethod.last4}
            </Text>
            <Text className="text-sm text-muted">
              Expires {String(subscription.paymentMethod.expMonth).padStart(2, '0')}/
              {subscription.paymentMethod.expYear}
            </Text>
          </View>
          {isConfirmingCardRemoval ? (
            <View className="gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <Text className="font-semibold text-heading">Remove saved card?</Text>
              <Text className="text-sm text-muted">
                This detaches the card from Stripe for this billing account. Your access stays
                active through {formatDate(subscription.currentPeriodEnd)}.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  className="rounded-md border border-border bg-card px-4 py-2"
                  onPress={() => setIsConfirmingCardRemoval(false)}
                  disabled={isBusy}
                  accessibilityRole="button"
                >
                  <Text className="font-semibold text-heading">Keep card</Text>
                </Pressable>
                <Pressable
                  className="rounded-md bg-danger px-4 py-2"
                  onPress={onRemovePaymentMethod}
                  disabled={!canRemovePaymentMethod || isBusy}
                  accessibilityRole="button"
                >
                  <Text className="font-semibold text-white">
                    {isRemovingPaymentMethod ? 'Removing card...' : 'Remove card'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="gap-2">
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  className="rounded-md border border-border px-4 py-2"
                  onPress={onChangePaymentMethod}
                  disabled={!onChangePaymentMethod || isBusy}
                  accessibilityRole="button"
                >
                  <Text className="font-semibold text-heading">
                    {isPaymentMethodBusy ? 'Opening secure form...' : 'Change payment method'}
                  </Text>
                </Pressable>
                {canRemovePaymentMethod ? (
                  <Pressable
                    className="rounded-md border border-danger/40 px-4 py-2"
                    onPress={() => {
                      setIsConfirmingCancellation(false);
                      setIsConfirmingPlanChange(false);
                      setIsConfirmingCardRemoval(true);
                    }}
                    disabled={isBusy}
                    accessibilityRole="button"
                  >
                    <Text className="font-semibold text-danger">Remove card</Text>
                  </Pressable>
                ) : null}
              </View>
              {isRenewingSubscription(subscription) ? (
                <Text className="text-xs text-muted">
                  To remove the saved card, turn renewal off first so the subscription is not
                  stranded without a payment method.
                </Text>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {subscription.cancelAtPeriodEnd ? (
        <View className="gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <Text className="text-sm text-heading">
            Renewal is off. Your access stays active through the date above.
          </Text>
          <Pressable
            className="self-start rounded-md bg-secondary px-4 py-2"
            onPress={() => onAction('resume')}
            disabled={isBusy}
            accessibilityRole="button"
          >
            <Text className="font-semibold text-white">
              {busyAction === 'resume' ? 'Renewing subscription...' : 'Renew subscription'}
            </Text>
          </Pressable>
        </View>
      ) : isConfirmingCancellation ? (
        <View className="gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
          <Text className="font-semibold text-heading">
            Turn off renewal at the end of this billing period?
          </Text>
          <Text className="text-sm text-muted">
            You keep access until {formatDate(subscription.currentPeriodEnd)} and will not be
            charged again.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              className="rounded-md border border-border bg-card px-4 py-2"
              onPress={() => setIsConfirmingCancellation(false)}
              disabled={isBusy}
              accessibilityRole="button"
            >
              <Text className="font-semibold text-heading">Keep plan</Text>
            </Pressable>
            <Pressable
              className="rounded-md bg-danger px-4 py-2"
              onPress={() => onAction('cancel_at_period_end')}
              disabled={isBusy}
              accessibilityRole="button"
            >
              <Text className="font-semibold text-white">
                {busyAction === 'cancel_at_period_end'
                  ? 'Turning off renewal...'
                  : 'Confirm cancellation'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          className="self-start rounded-md border border-danger/40 px-4 py-2"
          onPress={() => {
            setIsConfirmingPlanChange(false);
            setIsConfirmingCancellation(true);
          }}
          disabled={isBusy}
          accessibilityRole="button"
        >
          <Text className="font-semibold text-danger">Cancel subscription</Text>
        </Pressable>
      )}
    </View>
  );
}

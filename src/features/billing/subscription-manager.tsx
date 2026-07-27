import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  BillingSubscriptionAction,
  BillingSubscriptionSummary,
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

export function SubscriptionManager({
  subscription,
  busyAction,
  onAction,
}: {
  subscription: BillingSubscriptionSummary;
  busyAction: BillingSubscriptionAction | null;
  onAction: (action: BillingSubscriptionAction) => void;
}) {
  const [isConfirmingCancellation, setIsConfirmingCancellation] = useState(false);
  const isBusy = busyAction !== null;

  return (
    <View className="gap-4 rounded-xl border border-border bg-card p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="gap-1">
          <Text className="text-base font-bold text-heading">Subscription</Text>
          <Text className="text-2xl font-bold text-heading">
            {subscription.plan === 'annual' ? 'Annual · $20/year' : 'Monthly · $2/month'}
          </Text>
        </View>
        <View className="rounded-full bg-success/15 px-3 py-1">
          <Text className="text-xs font-bold text-success">
            {titleCase(subscription.status)}
          </Text>
        </View>
      </View>

      <View className="gap-1">
        <Text className="text-sm font-semibold text-heading">
          {subscription.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal'}
        </Text>
        <Text className="text-sm text-muted">
          {formatDate(subscription.currentPeriodEnd)}
        </Text>
      </View>

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
              {busyAction === 'resume' ? 'Restoring renewal...' : 'Keep subscription'}
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
          onPress={() => setIsConfirmingCancellation(true)}
          disabled={isBusy}
          accessibilityRole="button"
        >
          <Text className="font-semibold text-danger">Cancel subscription</Text>
        </Pressable>
      )}
    </View>
  );
}

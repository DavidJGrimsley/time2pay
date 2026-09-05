import { AppScreenChrome } from '@/components/app-screen-chrome';
import { BillingScreen } from '@/features/billing/billing-screen';

export default function BillingSettingsRoute() {
  return (
    <AppScreenChrome>
      <BillingScreen variant="settings" />
    </AppScreenChrome>
  );
}
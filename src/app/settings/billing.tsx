import { AppScreenChrome } from '@/components/app-screen-chrome';
import { BillingScreen } from '@/features/billing/billing-screen';
import { SettingsPageWidth } from '@/features/settings/settings-page-width';

export default function BillingSettingsRoute() {
  return (
    <AppScreenChrome>
      <SettingsPageWidth>
        <BillingScreen variant="settings" />
      </SettingsPageWidth>
    </AppScreenChrome>
  );
}

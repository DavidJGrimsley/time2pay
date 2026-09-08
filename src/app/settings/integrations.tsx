import { AppScreenChrome } from '@/components/app-screen-chrome';
import { IntegrationsScreen } from '@/features/settings/integrations/integrations-screen';
import { SettingsPageWidth } from '@/features/settings/settings-page-width';

export default function IntegrationsSettingsRoute() {
  return (
    <AppScreenChrome>
      <SettingsPageWidth>
        <IntegrationsScreen />
      </SettingsPageWidth>
    </AppScreenChrome>
  );
}

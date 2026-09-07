import { AppScreenChrome } from '@/components/app-screen-chrome';
import { IntegrationsScreen } from '@/features/settings/integrations/integrations-screen';

export default function IntegrationsSettingsRoute() {
  return (
    <AppScreenChrome>
      <IntegrationsScreen />
    </AppScreenChrome>
  );
}

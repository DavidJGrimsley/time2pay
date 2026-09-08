import { AppScreenChrome } from '@/components/app-screen-chrome';
import { TabScreenFrame } from '@/components/tab-screen-frame';
import { SettingsScreen } from '@/features/settings/settings-screen';
import { SettingsPageWidth } from '@/features/settings/settings-page-width';

export default function SettingsRoute() {
  return (
    <AppScreenChrome>
      <TabScreenFrame>
        <SettingsPageWidth>
          <SettingsScreen />
        </SettingsPageWidth>
      </TabScreenFrame>
    </AppScreenChrome>
  );
}

import { AppScreenChrome } from '@/components/app-screen-chrome';
import { TabScreenFrame } from '@/components/tab-screen-frame';
import { SettingsScreen } from '@/features/settings/settings-screen';

export default function SettingsRoute() {
  return (
    <AppScreenChrome>
      <TabScreenFrame>
        <SettingsScreen />
      </TabScreenFrame>
    </AppScreenChrome>
  );
}

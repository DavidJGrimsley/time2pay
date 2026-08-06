import React from 'react';
import { ProfileOverview } from '@/components/profile-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function SettingsRoute() {
  return (
    <TabScreenFrame>
      <ProfileOverview />
    </TabScreenFrame>
  );
}
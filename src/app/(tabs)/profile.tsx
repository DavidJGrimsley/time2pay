import React from 'react';
import { ProfileOverview } from '@/components/profile-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function ProfileRoute() {
  return (
    <TabScreenFrame>
      <ProfileOverview />
    </TabScreenFrame>
  );
}

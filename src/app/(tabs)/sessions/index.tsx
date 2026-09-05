import React from 'react';
import { SessionsOverview } from '@/components/sessions-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function SessionsRoute() {
  return (
    <TabScreenFrame>
      <SessionsOverview />
    </TabScreenFrame>
  );
}

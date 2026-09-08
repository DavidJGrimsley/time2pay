import React from 'react';
import { MercuryOverview } from '@/components/mercury-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function MercuryRoute() {
  return (
    <TabScreenFrame>
      <MercuryOverview />
    </TabScreenFrame>
  );
}

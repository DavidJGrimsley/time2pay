import React from 'react';
import { DashboardOverview } from '@/components/dashboard-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function DashboardRoute() {
  return (
    <TabScreenFrame>
      <DashboardOverview />
    </TabScreenFrame>
  );
}

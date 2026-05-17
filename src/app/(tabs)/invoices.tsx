import React from 'react';
import { InvoicesOverview } from '@/components/invoices-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function InvoicesRoute() {
  return (
    <TabScreenFrame>
      <InvoicesOverview />
    </TabScreenFrame>
  );
}

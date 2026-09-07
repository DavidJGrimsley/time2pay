import React from 'react';
import { AppScreenChrome } from '@/components/app-screen-chrome';
import { ProjectsOverview } from '@/components/projects-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function ProjectsRoute() {
  return (
    <AppScreenChrome>
      <TabScreenFrame>
        <ProjectsOverview />
      </TabScreenFrame>
    </AppScreenChrome>
  );
}

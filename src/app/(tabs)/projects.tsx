import React from 'react';
import { ProjectsOverview } from '@/components/projects-overview';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function ProjectsRoute() {
  return (
    <TabScreenFrame>
      <ProjectsOverview />
    </TabScreenFrame>
  );
}

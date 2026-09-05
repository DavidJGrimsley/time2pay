import { PRIMARY_TAB_ROUTES } from '@/components/workspace-nav';

export function resolvePrimaryTabIndex(pathname: string): number {
  if (pathname === '/dashboard') {
    return 0;
  }

  return PRIMARY_TAB_ROUTES.findIndex((route) => {
    if (route.href === '/dashboard') {
      return false;
    }
    if (route.href === '/mercury') {
      return (
        pathname === '/mercury' ||
        pathname.startsWith('/mercury/') ||
        pathname === '/bank' ||
        pathname === '/payments'
      );
    }
    return pathname === route.href || pathname.startsWith(`${route.href}/`);
  });
}

export function tabHighlightDuration(fromIndex: number, toIndex: number): number {
  const distance = Math.abs(toIndex - fromIndex);
  if (distance <= 1) {
    return 160;
  }
  return Math.min(280, 120 + distance * 80);
}

/**
 * Active fill for tab `index` when the traveling highlight sits at `progress`.
 * The highlight occupies [progress, progress + 1] in index space, so a jump
 * from 0 → 2 fully lights tab 1 as it passes through.
 */
export function tabFillRange(
  progress: number,
  index: number,
  enabled = 1,
): { left: number; width: number } {
  'worklet';
  if (enabled <= 0) {
    return { left: 0, width: 0 };
  }

  const left = Math.max(0, progress - index);
  const right = Math.min(1, progress + 1 - index);
  return {
    left,
    width: Math.max(0, right - left),
  };
}

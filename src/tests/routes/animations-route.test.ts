import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/animations route registration', () => {
  const rootLayoutSource = readFileSync(resolve(process.cwd(), 'src/features/app/root-layout-screen.tsx'), 'utf8');

  it('registers the animation lab outside protected stack groups', () => {
    const animationsIndex = rootLayoutSource.indexOf('<Stack.Screen name="animations"');
    const protectedIndex = rootLayoutSource.indexOf('<Stack.Protected');

    expect(animationsIndex).toBeGreaterThan(0);
    expect(animationsIndex).toBeLessThan(protectedIndex);
  });

  it('keeps every non-landing route no-indexed', () => {
    expect(rootLayoutSource).toContain('{isLandingEntry ? <LandingSeoHead /> : <NoIndexSeoHead />}');
    expect(rootLayoutSource).toContain("const isLandingEntry = pathname === '/';");
  });
});

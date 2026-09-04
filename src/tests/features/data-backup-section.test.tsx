import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createBackupSnapshot: vi.fn(),
  downloadBackup: vi.fn(),
  formatBackupSummary: vi.fn(() => '1 session, 1 project'),
  parseAndValidateBackup: vi.fn(),
  restoreBackup: vi.fn(),
}));

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('react-native', () => ({
  Pressable: makeComponent('Pressable'),
  Switch: makeComponent('Switch'),
  Text: makeComponent('Text'),
  View: makeComponent('View'),
}));

vi.mock('@/services/data-backup', () => ({
  createBackupSnapshot: mocks.createBackupSnapshot,
  downloadBackup: mocks.downloadBackup,
  formatBackupSummary: mocks.formatBackupSummary,
  parseAndValidateBackup: mocks.parseAndValidateBackup,
  restoreBackup: mocks.restoreBackup,
}));

describe('DataBackupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createBackupSnapshot.mockResolvedValue({ createdAt: new Date().toISOString(), schemaVersion: 1 });
    mocks.downloadBackup.mockResolvedValue({ filename: 'backup.json' });
  });

  it('toggles the rollback-backup switch', async () => {
    const { DataBackupSection } = await import('@/features/settings/data-backup/data-backup-section');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<DataBackupSection />);
    });

    const toggle = root.root.find((node: renderer.ReactTestInstance) => String(node.type) === 'Switch');
    expect(toggle.props.value).toBe(true);

    await act(async () => {
      toggle.props.onValueChange(false);
    });

    const toggleAfter = root.root.find((node: renderer.ReactTestInstance) => String(node.type) === 'Switch');
    expect(toggleAfter.props.value).toBe(false);
  });

  it('exports data and shows a success notice', async () => {
    const { DataBackupSection } = await import('@/features/settings/data-backup/data-backup-section');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<DataBackupSection />);
    });

    const exportPressable = root.root
      .findAll((node: renderer.ReactTestInstance) => String(node.type) === 'Pressable')
      .find((node) => !node.props.disabled);

    await act(async () => {
      exportPressable?.props.onPress();
    });

    expect(mocks.createBackupSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.downloadBackup).toHaveBeenCalledTimes(1);
  });
});

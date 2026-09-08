import { useState } from 'react';
import {
  createBackupSnapshot,
  downloadBackup,
  formatBackupSummary,
  parseAndValidateBackup,
  restoreBackup,
} from '@/services/data-backup';
import { showActionErrorAlert, showSystemConfirm } from '@/services/system-alert';
import type { NoticeTone } from '@/components/inline-notice';

const FILE_PICKER_CANCELED_MESSAGE = 'Backup import canceled.';

type PickedBackupFile = {
  fileName: string;
  text: string;
};

async function pickBackupJsonFile(): Promise<PickedBackupFile> {
  if (process.env.EXPO_OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Backup import is only supported in web/PWA mode for now.');
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const cleanup = (): void => {
      input.onchange = null;
      input.removeEventListener('cancel', handleCancel);
      window.removeEventListener('focus', handleWindowFocus);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const handleCancel = (): void => {
      settle(() => reject(new Error(FILE_PICKER_CANCELED_MESSAGE)));
    };

    const handleWindowFocus = (): void => {
      window.setTimeout(() => {
        if (settled) {
          return;
        }

        const selectedFile = input.files?.[0];
        if (!selectedFile) {
          settle(() => reject(new Error(FILE_PICKER_CANCELED_MESSAGE)));
        }
      }, 300);
    };

    input.addEventListener('cancel', handleCancel);
    window.addEventListener('focus', handleWindowFocus);

    input.onchange = () => {
      const selectedFile = input.files?.[0];
      if (!selectedFile) {
        settle(() => reject(new Error(FILE_PICKER_CANCELED_MESSAGE)));
        return;
      }

      selectedFile
        .text()
        .then((text) => {
          settle(() =>
            resolve({
              fileName: selectedFile.name,
              text,
            }),
          );
        })
        .catch(() => {
          settle(() => reject(new Error('Failed to read backup file.')));
        });
    };

    input.click();
  });
}

type BackupStatus = { message: string; tone: NoticeTone } | null;

export function useDataBackupSection(onDataRestored?: () => void) {
  const [isExportingData, setIsExportingData] = useState(false);
  const [isImportingData, setIsImportingData] = useState(false);
  const [createSafetyBackupBeforeImport, setCreateSafetyBackupBeforeImport] = useState(true);
  const [status, setStatus] = useState<BackupStatus>(null);

  const backupBusy = isExportingData || isImportingData;

  async function handleExportData(): Promise<void> {
    setStatus(null);
    setIsExportingData(true);

    try {
      const snapshot = await createBackupSnapshot();
      const downloadResult = await downloadBackup(snapshot);
      setStatus({
        message: `Backup exported (${downloadResult.filename}). ${formatBackupSummary(snapshot)}.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to export backup.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsExportingData(false);
    }
  }

  async function handleImportData(): Promise<void> {
    setStatus(null);
    setIsImportingData(true);

    try {
      const pickedFile = await pickBackupJsonFile();
      const parsedBackup = parseAndValidateBackup(pickedFile.text);
      const confirmed = await showSystemConfirm({
        title: 'Replace local data?',
        message: [
          `File: ${pickedFile.fileName}`,
          `Created: ${new Date(parsedBackup.createdAt).toLocaleString()}`,
          `Schema version: ${parsedBackup.schemaVersion}`,
          `Contents: ${formatBackupSummary(parsedBackup)}`,
          '',
          'This will replace all local data in this browser origin.',
          `Rollback backup before import: ${createSafetyBackupBeforeImport ? 'ON' : 'OFF'}.`,
        ].join('\n'),
        confirmLabel: 'Import',
        cancelLabel: 'Cancel',
      });

      if (!confirmed) {
        setStatus({ message: FILE_PICKER_CANCELED_MESSAGE, tone: 'neutral' });
        return;
      }

      const restoreReport = await restoreBackup(parsedBackup, {
        replaceAll: true,
        createSafetyBackup: createSafetyBackupBeforeImport,
      });

      const rollbackMessage = restoreReport.safetyBackupFilename
        ? ` Rollback backup downloaded: ${restoreReport.safetyBackupFilename}.`
        : '';
      const preferenceMessage = restoreReport.preferenceRestored
        ? ''
        : ' Timer preference restore skipped for this environment.';

      setStatus({
        message: `Import complete. Restored ${formatBackupSummary(parsedBackup)}.${rollbackMessage}${preferenceMessage}`,
        tone: 'success',
      });
      onDataRestored?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to import backup.';
      if (message === FILE_PICKER_CANCELED_MESSAGE) {
        setStatus({ message, tone: 'neutral' });
      } else {
        showActionErrorAlert(message);
        setStatus({ message, tone: 'error' });
      }
    } finally {
      setIsImportingData(false);
    }
  }

  return {
    isExportingData,
    isImportingData,
    backupBusy,
    createSafetyBackupBeforeImport,
    setCreateSafetyBackupBeforeImport,
    status,
    handleExportData: () => {
      handleExportData().catch(() => undefined);
    },
    handleImportData: () => {
      handleImportData().catch(() => undefined);
    },
  };
}

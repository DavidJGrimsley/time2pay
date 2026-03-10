import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import {
  getUserProfile,
  initializeDatabase,
  listClients,
  upsertUserProfile,
  updateClientInvoiceContact,
  type Client,
} from '@/database/db';
import {
  evaluateProfileCompletion,
  REQUIRED_PROFILE_FIELD_LABELS,
} from '@/services/profile-completion';
import {
  createBackupSnapshot,
  downloadBackup,
  formatBackupSummary,
  parseAndValidateBackup,
  restoreBackup,
} from '@/services/data-backup';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { showActionErrorAlert, showSystemConfirm, showValidationAlert } from '@/services/system-alert';

const EMPTY_PICKER_VALUE = '';
const FILE_PICKER_CANCELED_MESSAGE = 'Backup import canceled.';

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

type PickedBackupFile = {
  fileName: string;
  text: string;
};

function toNullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

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

export function ProfileOverview() {
  const { width } = useWindowDimensions();
  const scheme = useColorScheme();
  const pickerTextColor = scheme === 'dark' ? '#f8f7f3' : '#1a1f16';
  const pickerPlaceholderColor = scheme === 'dark' ? '#b8b7b2' : '#6f7868';
  const pickerSurfaceColor = scheme === 'dark' ? '#1a1f16' : '#f8f7f3';
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isImportingData, setIsImportingData] = useState(false);
  const [createSafetyBackupBeforeImport, setCreateSafetyBackupBeforeImport] = useState(true);
  const [status, setStatus] = useState<StatusNotice | null>({
    message: 'Loading profile...',
    tone: 'neutral',
  });

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const refreshClients = useCallback(async (preferredClientId?: string | null): Promise<void> => {
    const clientRows = await listClients();
    setClients(clientRows);
    setSelectedClientId((current) => {
      if (preferredClientId && clientRows.some((client) => client.id === preferredClientId)) {
        return preferredClientId;
      }
      if (current && clientRows.some((client) => client.id === current)) {
        return current;
      }
      return clientRows[0]?.id ?? null;
    });
  }, []);

  const loadProfileData = useCallback(async (): Promise<void> => {
    setStatus({ message: 'Loading profile...', tone: 'neutral' });
    const profile = await getUserProfile();
    setCompanyName(profile.company_name ?? '');
    setLogoUrl(profile.logo_url ?? '');
    setFullName(profile.full_name ?? '');
    setBusinessPhone(profile.phone ?? '');
    setBusinessEmail(profile.email ?? '');
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(() => Promise.all([loadProfileData(), refreshClients()]))
      .then(() => setStatus({ message: 'Profile loaded.', tone: 'neutral' }))
      .catch((error: unknown) => {
        setStatus({
          message: error instanceof Error ? error.message : 'Failed to load profile.',
          tone: 'error',
        });
      })
      .finally(() => setIsLoading(false));
  }, [loadProfileData, refreshClients]);

  useEffect(() => {
    if (!selectedClient) {
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      return;
    }

    setClientName(selectedClient.name);
    setClientPhone(selectedClient.phone ?? '');
    setClientEmail(selectedClient.email ?? '');
  }, [selectedClient]);

  async function handleSaveBusiness(): Promise<void> {
    setStatus(null);
    const trimmedFullName = fullName.trim();
    const trimmedBusinessPhone = businessPhone.trim();
    const trimmedBusinessEmail = businessEmail.trim();
    const completion = evaluateProfileCompletion({
      full_name: trimmedFullName,
      phone: trimmedBusinessPhone,
      email: trimmedBusinessEmail,
    });

    if (!completion.isComplete) {
      const missing = completion.missingFields
        .map((field) => REQUIRED_PROFILE_FIELD_LABELS[field])
        .join(', ');
      const message = `Missing required business profile fields: ${missing}.`;
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    setIsSavingBusiness(true);
    try {
      await upsertUserProfile({
        company_name: toNullableTrimmed(companyName),
        logo_url: toNullableTrimmed(logoUrl),
        full_name: trimmedFullName,
        phone: trimmedBusinessPhone,
        email: trimmedBusinessEmail,
      });
      await loadProfileData();
      setStatus({ message: 'Business profile saved.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save business profile.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSavingBusiness(false);
    }
  }

  async function handleSaveClient(): Promise<void> {
    if (!selectedClientId) {
      const message = 'Select a client to update.';
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    const trimmedClientName = clientName.trim();
    if (!trimmedClientName) {
      const message = 'Client company/name is required.';
      showValidationAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    setIsSavingClient(true);
    try {
      await updateClientInvoiceContact({
        id: selectedClientId,
        name: trimmedClientName,
        phone: toNullableTrimmed(clientPhone),
        email: toNullableTrimmed(clientEmail),
      });
      await refreshClients(selectedClientId);
      setStatus({ message: 'Client invoice contact saved.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save client contact.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSavingClient(false);
    }
  }

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
      await Promise.all([loadProfileData(), refreshClients()]);

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

  const backupBusy = isLoading || isSavingBusiness || isSavingClient || isExportingData || isImportingData;

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Profile</Text>
      <Text className="text-muted">
        Manage invoice sender details and client invoice contact details.
      </Text>
      <View className="items-center">
        <View className="w-full gap-3" style={contentWidthStyle}>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Your Business</Text>
        <TextInput
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Company name (optional)"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={logoUrl}
          onChangeText={setLogoUrl}
          placeholder="Logo URL (optional)"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={businessPhone}
          onChangeText={setBusinessPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={businessEmail}
          onChangeText={setBusinessEmail}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <Pressable
          className="rounded-md bg-secondary px-4 py-2"
          onPress={() => {
            handleSaveBusiness().catch(() => undefined);
          }}
          disabled={isSavingBusiness || isLoading}
        >
          <Text className="text-center font-semibold text-white">
            {isSavingBusiness ? 'Saving...' : 'Save Business Profile'}
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Client Invoice Contact</Text>
        {clients.length === 0 ? (
          <Text className="text-sm text-muted">
            No clients yet. Create one from the Dashboard timer flow, then edit invoice contact info here.
          </Text>
        ) : (
          <>
            <View className="rounded-md border border-border bg-background">
              <Picker
                selectedValue={selectedClientId ?? EMPTY_PICKER_VALUE}
                onValueChange={(value: string | number) => {
                  const next = String(value ?? EMPTY_PICKER_VALUE);
                  setSelectedClientId(next || null);
                }}
                dropdownIconColor={pickerTextColor}
                style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
              >
                <Picker.Item
                  label="Select client"
                  value={EMPTY_PICKER_VALUE}
                  color={pickerPlaceholderColor}
                  style={{ color: pickerPlaceholderColor, backgroundColor: pickerSurfaceColor }}
                />
                {clients.map((client) => (
                  <Picker.Item
                    key={client.id}
                    label={client.name}
                    value={client.id}
                    color={pickerTextColor}
                    style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                  />
                ))}
              </Picker>
            </View>

            <TextInput
              value={clientName}
              onChangeText={setClientName}
              placeholder="Client company/name"
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <TextInput
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="Client phone"
              keyboardType="phone-pad"
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <TextInput
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="Client email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <Pressable
              className="rounded-md bg-secondary px-4 py-2"
              onPress={() => {
                handleSaveClient().catch(() => undefined);
              }}
              disabled={isSavingClient || isLoading || !selectedClientId}
            >
              <Text className="text-center font-semibold text-white">
                {isSavingClient ? 'Saving...' : 'Save Client Contact'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Data Backup</Text>
        <Text className="text-sm text-muted">
          Export your local data to a JSON file and import it later if you move to a new port or browser origin.
        </Text>

        <View className="flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2">
          <Text className="flex-1 pr-2 text-sm text-foreground">
            Create rollback backup before import
          </Text>
          <Pressable
            className={createSafetyBackupBeforeImport ? 'rounded-full bg-secondary px-3 py-1.5' : 'rounded-full bg-primary px-3 py-1.5'}
            onPress={() => setCreateSafetyBackupBeforeImport((current) => !current)}
            disabled={backupBusy}
          >
            <Text className={createSafetyBackupBeforeImport ? 'font-semibold text-white' : 'font-semibold text-heading'}>
              {createSafetyBackupBeforeImport ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Pressable
            className="rounded-md bg-secondary px-4 py-2"
            onPress={() => {
              handleExportData().catch(() => undefined);
            }}
            disabled={backupBusy}
          >
            <Text className="text-center font-semibold text-white">
              {isExportingData ? 'Exporting...' : 'Export Data'}
            </Text>
          </Pressable>

          <Pressable
            className="rounded-md border border-border px-4 py-2"
            onPress={() => {
              handleImportData().catch(() => undefined);
            }}
            disabled={backupBusy}
          >
            <Text className="text-center font-semibold text-heading">
              {isImportingData ? 'Importing...' : 'Import Data'}
            </Text>
          </Pressable>
        </View>
      </View>

      {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}
        </View>
      </View>
    </View>
  );
}

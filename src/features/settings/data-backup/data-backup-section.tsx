import { Pressable, Switch, Text, View } from 'react-native';
import { InlineNotice } from '@/components/inline-notice';
import { useDataBackupSection } from './data-backup-logic';

type DataBackupSectionProps = {
  onDataRestored?: () => void;
};

export function DataBackupSection({ onDataRestored }: DataBackupSectionProps) {
  const {
    isExportingData,
    isImportingData,
    backupBusy,
    createSafetyBackupBeforeImport,
    setCreateSafetyBackupBeforeImport,
    status,
    handleExportData,
    handleImportData,
  } = useDataBackupSection(onDataRestored);

  return (
    <View className="gap-3">
      <Text className="text-sm text-muted">
        Export your local data to JSON and import it later. In hosted mode, import restores this
        snapshot into your signed-in account.
      </Text>

      <View className="flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2">
        <Text className="flex-1 pr-2 text-sm text-foreground">
          Create rollback backup before import
        </Text>
        <Switch
          value={createSafetyBackupBeforeImport}
          onValueChange={setCreateSafetyBackupBeforeImport}
          disabled={backupBusy}
        />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Pressable className="rounded-md bg-secondary px-4 py-2" onPress={handleExportData} disabled={backupBusy}>
          <Text className="text-center font-semibold text-white">
            {isExportingData ? 'Exporting...' : 'Export Data'}
          </Text>
        </Pressable>

        <Pressable
          className="rounded-md border border-border px-4 py-2"
          onPress={handleImportData}
          disabled={backupBusy}
        >
          <Text className="text-center font-semibold text-heading">
            {isImportingData ? 'Importing...' : 'Import Data'}
          </Text>
        </Pressable>
      </View>
      {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}
    </View>
  );
}

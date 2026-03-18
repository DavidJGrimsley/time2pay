import { Pressable, Text, useColorScheme, View } from 'react-native';
import type { Client, Project, Session, SessionBreak } from '@/database/db';
import {
  deriveSessionTimelineRows,
  groupInvoiceLineItemsByProject,
  type InvoiceComputation,
  type ProjectLineItemGroup,
} from '@/services/invoice';
import { GitHubCommitBadge } from '@/components/github-commit-badge';

export type WeekOption = {
  key: string;
  label: string;
  startIso: string;
  endIso: string;
  sessions: Session[];
};

type SessionInvoiceSourcePanelProps = {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  projects?: Project[];
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string | null) => void;
  weekOptions: WeekOption[];
  selectedWeekKeys: string[];
  onToggleWeek: (weekKey: string) => void;
  selectedClient: Client | null;
  preview: InvoiceComputation | null;
  groupedLineItems: ProjectLineItemGroup[];
  previewBreaksBySessionId: Record<string, SessionBreak[]>;
};

function WeekCheckIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 12, height: 12, position: 'relative' }}>
      <View
        style={{
          position: 'absolute',
          left: 1,
          top: 6,
          width: 4,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 3,
          top: 5,
          width: 8,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function endOfWeekSunday(startMonday: Date): Date {
  const copy = new Date(startMonday);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildWeekOptionsForClient(sessions: Session[]): WeekOption[] {
  const map = new Map<string, WeekOption>();

  for (const session of sessions) {
    const startDate = new Date(session.start_time);
    const monday = startOfWeekMonday(startDate);
    const sunday = endOfWeekSunday(monday);
    const key = isoDateOnly(monday);
    const existing = map.get(key);

    if (existing) {
      existing.sessions.push(session);
      continue;
    }

    map.set(key, {
      key,
      label: `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`,
      startIso: monday.toISOString(),
      endIso: new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      sessions: [session],
    });
  }

  return Array.from(map.values()).sort((a, b) => (a.startIso < b.startIso ? 1 : -1));
}

export function SessionInvoiceSourcePanel({
  clients,
  selectedClientId,
  onSelectClient,
  projects = [],
  selectedProjectId = null,
  onSelectProject,
  weekOptions,
  selectedWeekKeys,
  onToggleWeek,
  selectedClient,
  preview,
  groupedLineItems,
  previewBreaksBySessionId,
}: SessionInvoiceSourcePanelProps) {
  const scheme = useColorScheme();

  return (
    <View className="gap-3">
      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Client</Text>
        <View className="flex-row flex-wrap gap-2">
          {clients.map((client) => {
            const active = client.id === selectedClientId;
            return (
              <Pressable
                key={client.id}
                className={active ? 'rounded-full bg-primary px-3 py-1.5' : 'rounded-full bg-card px-3 py-1.5'}
                onPress={() => onSelectClient(client.id)}
              >
                <Text className={active ? 'font-semibold text-heading' : 'font-semibold text-muted'}>
                  {client.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {onSelectProject ? (
        <View className="gap-2">
          <Text className="text-xs uppercase tracking-wide text-muted">Project filter (optional)</Text>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              className={
                selectedProjectId === null
                  ? 'rounded-full bg-primary px-3 py-1.5'
                  : 'rounded-full bg-card px-3 py-1.5'
              }
              onPress={() => onSelectProject(null)}
            >
              <Text
                className={
                  selectedProjectId === null ? 'font-semibold text-heading' : 'font-semibold text-muted'
                }
              >
                All projects
              </Text>
            </Pressable>
            {projects.map((project) => {
              const active = project.id === selectedProjectId;
              return (
                <Pressable
                  key={project.id}
                  className={active ? 'rounded-full bg-primary px-3 py-1.5' : 'rounded-full bg-card px-3 py-1.5'}
                  onPress={() => onSelectProject(project.id)}
                >
                  <Text className={active ? 'font-semibold text-heading' : 'font-semibold text-muted'}>
                    {project.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Weeks (Mon-Sun)</Text>
        <View className="flex-row flex-wrap gap-2">
          {weekOptions.map((week) => {
            const active = selectedWeekKeys.includes(week.key);
            return (
              <Pressable
                key={week.key}
                className={active ? 'rounded-full bg-secondary px-3 py-1.5' : 'rounded-full bg-primary px-3 py-1.5'}
                onPress={() => onToggleWeek(week.key)}
              >
                <View className="flex-row items-center gap-1.5">
                  {active ? <WeekCheckIcon color={scheme === 'dark' ? '#1a1f16' : '#ffffff'} /> : null}
                  <Text className={active ? 'font-semibold text-white' : 'font-semibold text-heading'}>
                    {week.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {weekOptions.length === 0 ? (
            <Text className="text-sm text-muted">No uninvoiced sessions for this client yet.</Text>
          ) : null}
        </View>
      </View>

      <View className="gap-2 rounded-md border border-border bg-background p-3">
        <Text className="font-semibold text-heading">Invoice Preview Line Items</Text>
        {!preview ? (
          <Text className="text-sm text-muted">Select a client and at least one week to preview.</Text>
        ) : null}
        {preview ? (
          <Text className="text-sm text-muted">
            Session-derived total: ${preview.totalAmount.toFixed(2)} across {preview.totalHours.toFixed(2)} hours.
          </Text>
        ) : null}
        {groupedLineItems.map((projectGroup) => (
          <View key={projectGroup.projectLabel} className="gap-1">
            <Text className="font-semibold text-heading">Project: {projectGroup.projectLabel}</Text>
            <View className="ml-3 mt-1 overflow-hidden rounded-md border border-border bg-card">
              <View className="flex-row border-b border-border bg-background px-2 py-1">
                <Text style={{ width: '56%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Task
                </Text>
                <Text style={{ width: '14%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Time
                </Text>
                <Text style={{ width: '14%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Rate
                </Text>
                <Text style={{ width: '16%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Amount
                </Text>
              </View>

              {projectGroup.tasks.map((taskGroup) => (
                <View key={taskGroup.taskLabel} className="border-b border-border/60 px-2 py-1.5">
                  <View className="flex-row py-0.5">
                    <Text style={{ width: '56%' }} className="text-xs font-semibold text-heading">
                      {taskGroup.taskLabel}
                    </Text>
                    <Text style={{ width: '14%' }} className="text-right text-xs text-foreground">
                      {taskGroup.totalHours.toFixed(2)}h
                    </Text>
                    <Text style={{ width: '14%' }} className="text-right text-xs text-foreground">
                      ${selectedClient?.hourly_rate.toFixed(2) ?? '0.00'}
                    </Text>
                    <Text style={{ width: '16%' }} className="text-right text-xs text-foreground">
                      ${taskGroup.totalAmount.toFixed(2)}
                    </Text>
                  </View>

                  <View className="mt-1 border border-border/50 bg-background">
                    <View className="flex-row border-b border-border/50 px-2 py-1">
                      <Text style={{ width: '40%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Start
                      </Text>
                      <Text style={{ width: '40%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                        End
                      </Text>
                      <Text style={{ width: '10%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                        Hrs
                      </Text>
                      <Text style={{ width: '10%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                        $
                      </Text>
                    </View>

                    {taskGroup.sessions.map((session, sessionIndex) => (
                      <View
                        key={session.id}
                        className={
                          sessionIndex % 2 === 0
                            ? 'border-b border-border/50 bg-primary/45 px-2 py-1'
                            : 'border-b border-border/50 px-2 py-1'
                        }
                      >
                        {deriveSessionTimelineRows({
                          session,
                          breaks: previewBreaksBySessionId[session.id] ?? [],
                          hourlyRate: selectedClient?.hourly_rate ?? 0,
                        }).map((row) => (
                          <View key={row.id} className="flex-row py-0.5">
                            <Text
                              style={{ width: '40%' }}
                              className={row.isBreak ? 'text-xs text-secondary' : 'text-xs text-foreground'}
                            >
                              {new Date(row.start_time).toLocaleString()}
                            </Text>
                            <Text
                              style={{ width: '40%' }}
                              className={row.isBreak ? 'text-xs text-secondary' : 'text-xs text-foreground'}
                            >
                              {new Date(row.end_time).toLocaleString()}
                            </Text>
                            <Text
                              style={{ width: '10%' }}
                              className={
                                row.isBreak
                                  ? 'text-right text-xs font-semibold text-secondary'
                                  : 'text-right text-xs text-foreground'
                              }
                            >
                              {row.isBreak ? 'Break' : row.hours.toFixed(2)}
                            </Text>
                            <Text
                              style={{ width: '10%' }}
                              className={row.isBreak ? 'text-right text-xs text-secondary' : 'text-right text-xs text-foreground'}
                            >
                              {row.isBreak ? '-' : row.amount.toFixed(2)}
                            </Text>
                          </View>
                        ))}
                        <GitHubCommitBadge
                          commitSha={session.commit_sha}
                          commitUrl={session.commit_url ?? null}
                          containerClassName="pt-0.5"
                          textClassName="text-xs text-secondary"
                        />
                        {session.notes ? (
                          <Text className="pt-0.5 text-xs text-foreground/70">{session.notes}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Text className="text-right text-sm font-semibold text-heading">
              Project total: ${projectGroup.totalAmount.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function buildGroupedLineItems(preview: InvoiceComputation | null): ProjectLineItemGroup[] {
  return preview ? groupInvoiceLineItemsByProject(preview.sessions) : [];
}

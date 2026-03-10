import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { getUserProfile } from '@/database/db';
import {
  fetchCommitInfo,
  inferBranchFromCommit,
  listRecentCommits,
  type GitHubCommitSummary,
} from '@/services/github';
import { InlineNotice } from '@/components/inline-notice';

const EMPTY_PICKER_VALUE = '';

export type SessionCompleteResult = {
  notes: string | null;
  commitSha: string | null;
};

type SessionCompleteModalProps = {
  visible: boolean;
  initialNotes: string | null;
  githubOrg: string | null;
  githubRepo: string | null;
  githubBranch: string | null;
  onSave: (result: SessionCompleteResult) => void;
  onSkip: () => void;
};

type ParsedCommitUrl = {
  owner: string;
  repo: string;
  sha: string;
};

const COMMIT_URL_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})/i;

function parseCommitUrl(input: string): ParsedCommitUrl | null {
  const match = input.trim().match(COMMIT_URL_RE);
  if (!match) {
    return null;
  }

  return {
    owner: match[1],
    repo: match[2],
    sha: match[3],
  };
}

function normalizeCompare(input: string | null | undefined): string {
  return input?.trim().toLowerCase() ?? '';
}

function formatGitHubCommitLine(sha: string, message: string): string {
  const shortSha = sha.trim().slice(0, 7);
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return `GH commit ${shortSha}`;
  }

  return `GH commit ${shortSha}: ${trimmedMessage}`;
}

export function SessionCompleteModal({
  visible,
  initialNotes,
  githubOrg,
  githubRepo,
  githubBranch,
  onSave,
  onSkip,
}: SessionCompleteModalProps) {
  const scheme = useColorScheme();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const isLargeScreen = viewportWidth >= 1200;
  const pickerTextColor = scheme === 'dark' ? '#f8f7f3' : '#1a1f16';
  const pickerPlaceholderColor = scheme === 'dark' ? '#b8b7b2' : '#6f7868';
  const pickerSurfaceColor = scheme === 'dark' ? '#1a1f16' : '#f8f7f3';
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [commitUrl, setCommitUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [branchWarning, setBranchWarning] = useState<string | null>(null);
  const [requiresBranchConfirmation, setRequiresBranchConfirmation] = useState(false);
  const [branchConfirmed, setBranchConfirmed] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [recentCommits, setRecentCommits] = useState<GitHubCommitSummary[]>([]);
  const [selectedRecentCommitSha, setSelectedRecentCommitSha] = useState('');
  const [isLoadingRecentCommits, setIsLoadingRecentCommits] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setNotes(initialNotes ?? '');
    setCommitUrl('');
    setCommitSha('');
    setIsFetching(false);
    setFetchError(null);
    setBranchWarning(null);
    setRequiresBranchConfirmation(false);
    setBranchConfirmed(false);
    setFetchStatus(null);
    setRecentCommits([]);
    setSelectedRecentCommitSha('');
    setIsLoadingRecentCommits(false);
  }, [visible, initialNotes]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    getUserProfile()
      .then((profile) => {
        if (!cancelled) {
          setGithubToken(profile.github_pat ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGithubToken(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const expectedTargetSummary = useMemo(() => {
    const owner = githubOrg?.trim() || '(owner not set)';
    const repo = githubRepo?.trim() || '(repo not set)';
    const branch = githubBranch?.trim() || '(branch not set)';
    return `${owner}/${repo} • ${branch}`;
  }, [githubOrg, githubRepo, githubBranch]);

  async function handleLoadRecentCommits(): Promise<void> {
    const owner = githubOrg?.trim() ?? '';
    const repo = githubRepo?.trim() ?? '';
    if (!owner || !repo) {
      setFetchError('Client/project must have GitHub org and repo before loading commits.');
      return;
    }

    setIsLoadingRecentCommits(true);
    setFetchError(null);
    setFetchStatus(null);
    try {
      const commits = await listRecentCommits(owner, repo, {
        token: githubToken ?? undefined,
        branch: githubBranch?.trim() || undefined,
        perPage: 30,
      });
      setRecentCommits(commits);
      if (commits.length === 0) {
        setFetchStatus('No recent commits found for this target.');
      } else {
        setFetchStatus(`Loaded ${commits.length} recent commits.`);
      }
    } catch {
      setFetchError('Could not load recent commits.');
      setRecentCommits([]);
    } finally {
      setIsLoadingRecentCommits(false);
    }
  }

  async function handleFetchAndApply(mode: 'overwrite' | 'append'): Promise<void> {
    const parsed = parseCommitUrl(commitUrl);
    if (!parsed) {
      setFetchError('Paste a valid GitHub commit URL.');
      setBranchWarning(null);
      setRequiresBranchConfirmation(false);
      setBranchConfirmed(false);
      setFetchStatus(null);
      setCommitSha('');
      return;
    }

    setIsFetching(true);
    setFetchError(null);
    setBranchWarning(null);
    setRequiresBranchConfirmation(false);
    setFetchStatus(null);
    setCommitSha('');

    try {
      const hardMismatches: string[] = [];

      if (githubOrg?.trim()) {
        if (normalizeCompare(parsed.owner) !== normalizeCompare(githubOrg)) {
          hardMismatches.push(
            `Owner mismatch: expected "${githubOrg.trim()}", commit has "${parsed.owner}".`,
          );
        }
      }

      if (githubRepo?.trim()) {
        if (normalizeCompare(parsed.repo) !== normalizeCompare(githubRepo)) {
          hardMismatches.push(
            `Repo mismatch: expected "${githubRepo.trim()}", commit has "${parsed.repo}".`,
          );
        }
      }

      if (hardMismatches.length > 0) {
        setFetchError(hardMismatches.join(' '));
        return;
      }

      if (githubBranch?.trim()) {
        const inferred = await inferBranchFromCommit(
          parsed.owner,
          parsed.repo,
          parsed.sha,
          githubToken ?? undefined,
        );
        const inferredBranch = inferred.branch?.trim() ?? null;

        let nextBranchWarning: string | null = null;
        if (!inferredBranch) {
          nextBranchWarning = `Branch could not be verified. Clocked-in branch is "${githubBranch.trim()}".`;
        } else if (normalizeCompare(inferredBranch) !== normalizeCompare(githubBranch)) {
          nextBranchWarning = `Branch mismatch: expected "${githubBranch.trim()}", inferred "${inferredBranch}".`;
        }

        if (nextBranchWarning) {
          setBranchWarning(nextBranchWarning);
          setRequiresBranchConfirmation(true);
          if (!branchConfirmed) {
            setFetchStatus(null);
            return;
          }
        }
      }

      const info = await fetchCommitInfo(
        parsed.owner,
        parsed.repo,
        parsed.sha,
        githubToken ?? undefined,
      );
      if (!info) {
        setFetchError('Could not fetch commit. Check URL/SHA and repository access.');
        return;
      }

      const ghLine = formatGitHubCommitLine(info.sha, info.message);
      if (mode === 'overwrite') {
        setNotes(ghLine);
      } else {
        setNotes((current) => {
          const trimmed = current.trim();
          return trimmed ? `${trimmed}\n\n${ghLine}` : ghLine;
        });
      }

      setCommitSha(info.sha.trim());
      setFetchStatus(`Fetched ${info.sha.slice(0, 7)} and updated notes.`);
    } catch {
      setFetchError('GitHub fetch failed. Please try again.');
    } finally {
      setIsFetching(false);
    }
  }

  function handleSave(): void {
    onSave({
      notes: notes.trim() || null,
      commitSha: commitSha.trim() || null,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4 py-4">
        <View
          className="w-full max-w-lg rounded-xl bg-card shadow-lg"
          style={{ maxHeight: Math.max(360, viewportHeight - 32) }}
        >
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}
          >
            <Text className="mb-4 text-xl font-bold text-heading">Session Complete</Text>

            <Text className="mb-1 text-xs uppercase tracking-wide text-muted">Session Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What did you work on?"
              multiline
              numberOfLines={4}
              className="mb-4 min-h-[72px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
              textAlignVertical="top"
            />

            <View className="mb-4 gap-3 rounded-md border border-border bg-background p-3">
              <Text className="text-xs uppercase tracking-wide text-muted">GitHub Commit</Text>
              <Text className="text-xs text-muted">Clocked-in target: {expectedTargetSummary}</Text>
              {githubToken?.trim() && githubOrg?.trim() && githubRepo?.trim() ? (
                <View className="gap-2">
                  <Pressable
                    className={`items-center rounded-md border border-primary px-3 py-2 ${isLoadingRecentCommits ? 'opacity-70' : ''}`}
                    onPress={() => {
                      handleLoadRecentCommits().catch(() => undefined);
                    }}
                    disabled={isLoadingRecentCommits}
                  >
                    <Text className="font-semibold text-primary">
                      {isLoadingRecentCommits ? 'Loading commits...' : 'Load Recent Commits'}
                    </Text>
                  </Pressable>
                  {recentCommits.length > 0 ? (
                    <View className="rounded-md border border-border bg-card">
                      <Picker
                        selectedValue={selectedRecentCommitSha || EMPTY_PICKER_VALUE}
                        onValueChange={(value) => {
                          const nextSha = String(value ?? EMPTY_PICKER_VALUE);
                          setSelectedRecentCommitSha(nextSha);
                          if (!nextSha) {
                            return;
                          }

                          const selectedCommit =
                            recentCommits.find((commit) => commit.sha === nextSha) ?? null;
                          if (!selectedCommit) {
                            return;
                          }

                          setCommitUrl(selectedCommit.htmlUrl);
                          setFetchError(null);
                          setBranchWarning(null);
                          setRequiresBranchConfirmation(false);
                          setBranchConfirmed(false);
                          setFetchStatus(
                            `Selected ${selectedCommit.shortSha}. Choose Fetch & Overwrite or Fetch & Append.`,
                          );
                        }}
                        dropdownIconColor={pickerTextColor}
                        style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                      >
                        <Picker.Item
                          label="Select recent commit"
                          value={EMPTY_PICKER_VALUE}
                          color={pickerPlaceholderColor}
                          style={{ color: pickerPlaceholderColor, backgroundColor: pickerSurfaceColor }}
                        />
                        {recentCommits.map((commit) => (
                          <Picker.Item
                            key={commit.sha}
                            label={`${commit.shortSha} - ${commit.message}`}
                            value={commit.sha}
                            color={pickerTextColor}
                            style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                          />
                        ))}
                      </Picker>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <TextInput
                value={commitUrl}
                onChangeText={(value) => {
                  setCommitUrl(value);
                  setFetchError(null);
                  setBranchWarning(null);
                  setRequiresBranchConfirmation(false);
                  setBranchConfirmed(false);
                  setFetchStatus(null);
                }}
                placeholder="https://github.com/owner/repo/commit/sha"
                autoCapitalize="none"
                autoCorrect={false}
                className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
              />

              {fetchError ? (
                <InlineNotice tone="error" message={fetchError} textClassName="text-xs text-danger" />
              ) : null}
              {branchWarning ? (
                <InlineNotice
                  tone="neutral"
                  message={branchWarning}
                  className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2"
                  textClassName="text-xs text-warning"
                />
              ) : null}
              {requiresBranchConfirmation ? (
                <Pressable
                  className={`rounded-md border px-3 py-2 ${
                    branchConfirmed
                      ? 'border-primary bg-success/20'
                      : 'border-primary bg-warning/20'
                  }`}
                  onPress={() => {
                    setBranchConfirmed((value) => !value);
                    setFetchError(null);
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      branchConfirmed ? 'text-foreground' : 'text-foreground'
                    }`}
                  >
                    {branchConfirmed
                      ? 'Branch warning confirmed. Fetch is allowed.'
                      : 'Confirm to fetch anyway despite branch warning.'}
                  </Text>
                </Pressable>
              ) : null}
              {fetchStatus ? (
                <InlineNotice
                  tone="success"
                  message={fetchStatus}
                  textClassName="text-xs text-success"
                />
              ) : null}

              <View className={isLargeScreen ? 'flex-row gap-2' : 'gap-2'}>
                <Pressable
                  className={`${isLargeScreen ? 'flex-1' : ''} items-center rounded-md bg-secondary px-3 py-2`}
                  onPress={() => {
                    handleFetchAndApply('overwrite').catch(() => undefined);
                  }}
                  disabled={isFetching}
                >
                  <Text className="font-semibold text-white">
                    {isFetching ? 'Fetching...' : 'Fetch & Overwrite'}
                  </Text>
                </Pressable>
                <Pressable
                  className={`${isLargeScreen ? 'flex-1' : ''} items-center rounded-md border border-secondary px-3 py-2`}
                  onPress={() => {
                    handleFetchAndApply('append').catch(() => undefined);
                  }}
                  disabled={isFetching}
                >
                  <Text className="font-semibold text-secondary">
                    {isFetching ? 'Fetching...' : 'Fetch & Append'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View className="flex-row gap-2 border-t border-border/70 px-5 pb-5 pt-3">
            <Pressable className="flex-1 rounded-2xl bg-secondary px-4 py-3" onPress={handleSave}>
              <Text className="text-center font-semibold text-white">Save</Text>
            </Pressable>
            <Pressable
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3"
              onPress={onSkip}
            >
              <Text className="text-center font-semibold text-heading">Skip</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

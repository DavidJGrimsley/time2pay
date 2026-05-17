import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { getUserProfile } from '@/database/db';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import {
  fetchCommitInfo,
  fetchPullRequest,
  inferBranchFromCommit,
  listPullRequests,
  listRecentCommits,
  parseGitHubPullRequestUrl,
  type GitHubCommitSummary,
  type GitHubPullRequestSummary,
} from '@/services/github';
import { resolveGitHubApiToken } from '@/services/github-auth';
import { InlineNotice } from '@/components/inline-notice';

const EMPTY_PICKER_VALUE = '';
type PullRequestPickerMode = 'open' | 'merged';

export type SessionCompleteResult = {
  notes: string | null;
  commitSha: string | null;
  prUrl: string | null;
  prNumber: number | null;
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
  const { height: viewportHeight, width: viewportWidth } = useStableWindowDimensions();
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
  const [prUrlInput, setPrUrlInput] = useState('');
  const [resolvedPrUrl, setResolvedPrUrl] = useState<string | null>(null);
  const [resolvedPrNumber, setResolvedPrNumber] = useState<number | null>(null);
  const [prError, setPrError] = useState<string | null>(null);
  const [prStatus, setPrStatus] = useState<string | null>(null);
  const [prPickerMode, setPrPickerMode] = useState<PullRequestPickerMode>('open');
  const [pullRequests, setPullRequests] = useState<GitHubPullRequestSummary[]>([]);
  const [selectedPullRequestNumber, setSelectedPullRequestNumber] = useState('');
  const [isLoadingPullRequests, setIsLoadingPullRequests] = useState(false);
  const [isFetchingPr, setIsFetchingPr] = useState(false);

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
    setPrUrlInput('');
    setResolvedPrUrl(null);
    setResolvedPrNumber(null);
    setPrError(null);
    setPrStatus(null);
    setPrPickerMode('open');
    setPullRequests([]);
    setSelectedPullRequestNumber('');
    setIsLoadingPullRequests(false);
    setIsFetchingPr(false);
  }, [visible, initialNotes]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    getUserProfile()
      .then(async (profile) => {
        if (!cancelled) {
          setGithubToken(await resolveGitHubApiToken(profile.github_pat ?? null));
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

  async function handleLoadPullRequests(): Promise<void> {
    const owner = githubOrg?.trim() ?? '';
    const repo = githubRepo?.trim() ?? '';
    if (!owner || !repo) {
      setPrError('Client/project must have GitHub org and repo before loading PRs.');
      return;
    }

    setIsLoadingPullRequests(true);
    setPrError(null);
    setPrStatus(null);
    try {
      const branch = githubBranch?.trim();
      const head = branch ? `${owner}:${branch}` : null;
      const desiredState = prPickerMode === 'open' ? 'open' : 'closed';

      let didBroadenSearch = false;
      const basePrs = await listPullRequests(owner, repo, {
        state: desiredState,
        token: githubToken ?? undefined,
        head,
        perPage: 30,
      });

      let prs =
        prPickerMode === 'merged' ? basePrs.filter((entry) => entry.merged) : basePrs;

      if (prPickerMode === 'merged' && prs.length === 0 && head) {
        didBroadenSearch = true;
        const retry = await listPullRequests(owner, repo, {
          state: 'closed',
          token: githubToken ?? undefined,
          head: null,
          perPage: 30,
        });
        prs = retry.filter((entry) => entry.merged);
      }

      setPullRequests(prs);
      const label = prPickerMode === 'merged' ? 'merged' : 'open';
      setPrStatus(
        prs.length === 0
          ? `No ${label} pull requests found for this target.${didBroadenSearch ? ' (Searched repo without branch filter.)' : ''}`
          : `Loaded ${prs.length} ${label} pull request${prs.length === 1 ? '' : 's'}.${didBroadenSearch ? ' (Broader repo search.)' : ''}`,
      );
    } catch {
      setPrError('Could not load pull requests.');
      setPullRequests([]);
    } finally {
      setIsLoadingPullRequests(false);
    }
  }

  async function handleApplyPrUrl(): Promise<void> {
    const parsed = parseGitHubPullRequestUrl(prUrlInput);
    if (!parsed) {
      setPrError('Paste a valid GitHub pull request URL (https://github.com/owner/repo/pull/123).');
      setResolvedPrUrl(null);
      setResolvedPrNumber(null);
      setPrStatus(null);
      return;
    }

    if (githubOrg?.trim() && normalizeCompare(parsed.owner) !== normalizeCompare(githubOrg)) {
      setPrError(`Owner mismatch: expected "${githubOrg.trim()}", PR has "${parsed.owner}".`);
      return;
    }
    if (githubRepo?.trim() && normalizeCompare(parsed.repo) !== normalizeCompare(githubRepo)) {
      setPrError(`Repo mismatch: expected "${githubRepo.trim()}", PR has "${parsed.repo}".`);
      return;
    }

    setIsFetchingPr(true);
    setPrError(null);
    try {
      const summary = await fetchPullRequest(
        parsed.owner,
        parsed.repo,
        parsed.number,
        githubToken ?? undefined,
      );
      if (summary) {
        setResolvedPrUrl(summary.htmlUrl);
        setResolvedPrNumber(summary.number);
        const stateLabel = summary.merged ? 'merged' : summary.state;
        setPrStatus(`Linked PR #${summary.number} (${stateLabel}).`);
      } else {
        setResolvedPrUrl(`https://github.com/${parsed.owner}/${parsed.repo}/pull/${parsed.number}`);
        setResolvedPrNumber(parsed.number);
        setPrStatus(`Linked PR #${parsed.number} (state not verified).`);
      }
    } finally {
      setIsFetchingPr(false);
    }
  }

  function handleClearPr(): void {
    setPrUrlInput('');
    setResolvedPrUrl(null);
    setResolvedPrNumber(null);
    setPrError(null);
    setPrStatus(null);
    setSelectedPullRequestNumber('');
  }

  function handleSave(): void {
    onSave({
      notes: notes.trim() || null,
      commitSha: commitSha.trim() || null,
      prUrl: resolvedPrUrl,
      prNumber: resolvedPrNumber,
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

            <View className="mb-4 gap-3 rounded-md border border-border bg-background p-3">
              <Text className="text-xs uppercase tracking-wide text-muted">Pull Request (optional)</Text>
              <Text className="text-xs text-muted">
                Attach an open or merged PR so this session links to its review history.
              </Text>
              {githubToken?.trim() && githubOrg?.trim() && githubRepo?.trim() ? (
                <View className="gap-2">
                  <View className="gap-2">
                    <Text className="text-xs uppercase tracking-wide text-muted">PR State</Text>
                    <View className="rounded-md border border-border bg-card">
                      <Picker
                        selectedValue={prPickerMode}
                        onValueChange={(value) => {
                          const next = String(value ?? 'open');
                          const nextMode: PullRequestPickerMode = next === 'merged' ? 'merged' : 'open';
                          setPrPickerMode(nextMode);
                          setPullRequests([]);
                          setSelectedPullRequestNumber('');
                          setPrError(null);
                          setPrStatus(null);
                        }}
                        dropdownIconColor={pickerTextColor}
                        style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                      >
                        <Picker.Item
                          label="Open pull requests"
                          value="open"
                          color={pickerTextColor}
                          style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                        />
                        <Picker.Item
                          label="Merged pull requests"
                          value="merged"
                          color={pickerTextColor}
                          style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                        />
                      </Picker>
                    </View>
                  </View>
                  <Pressable
                    className={`items-center rounded-md border border-primary px-3 py-2 ${isLoadingPullRequests ? 'opacity-70' : ''}`}
                    onPress={() => {
                      handleLoadPullRequests().catch(() => undefined);
                    }}
                    disabled={isLoadingPullRequests}
                  >
                    <Text className="font-semibold text-primary">
                      {isLoadingPullRequests ? 'Loading PRs...' : 'Load Pull Requests'}
                    </Text>
                  </Pressable>
                  {pullRequests.length > 0 ? (
                    <View className="rounded-md border border-border bg-card">
                      <Picker
                        selectedValue={selectedPullRequestNumber || EMPTY_PICKER_VALUE}
                        onValueChange={(value) => {
                          const nextValue = String(value ?? EMPTY_PICKER_VALUE);
                          setSelectedPullRequestNumber(nextValue);
                          if (!nextValue) {
                            return;
                          }
                          const selected = pullRequests.find(
                            (entry) => String(entry.number) === nextValue,
                          );
                          if (!selected) {
                            return;
                          }
                          setPrUrlInput(selected.htmlUrl);
                          setResolvedPrUrl(selected.htmlUrl);
                          setResolvedPrNumber(selected.number);
                          setPrError(null);
                          const stateLabel = selected.merged ? 'merged' : selected.state;
                          setPrStatus(`Linked PR #${selected.number} (${stateLabel}).`);
                        }}
                        dropdownIconColor={pickerTextColor}
                        style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                      >
                        <Picker.Item
                          label="Select a pull request"
                          value={EMPTY_PICKER_VALUE}
                          color={pickerPlaceholderColor}
                          style={{ color: pickerPlaceholderColor, backgroundColor: pickerSurfaceColor }}
                        />
                        {pullRequests.map((entry) => (
                          <Picker.Item
                            key={entry.number}
                            label={`#${entry.number} - ${entry.title || entry.headBranch}`}
                            value={String(entry.number)}
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
                value={prUrlInput}
                onChangeText={(value) => {
                  setPrUrlInput(value);
                  setPrError(null);
                  setPrStatus(null);
                }}
                placeholder="https://github.com/owner/repo/pull/123"
                autoCapitalize="none"
                autoCorrect={false}
                className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
              />
              {prError ? (
                <InlineNotice tone="error" message={prError} textClassName="text-xs text-danger" />
              ) : null}
              {prStatus ? (
                <InlineNotice tone="success" message={prStatus} textClassName="text-xs text-success" />
              ) : null}
              <View className={isLargeScreen ? 'flex-row gap-2' : 'gap-2'}>
                <Pressable
                  className={`${isLargeScreen ? 'flex-1' : ''} items-center rounded-md bg-secondary px-3 py-2`}
                  onPress={() => {
                    handleApplyPrUrl().catch(() => undefined);
                  }}
                  disabled={isFetchingPr || !prUrlInput.trim()}
                >
                  <Text className="font-semibold text-white">
                    {isFetchingPr ? 'Linking...' : 'Link PR'}
                  </Text>
                </Pressable>
                <Pressable
                  className={`${isLargeScreen ? 'flex-1' : ''} items-center rounded-md border border-border px-3 py-2`}
                  onPress={handleClearPr}
                  disabled={!prUrlInput.trim() && resolvedPrNumber === null}
                >
                  <Text className="font-semibold text-heading">Clear</Text>
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

import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { fetchCommitInfo } from '@/services/github';

/* ── types ─────────────────────────────────────────────────── */

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

/* ── helpers ───────────────────────────────────────────────── */

const COMMIT_URL_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})/i;

/** Parse a GitHub commit URL → { owner, repo, sha } or null */
function parseCommitUrl(input: string): { owner: string; repo: string; sha: string } | null {
  const m = input.trim().match(COMMIT_URL_RE);
  if (!m) return null;
  return { owner: m[1], repo: m[2], sha: m[3] };
}

const ANIM_DURATION = 280;
const TIMING_CONFIG = { duration: ANIM_DURATION, easing: Easing.out(Easing.cubic) };

/* ── component ─────────────────────────────────────────────── */

export function SessionCompleteModal({
  visible,
  initialNotes,
  githubOrg,
  githubRepo,
  githubBranch,
  onSave,
  onSkip,
}: SessionCompleteModalProps) {
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [showGitSection, setShowGitSection] = useState(false);
  const [commitUrl, setCommitUrl] = useState('');
  const [org, setOrg] = useState(githubOrg ?? '');
  const [repo, setRepo] = useState(githubRepo ?? '');
  const [branch, setBranch] = useState(githubBranch ?? '');
  const [commitSha, setCommitSha] = useState('');
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /* ── animated accordion ──────────────────────────────────── */
  const contentHeight = useSharedValue(0);
  const animatedOpacity = useSharedValue(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0 && h !== measuredHeight) {
        setMeasuredHeight(h);
        if (showGitSection) {
          contentHeight.value = withTiming(h, TIMING_CONFIG);
        }
      }
    },
    [contentHeight, showGitSection, measuredHeight],
  );

  useEffect(() => {
    if (showGitSection) {
      contentHeight.value = withTiming(measuredHeight || 400, TIMING_CONFIG);
      animatedOpacity.value = withTiming(1, TIMING_CONFIG);
    } else {
      contentHeight.value = withTiming(0, TIMING_CONFIG);
      animatedOpacity.value = withTiming(0, TIMING_CONFIG);
    }
  }, [showGitSection, measuredHeight, contentHeight, animatedOpacity]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: contentHeight.value,
    opacity: animatedOpacity.value,
    overflow: 'hidden' as const,
  }));

  /* ── sync props on open ──────────────────────────────────── */
  useEffect(() => {
    if (visible) {
      setNotes(initialNotes ?? '');
      setOrg(githubOrg ?? '');
      setRepo(githubRepo ?? '');
      setBranch(githubBranch ?? '');
      setCommitUrl('');
      setCommitSha('');
      setCommitMessage(null);
      setFetchError(null);
      setShowGitSection(false);
      setIsFetching(false);
      contentHeight.value = 0;
      animatedOpacity.value = 0;
    }
  }, [visible, initialNotes, githubOrg, githubRepo, githubBranch, contentHeight, animatedOpacity]);

  /* ── URL paste handler ───────────────────────────────────── */
  function handleCommitUrlChange(text: string): void {
    setCommitUrl(text);
    setCommitMessage(null);
    setFetchError(null);

    const parsed = parseCommitUrl(text);
    if (parsed) {
      setOrg(parsed.owner);
      setRepo(parsed.repo);
      setCommitSha(parsed.sha);
    }
  }

  /* ── fetch ───────────────────────────────────────────────── */
  const canFetch = Boolean(org.trim() && repo.trim() && commitSha.trim());

  async function handleFetchCommit(): Promise<void> {
    const sha = commitSha.trim();
    const owner = org.trim();
    const repoName = repo.trim();
    if (!sha || !owner || !repoName) return;

    setIsFetching(true);
    setFetchError(null);
    setCommitMessage(null);

    const info = await fetchCommitInfo(owner, repoName, sha);
    if (info) {
      setCommitMessage(info.message);
    } else {
      setFetchError('Could not fetch commit. Check the URL/SHA, or repo access.');
    }
    setIsFetching(false);
  }

  /* ── notes helpers ───────────────────────────────────────── */
  function handleOverwrite(): void {
    if (commitMessage) setNotes(commitMessage);
  }

  function handleAppend(): void {
    if (commitMessage) {
      const current = notes.trim();
      setNotes(current ? `${current}\n\n${commitMessage}` : commitMessage);
    }
  }

  function handleSave(): void {
    onSave({
      notes: notes.trim() || null,
      commitSha: commitSha.trim() || null,
    });
  }

  /* ── render ──────────────────────────────────────────────── */
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View className="flex-1 items-center justify-center bg-black/50 px-4">
        <View className="w-full max-w-lg rounded-xl bg-card p-5 shadow-lg">
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="mb-4 text-xl font-bold text-heading">Session Complete</Text>

            {/* ── Notes ─────────────────────────────────── */}
            <Text className="mb-1 text-xs uppercase tracking-wide text-muted">Session Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What did you work on?"
              multiline
              numberOfLines={4}
              className="mb-4 min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
              textAlignVertical="top"
            />

            {/* ── Toggle button ─────────────────────────── */}
            <Pressable
              className="mb-3 rounded-md border border-border bg-background px-3 py-2"
              onPress={() => setShowGitSection((o) => !o)}
            >
              <Text className="text-center text-sm font-medium text-heading">
                {showGitSection ? 'Hide Git Commit' : 'Link GitHub Commit'}
              </Text>
            </Pressable>

            {/* ── Animated git section ──────────────────── */}
            <Animated.View style={animatedContainerStyle}>
              <View onLayout={onContentLayout}>
                <View className="mb-4 gap-3 rounded-md border border-border bg-background p-3">
                  {/* Paste commit URL */}
                  <View className="gap-1">
                    <Text className="text-xs uppercase tracking-wide text-muted">
                      Paste Commit URL
                    </Text>
                    <TextInput
                      value={commitUrl}
                      onChangeText={handleCommitUrlChange}
                      placeholder="https://github.com/owner/repo/commit/sha"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                  </View>

                  {/* Divider */}
                  <View className="flex-row items-center gap-2">
                    <View className="h-px flex-1 bg-border" />
                    <Text className="text-xs text-muted">or fill manually</Text>
                    <View className="h-px flex-1 bg-border" />
                  </View>

                  {/* Manual fields */}
                  <View className="gap-2">
                    <View className="gap-1">
                      <Text className="text-xs uppercase tracking-wide text-muted">
                        GitHub Owner / Org
                      </Text>
                      <TextInput
                        value={org}
                        onChangeText={setOrg}
                        placeholder="e.g. DavidJGrimsley"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-xs uppercase tracking-wide text-muted">
                        Repository
                      </Text>
                      <TextInput
                        value={repo}
                        onChangeText={setRepo}
                        placeholder="e.g. time2pay"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-xs uppercase tracking-wide text-muted">
                        Branch (optional)
                      </Text>
                      <TextInput
                        value={branch}
                        onChangeText={setBranch}
                        placeholder="e.g. final-mvp-pass"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                      />
                    </View>
                    <View className="gap-1">
                      <Text className="text-xs uppercase tracking-wide text-muted">
                        Commit SHA
                      </Text>
                      <TextInput
                        value={commitSha}
                        onChangeText={(text) => {
                          setCommitSha(text);
                          setCommitMessage(null);
                          setFetchError(null);
                        }}
                        placeholder="e.g. abc1234 or full SHA"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                      />
                    </View>
                  </View>

                  {/* Fetch button */}
                  <Pressable
                    className={`items-center rounded-md px-3 py-2 ${canFetch ? 'bg-secondary' : 'bg-muted/40'}`}
                    onPress={handleFetchCommit}
                    disabled={isFetching || !canFetch}
                  >
                    <Text className="font-semibold text-white">
                      {isFetching ? 'Fetching...' : 'Fetch Commit'}
                    </Text>
                  </Pressable>

                  {/* Error */}
                  {fetchError ? (
                    <Text className="text-xs text-red-600">{fetchError}</Text>
                  ) : null}

                  {/* Commit message preview + overwrite/append */}
                  {commitMessage ? (
                    <View className="gap-2">
                      <Text className="text-xs uppercase tracking-wide text-muted">
                        Commit Message
                      </Text>
                      <View className="rounded-md border border-border bg-card p-2">
                        <Text className="text-sm text-foreground">{commitMessage}</Text>
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          className="flex-1 rounded-md bg-secondary px-3 py-2"
                          onPress={handleOverwrite}
                        >
                          <Text className="text-center text-sm font-semibold text-white">
                            Overwrite Notes
                          </Text>
                        </Pressable>
                        <Pressable
                          className="flex-1 rounded-md border border-secondary px-3 py-2"
                          onPress={handleAppend}
                        >
                          <Text className="text-center text-sm font-semibold text-secondary">
                            Append to Notes
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>

            {/* ── Footer ────────────────────────────────── */}
            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 rounded-2xl bg-secondary px-4 py-3"
                onPress={handleSave}
              >
                <Text className="text-center font-semibold text-white">Save</Text>
              </Pressable>
              <Pressable
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-3"
                onPress={onSkip}
              >
                <Text className="text-center font-semibold text-heading">Skip</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

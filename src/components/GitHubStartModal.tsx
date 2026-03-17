import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, useColorScheme, View } from 'react-native';
import {
  createProject,
  createTask,
  getUserProfile,
  initializeDatabase,
  listClients,
  listProjectsByClient,
  listTasksByProject,
  type Client,
  type Project,
  type Task,
} from '@/database/db';
import { createTime2PayClient } from '@/services/client-sync';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import {
  inferBranchFromCommit,
  listAuthenticatedRepos,
  listRepoBranches,
  parseGitHubUrl,
  prettifyBranchName,
  type GitHubRepoSummary,
} from '@/services/github';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

const EMPTY_PICKER_VALUE = '';

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function prettifyRepoName(repoName: string): string {
  const cleaned = repoName
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!cleaned) {
    return '';
  }

  return cleaned
    .split(' ')
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export type GitHubStartSelection = {
  clientId: string;
  projectId: string;
  taskId: string;
};

type GitHubStartModalProps = {
  visible: boolean;
  onClose: () => void;
  onComplete: (selection: GitHubStartSelection) => void;
};

type StatusNotice = {
  tone: NoticeTone;
  message: string;
};

export function GitHubStartModal({ visible, onClose, onComplete }: GitHubStartModalProps) {
  const scheme = useColorScheme();
  const pickerTextColor = scheme === 'dark' ? '#f8f7f3' : '#1a1f16';
  const pickerPlaceholderColor = scheme === 'dark' ? '#b8b7b2' : '#6f7868';
  const pickerSurfaceColor = scheme === 'dark' ? '#1a1f16' : '#f8f7f3';
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<StatusNotice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInferringBranch, setIsInferringBranch] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [repoOptions, setRepoOptions] = useState<GitHubRepoSummary[]>([]);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('');
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const [githubUrl, setGithubUrl] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [candidateProjects, setCandidateProjects] = useState<Project[]>([]);
  const [candidateTasks, setCandidateTasks] = useState<Task[]>([]);

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientRate, setClientRate] = useState('');
  const [clientGithubOrg, setClientGithubOrg] = useState('');

  const [projectName, setProjectName] = useState('');
  const [projectGithubRepo, setProjectGithubRepo] = useState('');

  const [taskName, setTaskName] = useState('');
  const [taskGithubBranch, setTaskGithubBranch] = useState('');
  const [branchConfirmed, setBranchConfirmed] = useState(false);
  const [branchHint, setBranchHint] = useState<string | null>(null);

  const parsedGitHub = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);
  const selectedRepo = useMemo(
    () => repoOptions.find((repo) => repo.fullName === selectedRepoFullName) ?? null,
    [repoOptions, selectedRepoFullName],
  );
  const filteredRepoOptions = useMemo(() => {
    const needle = repoSearch.trim().toLowerCase();
    if (!needle) {
      return repoOptions;
    }

    return repoOptions.filter((repo) => repo.fullName.toLowerCase().includes(needle));
  }, [repoOptions, repoSearch]);

  const matchedClient = useMemo(() => {
    if (!clientGithubOrg.trim()) {
      return null;
    }

    return (
      clients.find((client) => normalize(client.github_org) === normalize(clientGithubOrg)) ?? null
    );
  }, [clients, clientGithubOrg]);

  const matchedProject = useMemo(() => {
    if (!projectGithubRepo.trim()) {
      return null;
    }

    return (
      candidateProjects.find(
        (project) => normalize(project.github_repo) === normalize(projectGithubRepo),
      ) ?? null
    );
  }, [candidateProjects, projectGithubRepo]);

  const matchedTask = useMemo(() => {
    if (!taskGithubBranch.trim()) {
      return null;
    }

    return (
      candidateTasks.find((task) => normalize(task.github_branch) === normalize(taskGithubBranch)) ??
      null
    );
  }, [candidateTasks, taskGithubBranch]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setStep(1);
    setStatus(null);
    setIsSaving(false);
    setIsInferringBranch(false);
    setGithubUrl('');
    setClients([]);
    setCandidateProjects([]);
    setCandidateTasks([]);
    setRepoOptions([]);
    setSelectedRepoFullName('');
    setIsRepoPickerOpen(false);
    setRepoSearch('');
    setBranchOptions([]);
    setIsLoadingRepos(false);
    setIsLoadingBranches(false);
    setClientName('');
    setClientEmail('');
    setClientRate('');
    setClientGithubOrg('');
    setProjectName('');
    setProjectGithubRepo('');
    setTaskName('');
    setTaskGithubBranch('');
    setBranchConfirmed(false);
    setBranchHint(null);
    setGithubToken(null);

    initializeDatabase()
      .then(() => Promise.all([listClients(), getUserProfile()]))
      .then(([rows, profile]) => {
        setClients(rows);
        setGithubToken(profile.github_pat ?? null);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to load existing records.';
        setStatus({ tone: 'error', message });
      });
  }, [visible]);

  useEffect(() => {
    if (!visible || !parsedGitHub) {
      return;
    }

    setClientGithubOrg(parsedGitHub.owner);
    setClientName(parsedGitHub.owner);
    setProjectGithubRepo(parsedGitHub.repo);
    setProjectName(prettifyRepoName(parsedGitHub.repo));

    const matchingRepo = repoOptions.find(
      (repo) =>
        normalize(repo.owner) === normalize(parsedGitHub.owner) &&
        normalize(repo.repo) === normalize(parsedGitHub.repo),
    );
    setSelectedRepoFullName(matchingRepo?.fullName ?? '');

    if (parsedGitHub.kind === 'repo') {
      if (parsedGitHub.branch) {
        setTaskGithubBranch(parsedGitHub.branch || '');
        setTaskName(prettifyBranchName(parsedGitHub.branch ?? ''));
      }
      setBranchConfirmed(true);
      setBranchHint(null);
      return;
    }

    setBranchConfirmed(false);
  }, [visible, parsedGitHub, repoOptions]);

  useEffect(() => {
    if (!visible || !githubToken?.trim()) {
      setRepoOptions([]);
      return;
    }

    let cancelled = false;
    setIsLoadingRepos(true);
    listAuthenticatedRepos(githubToken)
      .then((repos) => {
        if (!cancelled) {
          setRepoOptions(repos);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRepoOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRepos(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, githubToken]);

  useEffect(() => {
    if (!visible || !selectedRepo) {
      setBranchOptions([]);
      setIsLoadingBranches(false);
      return;
    }

    let cancelled = false;
    setClientGithubOrg(selectedRepo.owner);
    setClientName(selectedRepo.owner);
    setProjectGithubRepo(selectedRepo.repo);
    setProjectName(prettifyRepoName(selectedRepo.repo));
    setBranchHint(null);
    setBranchConfirmed(true);

    setIsLoadingBranches(true);
    listRepoBranches(selectedRepo.owner, selectedRepo.repo, githubToken ?? undefined)
      .then((branches) => {
        if (cancelled) {
          return;
        }

        setBranchOptions(branches);
        const preferredBranch = selectedRepo.defaultBranch ?? branches[0] ?? '';
        if (preferredBranch) {
          setTaskGithubBranch(preferredBranch);
          setTaskName(prettifyBranchName(preferredBranch));
        } else {
          setTaskGithubBranch('');
          setTaskName('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranchOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingBranches(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, selectedRepo, githubToken]);

  useEffect(() => {
    if (!visible || !matchedClient) {
      setCandidateProjects([]);
      setCandidateTasks([]);
      return;
    }

    listProjectsByClient(matchedClient.id)
      .then((rows) => setCandidateProjects(rows))
      .catch(() => setCandidateProjects([]));
  }, [visible, matchedClient]);

  useEffect(() => {
    if (!visible || !matchedProject) {
      setCandidateTasks([]);
      return;
    }

    listTasksByProject(matchedProject.id)
      .then((rows) => setCandidateTasks(rows))
      .catch(() => setCandidateTasks([]));
  }, [visible, matchedProject]);

  useEffect(() => {
    if (!visible || !parsedGitHub || parsedGitHub.kind !== 'commit') {
      return;
    }

    let cancelled = false;
    setIsInferringBranch(true);
    setBranchHint('Inferring branch from commit...');

    inferBranchFromCommit(
      parsedGitHub.owner,
      parsedGitHub.repo,
      parsedGitHub.sha,
      githubToken ?? undefined,
    )
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.branch) {
          setTaskGithubBranch(result.branch || '');
          setTaskName(prettifyBranchName(result.branch ?? ''));
        }

        setBranchHint(
          result.branch
            ? `${result.reason ?? 'Branch inferred from GitHub.'} Confirm before saving.`
            : result.reason ?? 'Could not infer branch. Enter it manually and confirm.',
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setBranchHint('Could not infer branch. Enter it manually and confirm.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsInferringBranch(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, parsedGitHub, githubToken]);

  function validateStep(currentStep: 1 | 2 | 3): boolean {
    if (currentStep === 1) {
      if (!clientGithubOrg.trim()) {
        const message = 'GitHub owner/org is required.';
        showValidationAlert(message);
        setStatus({ tone: 'error', message });
        return false;
      }

      if (!matchedClient) {
        if (!clientName.trim()) {
          const message = 'Customer name is required when creating a new customer.';
          showValidationAlert(message);
          setStatus({ tone: 'error', message });
          return false;
        }

        if (!clientEmail.trim()) {
          const message = 'Customer email is required when creating a new customer.';
          showValidationAlert(message);
          setStatus({ tone: 'error', message });
          return false;
        }

        const parsedRate = Number(clientRate.trim());
        if (!Number.isFinite(parsedRate) || parsedRate < 0) {
          const message = 'Customer hourly rate must be a non-negative number.';
          showValidationAlert(message);
          setStatus({ tone: 'error', message });
          return false;
        }
      }

      return true;
    }

    if (currentStep === 2) {
      if (!projectGithubRepo.trim()) {
        const message = 'GitHub repo is required.';
        showValidationAlert(message);
        setStatus({ tone: 'error', message });
        return false;
      }

      if (!matchedProject && !projectName.trim()) {
        const message = 'Project name is required when creating a new project.';
        showValidationAlert(message);
        setStatus({ tone: 'error', message });
        return false;
      }

      return true;
    }

    if (!matchedTask && !taskName.trim()) {
      const message = 'Task name is required when creating a new task.';
      showValidationAlert(message);
      setStatus({ tone: 'error', message });
      return false;
    }

    if (parsedGitHub?.kind === 'commit') {
      if (!taskGithubBranch.trim()) {
        const message = 'Branch is required for commit URLs.';
        showValidationAlert(message);
        setStatus({ tone: 'error', message });
        return false;
      }

      if (!branchConfirmed) {
        const message = 'Please confirm the branch before saving.';
        showValidationAlert(message);
        setStatus({ tone: 'error', message });
        return false;
      }
    }

    return true;
  }

  async function handleSaveAll(): Promise<void> {
    setStatus(null);
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setIsSaving(true);
    try {
      let resolvedClientId = matchedClient?.id ?? null;
      if (!resolvedClientId) {
        resolvedClientId = createId('client');
        await createTime2PayClient({
          id: resolvedClientId,
          name: clientName.trim(),
          email: clientEmail.trim(),
          hourly_rate: Number(clientRate.trim()),
          github_org: clientGithubOrg.trim() || null,
        });
      }

      let resolvedProjectId = matchedProject?.id ?? null;
      if (!resolvedProjectId) {
        const existingProjects = await listProjectsByClient(resolvedClientId);
        resolvedProjectId =
          existingProjects.find(
            (project) => normalize(project.github_repo) === normalize(projectGithubRepo),
          )?.id ?? null;
      }

      if (!resolvedProjectId) {
        resolvedProjectId = createId('project');
        await createProject({
          id: resolvedProjectId,
          client_id: resolvedClientId,
          name: projectName.trim(),
          github_repo: projectGithubRepo.trim() || null,
        });
      }

      let resolvedTaskId = matchedTask?.id ?? null;
      if (!resolvedTaskId) {
        const existingTasks = await listTasksByProject(resolvedProjectId);
        resolvedTaskId =
          existingTasks.find((task) => normalize(task.github_branch) === normalize(taskGithubBranch))
            ?.id ?? null;
      }

      if (!resolvedTaskId) {
        resolvedTaskId = createId('task');
        await createTask({
          id: resolvedTaskId,
          project_id: resolvedProjectId,
          name: taskName.trim(),
          github_branch: taskGithubBranch.trim() || null,
        });
      }

      onComplete({
        clientId: resolvedClientId,
        projectId: resolvedProjectId,
        taskId: resolvedTaskId,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to create or reuse GitHub entities.';
      showActionErrorAlert(message);
      setStatus({ tone: 'error', message });
    } finally {
      setIsSaving(false);
    }
  }

  function renderStep1() {
    return (
      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Step 1 - Customer</Text>
        {matchedClient ? (
          <InlineNotice
            tone="success"
            message={`Using existing customer "${matchedClient.name}" for org "${clientGithubOrg}".`}
          />
        ) : null}
        <TextInput
          value={clientGithubOrg}
          onChangeText={setClientGithubOrg}
          placeholder="GitHub owner/org"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={clientName}
          onChangeText={setClientName}
          placeholder="Customer name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={clientEmail}
          onChangeText={setClientEmail}
          placeholder="Customer email"
          keyboardType="email-address"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={clientRate}
          onChangeText={setClientRate}
          placeholder="Hourly rate"
          keyboardType="decimal-pad"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
      </View>
    );
  }

  function renderStep2() {
    return (
      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Step 2 - Project</Text>
        {matchedProject ? (
          <InlineNotice
            tone="success"
            message={`Using existing project "${matchedProject.name}" for repo "${projectGithubRepo}".`}
          />
        ) : null}
        <TextInput
          value={projectGithubRepo}
          onChangeText={setProjectGithubRepo}
          placeholder="GitHub repo"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={projectName}
          onChangeText={setProjectName}
          placeholder="Project name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
      </View>
    );
  }

  function renderStep3() {
    return (
      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Step 3 - Task</Text>
        {matchedTask ? (
          <InlineNotice
            tone="success"
            message={`Using existing task "${matchedTask.name}" for branch "${taskGithubBranch}".`}
          />
        ) : null}
        <TextInput
          value={taskGithubBranch}
          onChangeText={(value) => {
            setTaskGithubBranch(value);
            setTaskName(prettifyBranchName(value));
            if (parsedGitHub?.kind === 'commit') {
              setBranchConfirmed(false);
            }
          }}
          placeholder="GitHub branch"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {branchOptions.length > 0 ? (
          <View className="rounded-md border border-border bg-background">
            <Picker
              selectedValue={taskGithubBranch || EMPTY_PICKER_VALUE}
              onValueChange={(value) => {
                const nextBranch = String(value ?? EMPTY_PICKER_VALUE);
                if (!nextBranch) {
                  return;
                }
                setTaskGithubBranch(nextBranch);
                setTaskName(prettifyBranchName(nextBranch));
                if (parsedGitHub?.kind === 'commit') {
                  setBranchConfirmed(false);
                }
              }}
              dropdownIconColor={pickerTextColor}
              style={{
                color: pickerTextColor,
                backgroundColor: pickerSurfaceColor,
                fontSize: 17,
              }}
            >
              <Picker.Item
                label={isLoadingBranches ? 'Loading branches...' : 'Select branch'}
                value={EMPTY_PICKER_VALUE}
                color={pickerPlaceholderColor}
                style={{ color: pickerPlaceholderColor, backgroundColor: pickerSurfaceColor }}
              />
              {branchOptions.map((branchName) => (
                <Picker.Item
                  key={branchName}
                  label={branchName}
                  value={branchName}
                  color={pickerTextColor}
                  style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
                />
              ))}
            </Picker>
          </View>
        ) : null}
        <TextInput
          value={taskName}
          onChangeText={setTaskName}
          placeholder="Task name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {isInferringBranch ? (
          <Text className="text-xs text-muted">Inferring branch...</Text>
        ) : null}
        {branchHint ? <Text className="text-xs text-muted">{branchHint}</Text> : null}
        {parsedGitHub?.kind === 'commit' ? (
          <Pressable
            className={branchConfirmed ? 'rounded-md bg-secondary px-3 py-2' : 'rounded-md border border-border px-3 py-2'}
            onPress={() => setBranchConfirmed(true)}
          >
            <Text className={branchConfirmed ? 'text-center font-semibold text-white' : 'text-center font-semibold text-heading'}>
              {branchConfirmed ? 'Branch Confirmed' : 'Confirm Branch'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function goToNextStep(): void {
    if (!validateStep(step)) {
      return;
    }

    setStatus(null);
    setStep((current) => (current === 3 ? 3 : ((current + 1) as 2 | 3)));
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View className="flex-1 items-center justify-center bg-black/55 px-4">
          <View className="w-full max-w-xl rounded-xl bg-card p-5 shadow-lg">
            <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-xl font-bold text-heading">Start from GitHub</Text>
            <Text className="mt-1 text-sm text-muted">
              Paste a GitHub link to auto-create a customer, project, and task from your repo.
            </Text>

            <View className="mt-4 gap-2 rounded-md border border-border bg-background p-3">
              {githubToken?.trim() ? (
                <View className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-muted">
                    Repository (Recommended)
                  </Text>
                  <Pressable
                    className="rounded-md border-2 border-secondary bg-secondary/10 px-4 py-3"
                    onPress={() => setIsRepoPickerOpen(true)}
                  >
                    <Text className="text-[17px] font-semibold text-secondary">
                      {selectedRepo?.fullName || 'Select repository'}
                    </Text>
                    <Text className="mt-1 text-xs text-muted">
                      {isLoadingRepos
                        ? 'Loading repositories from your connected GitHub account...'
                        : 'Choose a repo to auto-fill owner, project, and default branch.'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <Text className="mt-1 text-xs uppercase tracking-wide text-muted">GitHub URL</Text>
              <TextInput
                value={githubUrl}
                onChangeText={(value) => {
                  setGithubUrl(value);
                  setStatus(null);
                  setBranchHint(null);
                }}
                placeholder="https://github.com/owner/repo or .../commit/sha"
                autoCapitalize="none"
                autoCorrect={false}
                className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
              />
              {githubUrl.trim() && !parsedGitHub ? (
                <Text className="text-xs text-danger">
                  Paste a valid GitHub repo or commit URL.
                </Text>
              ) : null}
              {githubToken?.trim() ? (
                <Text className="text-xs text-muted">
                  Tip: repo picker is best for everyday setup. URL is fallback for direct commit/repo
                  links.
                </Text>
              ) : null}
            </View>

            <View className="mt-4 gap-3 rounded-md border border-border bg-background p-3">
              <Text className="text-xs uppercase tracking-wide text-muted">Step {step} of 3</Text>
              {step === 1 ? renderStep1() : null}
              {step === 2 ? renderStep2() : null}
              {step === 3 ? renderStep3() : null}
            </View>

            {status ? <View className="mt-3"><InlineNotice tone={status.tone} message={status.message} /></View> : null}

              <View className="mt-4 flex-row flex-wrap gap-2">
                <Pressable className="rounded-md border border-border px-3 py-2" onPress={onClose}>
                  <Text className="font-semibold text-heading">Cancel</Text>
                </Pressable>
                {step > 1 ? (
                  <Pressable
                    className="rounded-md border border-border px-3 py-2"
                    onPress={() =>
                      setStep((current) => (current === 1 ? 1 : ((current - 1) as 1 | 2)))
                    }
                  >
                    <Text className="font-semibold text-heading">Back</Text>
                  </Pressable>
                ) : null}
                {step < 3 ? (
                  <Pressable className="rounded-md bg-secondary px-3 py-2" onPress={goToNextStep}>
                    <Text className="font-semibold text-white">Next</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    className={`rounded-md bg-secondary px-3 py-2 ${isSaving ? 'opacity-70' : ''}`}
                    onPress={() => {
                      handleSaveAll().catch(() => undefined);
                    }}
                    disabled={isSaving}
                  >
                    <Text className="font-semibold text-white">
                      {isSaving ? 'Saving...' : 'Save All'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={visible && isRepoPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRepoPickerOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/65 px-4">
          <View className="w-full max-w-xl rounded-xl bg-card p-4 shadow-lg">
            <Text className="text-lg font-bold text-heading">Select Repository</Text>
            <TextInput
              value={repoSearch}
              onChangeText={setRepoSearch}
              placeholder="Search repositories..."
              autoCapitalize="none"
              autoCorrect={false}
              className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <ScrollView
              className="mt-3 max-h-[360px] rounded-md border border-border bg-background"
              showsVerticalScrollIndicator
            >
              <View className="p-2">
                {filteredRepoOptions.length === 0 ? (
                  <Text className="px-2 py-2 text-sm text-muted">No repositories match.</Text>
                ) : (
                  filteredRepoOptions.map((repo) => (
                    <Pressable
                      key={repo.fullName}
                      className={`mb-1 rounded-md px-3 py-3 ${
                        selectedRepoFullName === repo.fullName ? 'bg-secondary/20' : 'bg-card'
                      }`}
                      onPress={() => {
                        setSelectedRepoFullName(repo.fullName);
                        setIsRepoPickerOpen(false);
                        setRepoSearch('');
                        setStatus(null);
                      }}
                    >
                      <Text className="text-[17px] font-semibold text-foreground">{repo.fullName}</Text>
                      <Text className="mt-1 text-xs text-muted">
                        {repo.isPrivate ? 'Private' : 'Public'}
                        {repo.defaultBranch ? ` • default: ${repo.defaultBranch}` : ''}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
            <View className="mt-3 flex-row justify-end">
              <Pressable
                className="rounded-md border border-border px-3 py-2"
                onPress={() => {
                  setIsRepoPickerOpen(false);
                  setRepoSearch('');
                }}
              >
                <Text className="font-semibold text-heading">Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  createClient,
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
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { inferBranchFromCommit, parseGitHubUrl, prettifyBranchName } from '@/services/github';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<StatusNotice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInferringBranch, setIsInferringBranch] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  const [githubUrl, setGithubUrl] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [candidateProjects, setCandidateProjects] = useState<Project[]>([]);
  const [candidateTasks, setCandidateTasks] = useState<Task[]>([]);

  const [clientName, setClientName] = useState('');
  const [clientRate, setClientRate] = useState('');
  const [clientGithubOrg, setClientGithubOrg] = useState('');

  const [projectName, setProjectName] = useState('');
  const [projectGithubRepo, setProjectGithubRepo] = useState('');

  const [taskName, setTaskName] = useState('');
  const [taskGithubBranch, setTaskGithubBranch] = useState('');
  const [branchConfirmed, setBranchConfirmed] = useState(false);
  const [branchHint, setBranchHint] = useState<string | null>(null);

  const parsedGitHub = useMemo(() => parseGitHubUrl(githubUrl), [githubUrl]);

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
    setClientName('');
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

    setClientGithubOrg((current) => current.trim() || parsedGitHub.owner);
    setClientName((current) => current.trim() || parsedGitHub.owner);
    setProjectGithubRepo((current) => current.trim() || parsedGitHub.repo);
    setProjectName((current) => current.trim() || prettifyRepoName(parsedGitHub.repo));

    if (parsedGitHub.kind === 'repo') {
      if (parsedGitHub.branch) {
        setTaskGithubBranch((current) => current.trim() || parsedGitHub.branch || '');
        setTaskName((current) => current.trim() || prettifyBranchName(parsedGitHub.branch ?? ''));
      }
      setBranchConfirmed(true);
      setBranchHint(null);
      return;
    }

    setBranchConfirmed(false);
  }, [visible, parsedGitHub]);

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
          setTaskGithubBranch((current) => current.trim() || result.branch || '');
          setTaskName((current) => current.trim() || prettifyBranchName(result.branch ?? ''));
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
          const message = 'Client name is required when creating a new client.';
          showValidationAlert(message);
          setStatus({ tone: 'error', message });
          return false;
        }

        const parsedRate = Number(clientRate.trim());
        if (!Number.isFinite(parsedRate) || parsedRate < 0) {
          const message = 'Client hourly rate must be a non-negative number.';
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
        await createClient({
          id: resolvedClientId,
          name: clientName.trim(),
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
        <Text className="text-xs uppercase tracking-wide text-muted">Step 1 - Client</Text>
        {matchedClient ? (
          <InlineNotice
            tone="success"
            message={`Using existing client "${matchedClient.name}" for org "${clientGithubOrg}".`}
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
          placeholder="Client name"
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
            if (!taskName.trim()) {
              const pretty = prettifyBranchName(value);
              if (pretty) {
                setTaskName(pretty);
              }
            }
            if (parsedGitHub?.kind === 'commit') {
              setBranchConfirmed(false);
            }
          }}
          placeholder="GitHub branch"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/55 px-4">
        <View className="w-full max-w-xl rounded-xl bg-card p-5 shadow-lg">
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-xl font-bold text-heading">Start from GitHub</Text>
            <Text className="mt-1 text-sm text-muted">
              Paste a GitHub link to auto-create a client, project, and task from your repo.
            </Text>

            <View className="mt-4 gap-2 rounded-md border border-border bg-background p-3">
              <Text className="text-xs uppercase tracking-wide text-muted">GitHub URL</Text>
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
                  onPress={() => setStep((current) => (current === 1 ? 1 : ((current - 1) as 1 | 2)))}
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
  );
}

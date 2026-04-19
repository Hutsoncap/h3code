import {
  type ApprovalRequestId,
  DEFAULT_MODEL_BY_PROVIDER,
  type ClaudeCodeEffort,
  type ProviderKind,
  type ProviderMentionReference,
  type ProviderPluginDescriptor,
  type ProviderSkillReference,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  type ResolvedKeybindingsConfig,
  type ServerProviderStatus,
  ThreadId,
  type TurnId,
  type EditorId,
  OrchestrationThreadActivity,
} from "@t3tools/contracts";
import { applyClaudePromptEffortPrefix, getModelCapabilities } from "@t3tools/shared/model";
import {
  resolveThreadBranchSourceCwd,
  resolveThreadWorkspaceCwd as resolveSharedThreadWorkspaceCwd,
} from "@t3tools/shared/threadEnvironment";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { gitCreateWorktreeMutationOptions } from "~/lib/gitReactQuery";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { isElectron } from "../../env";
import { parseDiffRouteSearch } from "../../diffRouteSearch";
import { resolveSubagentPresentationForThread } from "../../lib/subagentPresentation";
import {
  type ComposerTrigger,
  collapseExpandedComposerCursor,
  detectComposerTrigger,
} from "../../composer-logic";
import { createProjectSelector, createThreadSelector } from "../../storeSelectors";
import { hasLiveTurnTailWork, isLatestTurnSettled } from "../../session-logic";
import { type PendingUserInputDraftAnswer } from "../../pendingUserInput";
import { useStore } from "../../store";
import { proposedPlanTitle } from "../../proposedPlan";
import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE, type ChatMessage } from "../../types";
import { useTheme } from "../../hooks/useTheme";
import { useThreadHandoff } from "../../hooks/useThreadHandoff";
import { toastManager } from "../ui/toast";
import { useAppSettings } from "../../appSettings";
import {
  type ComposerImageAttachment,
  type QueuedComposerPlanFollowUp,
  type QueuedComposerTurn,
} from "../../composerDraftStore";
import {
  deriveLatestContextWindowSnapshot,
  deriveCumulativeCostUsd,
} from "../../lib/contextWindow";
import { type TerminalContextDraft } from "../../lib/terminalContext";
import {
  resolveSplitViewFocusedThreadId,
  selectSplitView,
  type SplitViewPanePanelState,
  useSplitViewStore,
} from "../../splitViewStore";
import { type ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import { ChatEmptyThreadState } from "./ChatEmptyThreadState";
import { ChatExpandedImageDialog } from "./ChatExpandedImageDialog";
import { ChatViewDialogs } from "./ChatViewDialogs";
import { ChatViewShell } from "./ChatViewShell";
import { useChatComposerAttachmentBindings } from "./useChatComposerAttachmentBindings";
import { useChatComposerDiscoveryBindings } from "./useChatComposerDiscoveryBindings";
import { useChatComposerDraftBindings } from "./useChatComposerDraftBindings";
import { useChatComposerCommandBindings } from "./useChatComposerCommandBindings";
import { useChatComposerInputBindings } from "./useChatComposerInputBindings";
import { useChatComposerFooterBindings } from "./useChatComposerFooterBindings";
import { useChatMediaBindings } from "./useChatMediaBindings";
import { useChatComposerModelBindings } from "./useChatComposerModelBindings";
import { useChatComposerProviderStateBindings } from "./useChatComposerProviderStateBindings";
import { useChatPlanHandoffBindings } from "./useChatPlanHandoffBindings";
import { useChatSendBindings } from "./useChatSendBindings";
import { useChatComposerTerminalContextBindings } from "./useChatComposerTerminalContextBindings";
import { useChatViewDialogBindings } from "./useChatViewDialogBindings";
import { useChatTranscriptBindings } from "./useChatTranscriptBindings";
import { useChatViewPaneBindings } from "./useChatViewPaneBindings";
import { useChatViewShellBindings } from "./useChatViewShellBindings";
import { useComposerVoiceController } from "./useComposerVoiceController";
import { useChatEnvModeBindings } from "./useChatEnvModeBindings";
import { useChatSurfaceBindings } from "./useChatSurfaceBindings";
import { useChatTimelineBindings } from "./useChatTimelineBindings";
import { useChatTerminalActionBindings } from "./useChatTerminalActionBindings";
import { useChatTerminalBindings } from "./useChatTerminalBindings";
import { useChatTerminalShortcutBindings } from "./useChatTerminalShortcutBindings";
import { useChatThreadSettingsBindings } from "./useChatThreadSettingsBindings";
import { useChatPullRequestController } from "./useChatPullRequestController";
import { useChatPendingInteractionBindings } from "./useChatPendingInteractionBindings";
import { useChatQueuedTurnBindings } from "./useChatQueuedTurnBindings";
import { useChatProjectScriptBindings } from "./useChatProjectScriptBindings";
import { useChatTerminalDrawerBindings } from "./useChatTerminalDrawerBindings";
import { useChatTurnDispatchBindings } from "./useChatTurnDispatchBindings";
import { useChatViewRuntimeBindings } from "./useChatViewRuntimeBindings";
import { useChatViewSessionState } from "./useChatViewSessionState";
import { deriveLatestRateLimitStatus } from "./RateLimitBanner";
import {
  buildLocalDraftThread,
  LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
  LastInvokedScriptByProjectSchema,
  type LocalDispatchSnapshot,
  revokeUserMessagePreviewUrls,
} from "../ChatView.logic";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";

const IMAGE_SIZE_LIMIT_LABEL = `${Math.round(PROVIDER_SEND_TURN_MAX_IMAGE_BYTES / (1024 * 1024))}MB`;
const EMPTY_ACTIVITIES: OrchestrationThreadActivity[] = [];
const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const EMPTY_AVAILABLE_EDITORS: EditorId[] = [];
const EMPTY_PROVIDER_STATUSES: ServerProviderStatus[] = [];
type ComposerPluginSuggestion = {
  plugin: ProviderPluginDescriptor;
  mention: ProviderMentionReference;
};

function formatOutgoingPrompt(params: {
  provider: ProviderKind;
  model: string | null;
  effort: string | null;
  text: string;
}): string {
  const caps = getModelCapabilities(params.provider, params.model);
  if (params.effort && caps.promptInjectedEffortLevels.includes(params.effort)) {
    return applyClaudePromptEffortPrefix(params.text, params.effort as ClaudeCodeEffort | null);
  }
  return params.text;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function skillMentionPrefix(provider: string): string {
  return provider === "claudeAgent" ? "/" : "$";
}

function promptIncludesSkillMention(prompt: string, skillName: string, provider: string): boolean {
  const prefix = escapeRegExp(skillMentionPrefix(provider));
  const pattern = new RegExp(`(^|\\s)${prefix}${escapeRegExp(skillName)}(?=\\s|$)`, "i");
  return pattern.test(prompt);
}

function collectPromptMentionNames(prompt: string): string[] {
  const names: string[] = [];
  for (const match of prompt.matchAll(/(^|\s)@([^\s@]+)(?=\s|$)/g)) {
    const mentionName = (match[2] ?? "").trim();
    if (mentionName.length > 0) {
      names.push(mentionName);
    }
  }
  return names;
}

function normalizeMentionNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function resolvePromptPluginMentions(params: {
  prompt: string;
  existingMentions: ReadonlyArray<ProviderMentionReference>;
  providerPlugins: ReadonlyArray<ComposerPluginSuggestion>;
}): ProviderMentionReference[] {
  const promptMentionNames = collectPromptMentionNames(params.prompt);
  if (promptMentionNames.length === 0) {
    return [];
  }

  const uniquePromptMentionNames: string[] = [];
  const seenPromptMentionNames = new Set<string>();
  for (const mentionName of promptMentionNames) {
    const key = normalizeMentionNameKey(mentionName);
    if (seenPromptMentionNames.has(key)) {
      continue;
    }
    seenPromptMentionNames.add(key);
    uniquePromptMentionNames.push(mentionName);
  }

  const existingMentionsByName = new Map<string, ProviderMentionReference[]>();
  for (const mention of params.existingMentions) {
    const key = normalizeMentionNameKey(mention.name);
    const bucket = existingMentionsByName.get(key);
    if (bucket) {
      bucket.push(mention);
    } else {
      existingMentionsByName.set(key, [mention]);
    }
  }

  const providerMentionsByName = new Map<string, ProviderMentionReference[]>();
  for (const suggestion of params.providerPlugins) {
    const key = normalizeMentionNameKey(suggestion.plugin.name);
    const bucket = providerMentionsByName.get(key);
    if (bucket) {
      bucket.push(suggestion.mention);
    } else {
      providerMentionsByName.set(key, [suggestion.mention]);
    }
  }

  const resolvedMentions: ProviderMentionReference[] = [];
  const seenPaths = new Set<string>();

  for (const mentionName of uniquePromptMentionNames) {
    const key = normalizeMentionNameKey(mentionName);
    const existingMention = (existingMentionsByName.get(key) ?? []).find(
      (candidate) => !seenPaths.has(candidate.path),
    );
    if (existingMention) {
      seenPaths.add(existingMention.path);
      resolvedMentions.push(existingMention);
      continue;
    }

    const discoveredMentions = providerMentionsByName.get(key) ?? [];
    if (discoveredMentions.length === 1) {
      const discoveredMention = discoveredMentions[0]!;
      seenPaths.add(discoveredMention.path);
      resolvedMentions.push(discoveredMention);
    }
  }

  return resolvedMentions;
}

export interface ChatViewProps {
  threadId: ThreadId;
  paneScopeId?: string;
  surfaceMode?: "single" | "split";
  isFocusedPane?: boolean;
  panelState?: SplitViewPanePanelState;
  onToggleDiffPanel?: () => void;
  onToggleBrowserPanel?: () => void;
  onOpenTurnDiffPanel?: (turnId: TurnId, filePath?: string) => void;
  onSplitSurface?: () => void;
  onMaximizeSurface?: () => void;
}

export function ChatViewControllerShell({
  threadId,
  paneScopeId = "single",
  surfaceMode = "single",
  isFocusedPane = true,
  panelState,
  onToggleDiffPanel,
  onToggleBrowserPanel,
  onOpenTurnDiffPanel,
  onSplitSurface,
  onMaximizeSurface,
}: ChatViewProps) {
  const markThreadVisited = useStore((store) => store.markThreadVisited);
  const syncServerReadModel = useStore((store) => store.syncServerReadModel);
  const setStoreThreadError = useStore((store) => store.setError);
  const setStoreThreadWorkspace = useStore((store) => store.setThreadWorkspace);
  const { settings } = useAppSettings();
  const timestampFormat = settings.timestampFormat;
  const navigate = useNavigate();
  const { handleNewThread } = useHandleNewThread();
  const { createThreadHandoff } = useThreadHandoff();
  const rawSearch = useSearch({
    strict: false,
    select: (params) => parseDiffRouteSearch(params),
  });
  const activeSplitView = useSplitViewStore(selectSplitView(rawSearch.splitViewId ?? null));
  const removeThreadFromSplitViews = useSplitViewStore((store) => store.removeThreadFromSplitViews);
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const createWorktreeMutation = useMutation(gitCreateWorktreeMutationOptions({ queryClient }));
  const {
    addComposerImage,
    addComposerImagesToDraft,
    addComposerTerminalContextsToDraft,
    clearComposerDraftContent,
    clearComposerDraftPersistedAttachments,
    clearProjectDraftThreadId,
    composerDraft,
    composerImages,
    composerSendState,
    composerTerminalContexts,
    draftThread,
    enqueueQueuedComposerTurn,
    getDraftThread,
    getDraftThreadByProjectId,
    insertComposerDraftTerminalContext,
    insertQueuedComposerTurn,
    nonPersistedComposerImageIds,
    prompt,
    queuedComposerTurns,
    removeComposerDraftTerminalContext,
    removeComposerImageFromDraft,
    removeQueuedComposerTurnFromDraft,
    setComposerDraftInteractionMode,
    setComposerDraftModelSelection,
    setComposerDraftPrompt,
    setComposerDraftProviderModelOptions,
    setComposerDraftRuntimeMode,
    setComposerDraftTerminalContexts,
    setDraftThreadContext,
    setProjectDraftThreadId,
    setPrompt,
    setStickyComposerModelSelection,
    syncComposerDraftPersistedAttachments,
  } = useChatComposerDraftBindings(threadId);
  const allThreads = useStore((store) => store.threads);
  const serverThread = useStore(useMemo(() => createThreadSelector(threadId), [threadId]));
  const fallbackDraftProjectId = draftThread?.projectId ?? null;
  const fallbackDraftProject = useStore(
    useMemo(() => createProjectSelector(fallbackDraftProjectId), [fallbackDraftProjectId]),
  );
  const promptRef = useRef(prompt);
  const [optimisticUserMessages, setOptimisticUserMessages] = useState<ChatMessage[]>([]);
  const composerTerminalContextsRef = useRef<TerminalContextDraft[]>(composerTerminalContexts);
  const [localDraftErrorsByThreadId, setLocalDraftErrorsByThreadId] = useState<
    Record<ThreadId, string | null>
  >({});
  const [localDispatch, setLocalDispatch] = useState<LocalDispatchSnapshot | null>(null);
  const [isConnecting, _setIsConnecting] = useState(false);
  const [isRevertingCheckpoint, setIsRevertingCheckpoint] = useState(false);
  const [respondingRequestIds, setRespondingRequestIds] = useState<ApprovalRequestId[]>([]);
  const [respondingUserInputRequestIds, setRespondingUserInputRequestIds] = useState<
    ApprovalRequestId[]
  >([]);
  const [pendingUserInputAnswersByRequestId, setPendingUserInputAnswersByRequestId] = useState<
    Record<string, Record<string, PendingUserInputDraftAnswer>>
  >({});
  const [pendingUserInputQuestionIndexByRequestId, setPendingUserInputQuestionIndexByRequestId] =
    useState<Record<string, number>>({});
  const [composerCommandPicker, setComposerCommandPicker] = useState<
    null | "fork-target" | "review-target"
  >(null);
  const [composerHighlightedItemId, setComposerHighlightedItemId] = useState<string | null>(null);
  const [composerCursor, setComposerCursor] = useState(() =>
    collapseExpandedComposerCursor(prompt, prompt.length),
  );
  const [composerTrigger, setComposerTrigger] = useState<ComposerTrigger | null>(() =>
    detectComposerTrigger(prompt, prompt.length),
  );
  const [selectedComposerSkills, setSelectedComposerSkills] = useState<ProviderSkillReference[]>(
    [],
  );
  const [selectedComposerMentions, setSelectedComposerMentions] = useState<
    ProviderMentionReference[]
  >([]);
  const [lastInvokedScriptByProjectId, setLastInvokedScriptByProjectId] = useLocalStorage(
    LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
    {},
    LastInvokedScriptByProjectSchema,
  );

  useEffect(() => {
    setComposerCommandPicker(null);
  }, [threadId]);
  const composerEditorRef = useRef<ComposerPromptEditorHandle>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const composerImagesRef = useRef<ComposerImageAttachment[]>([]);
  const queuedComposerTurnsRef = useRef<QueuedComposerTurn[]>([]);
  const autoDispatchingQueuedTurnRef = useRef(false);
  const handleStandaloneSlashCommandRef = useRef<null | ((text: string) => Promise<boolean>)>(null);
  const submitPlanFollowUpRef = useRef<
    | null
    | ((input: {
        text: string;
        interactionMode: "default" | "plan";
        dispatchMode: "queue" | "steer";
        queuedTurn?: QueuedComposerPlanFollowUp;
      }) => Promise<boolean>)
  >(null);
  const sendInFlightRef = useRef(false);

  const localDraftError = serverThread ? null : (localDraftErrorsByThreadId[threadId] ?? null);
  const localDraftThread = useMemo(
    () =>
      draftThread
        ? buildLocalDraftThread(
            threadId,
            draftThread,
            fallbackDraftProject?.defaultModelSelection ?? {
              provider: "codex",
              model: DEFAULT_MODEL_BY_PROVIDER.codex,
            },
            localDraftError,
          )
        : undefined,
    [draftThread, fallbackDraftProject?.defaultModelSelection, localDraftError, threadId],
  );
  const activeThread = serverThread ?? localDraftThread;
  const runtimeMode =
    composerDraft.runtimeMode ?? activeThread?.runtimeMode ?? DEFAULT_RUNTIME_MODE;
  const interactionMode =
    composerDraft.interactionMode ?? activeThread?.interactionMode ?? DEFAULT_INTERACTION_MODE;
  const isServerThread = serverThread !== undefined;
  const isLocalDraftThread = !isServerThread && localDraftThread !== undefined;
  const canCheckoutPullRequestIntoThread = isLocalDraftThread;
  const diffOpen = rawSearch.panel === "diff";
  const browserOpen = rawSearch.panel === "browser";
  const resolvedDiffOpen = panelState ? panelState.panel === "diff" : diffOpen;
  const resolvedBrowserOpen = panelState ? panelState.panel === "browser" : browserOpen;
  const activeThreadId = activeThread?.id ?? null;
  const activeLatestTurn = activeThread?.latestTurn ?? null;
  const threadActivities = activeThread?.activities ?? EMPTY_ACTIVITIES;
  const hasLiveTurnTail = hasLiveTurnTailWork({
    latestTurn: activeLatestTurn,
    messages: activeThread?.messages ?? EMPTY_MESSAGES,
    activities: threadActivities,
    session: activeThread?.session ?? null,
  });
  const activeContextWindow = useMemo(
    () => deriveLatestContextWindowSnapshot(threadActivities),
    [threadActivities],
  );
  const activeCumulativeCostUsd = useMemo(
    () => deriveCumulativeCostUsd(threadActivities),
    [threadActivities],
  );
  const activeRateLimitStatus = useMemo(
    () => deriveLatestRateLimitStatus(threadActivities),
    [threadActivities],
  );
  const latestTurnSettledByProvider = isLatestTurnSettled(
    activeLatestTurn,
    activeThread?.session ?? null,
  );
  const latestTurnSettled = latestTurnSettledByProvider && !hasLiveTurnTail;
  const activeProjectId = activeThread?.projectId ?? draftThread?.projectId ?? null;
  const activeProject = useStore(
    useMemo(() => createProjectSelector(activeProjectId), [activeProjectId]),
  );
  const {
    terminalState,
    terminalFocusRequestId,
    requestTerminalFocus,
    terminalWorkspaceOpen,
    terminalWorkspaceTerminalTabActive,
    terminalWorkspaceChatTabActive,
    openTerminalThreadPage,
    setTerminalOpen,
    setTerminalPresentationMode,
    setTerminalWorkspaceLayout,
    setTerminalWorkspaceTab,
    setTerminalHeight,
    setTerminalMetadata,
    setTerminalActivity,
    splitTerminalRight,
    splitTerminalLeft,
    splitTerminalDown,
    splitTerminalUp,
    createNewTerminal,
    createNewTerminalTab,
    createTerminalFromShortcut,
    moveTerminalToNewGroup,
    openNewFullWidthTerminal,
    closeWorkspaceChat,
    activateTerminal,
    closeTerminal: closeTerminalState,
    closeTerminalGroup,
    resizeTerminalSplit,
    clearTerminalState,
  } = useChatTerminalBindings({
    threadId,
    activeThreadId,
    activeProjectExists: activeProject !== undefined,
  });
  const {
    activeBackgroundTasks,
    activePendingApproval,
    activePendingDraftAnswers,
    activePendingIsResponding,
    activePendingProgress,
    activePendingQuestionIndex,
    activePendingResolvedAnswers,
    activePendingUserInput,
    activePlan,
    activeProposedPlan,
    activeThreadAssociatedWorktree,
    activeTurnInProgress,
    activeWorkStartedAt,
    composerFooterHasWideActions,
    diffDisabledReason,
    diffEnvironmentPending,
    hasLiveTurn,
    isComposerApprovalState,
    isPreparingWorktree,
    isSendBusy,
    isWorking,
    pendingApprovals,
    pendingUserInputs,
    phase,
    resolvedThreadEnvMode,
    resolvedThreadWorktreePath,
    serverAcknowledgedLocalDispatch,
    showPlanFollowUpPrompt,
    sidebarProposedPlan,
    threadBreadcrumbs,
  } = useChatViewSessionState({
    activeLatestTurn,
    activeProjectCwd: activeProject?.cwd ?? null,
    activeThread,
    allThreads,
    draftThreadEnvMode: draftThread?.envMode ?? null,
    draftThreadWorktreePath: draftThread?.worktreePath ?? null,
    hasLiveTurnTail,
    interactionMode,
    isConnecting,
    isRevertingCheckpoint,
    isServerThread,
    latestTurnSettled,
    localDispatch,
    markThreadVisited,
    pendingUserInputAnswersByRequestId,
    pendingUserInputQuestionIndexByRequestId,
    promptRef,
    respondingUserInputRequestIds,
    setComposerCursor,
    setComposerHighlightedItemId,
    setComposerTrigger,
    threadActivities,
  });

  const {
    pullRequestDialogState,
    openPullRequestDialog,
    closePullRequestDialog,
    handlePreparedPullRequestThread,
  } = useChatPullRequestController({
    activeProject,
    canCheckoutPullRequestIntoThread,
    currentThreadId: threadId,
    getDraftThreadByProjectId,
    getDraftThread,
    setDraftThreadContext,
    setProjectDraftThreadId,
    clearProjectDraftThreadId,
    navigate,
    clearComposerHighlightedItemId: () => setComposerHighlightedItemId(null),
    isServerThread,
  });

  const selectedProviderByThreadId = composerDraft.activeProvider ?? null;
  const {
    composerModelOptions,
    composerProviderState,
    customModelsByProvider,
    lockedProvider,
    modelOptionsByProvider,
    providerOptionsForDispatch,
    searchableModelOptions,
    selectedModel,
    selectedModelForPickerWithCustomFallback,
    selectedModelSelection,
    selectedPromptEffort,
    selectedProvider,
  } = useChatComposerProviderStateBindings({
    activeProjectDefaultModelSelection: activeProject?.defaultModelSelection,
    activeThread,
    composerDraftActiveProvider: selectedProviderByThreadId,
    prompt,
    settings,
    threadId,
  });
  const {
    closePlanSidebar,
    handleImplementationThreadOpened,
    handlePlanImplementationStarted,
    handoffActionLabel,
    handoffBadgeLabel,
    handoffBadgeSourceProvider,
    handoffBadgeTargetProvider,
    handoffDisabled,
    handoffTargetProvider,
    onCreateHandoffThread,
    openPlanSidebar,
    planSidebarOpen,
  } = useChatPlanHandoffBindings({
    activePlanTurnId: activePlan?.turnId ?? null,
    activeProjectExists: activeProject !== undefined,
    activeThread,
    createThreadHandoff,
    hasPendingApprovals: pendingApprovals.length > 0,
    hasPendingUserInput: pendingUserInputs.length > 0,
    isServerThread,
    isWorking,
    navigate,
    sidebarProposedPlanTurnId: sidebarProposedPlan?.turnId ?? null,
  });
  const {
    closeExpandedImage,
    expandedImage,
    navigateExpandedImage,
    onExpandImage,
    timelineMessages,
  } = useChatMediaBindings({
    activeThreadId: activeThread?.id ?? null,
    clearComposerDraftPersistedAttachments,
    composerImages,
    optimisticUserMessages,
    serverMessages: activeThread?.messages,
    setOptimisticUserMessages,
    syncComposerDraftPersistedAttachments,
    threadId,
  });
  const {
    completionDividerBeforeEntryId,
    completionSummary,
    revertTurnCountByUserMessageId,
    timelineEntries,
    turnDiffSummaryByAssistantMessageId,
  } = useChatTimelineBindings({
    activeLatestTurn,
    activeThread,
    allThreads,
    latestTurnSettled,
    threadActivities,
    timelineMessages,
  });
  const threadWorkspaceCwd = activeProject
    ? resolveSharedThreadWorkspaceCwd({
        projectCwd: activeProject.cwd,
        envMode: resolvedThreadEnvMode,
        worktreePath: resolvedThreadWorktreePath,
      })
    : null;
  const gitCwd = threadWorkspaceCwd;
  const gitBranchSourceCwd = activeProject
    ? resolveThreadBranchSourceCwd({
        projectCwd: activeProject.cwd,
        worktreePath: resolvedThreadWorktreePath,
      })
    : null;
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const {
    activeComposerMenuItem,
    activeRootBranch,
    branchesIsRepo,
    composerMenuItems,
    composerMenuOpen,
    composerSkillCwd,
    currentProviderModelOptions,
    effectiveComposerTriggerKind,
    fastModeEnabled,
    isComposerMenuLoading,
    providerNativeCommands,
    providerPlugins,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
  } = useChatComposerDiscoveryBindings({
    activeProjectCwd: activeProject?.cwd,
    activeThread,
    composerCommandPicker,
    composerHighlightedItemId,
    composerImagesCount: composerImages.length,
    composerModelOptions,
    composerTerminalContextsCount: composerTerminalContexts.length,
    composerTrigger,
    gitBranchSourceCwd,
    gitCwd,
    interactionMode,
    isServerThread,
    prompt,
    resolvedThreadWorktreePath,
    searchableModelOptions,
    selectedComposerMentions,
    selectedComposerSkills,
    selectedModel,
    selectedProvider,
    serverCwd: serverConfigQuery.data?.cwd ?? null,
    setComposerCommandPicker,
    setComposerHighlightedItemId,
    setComposerTrigger,
    setSelectedComposerMentions,
    setSelectedComposerSkills,
    promptIncludesSkillMention,
    resolvePromptPluginMentions,
    threadId,
  });
  const nonPersistedComposerImageIdSet = useMemo(
    () => new Set(nonPersistedComposerImageIds),
    [nonPersistedComposerImageIds],
  );
  const keybindings = serverConfigQuery.data?.keybindings ?? EMPTY_KEYBINDINGS;
  const availableEditors = serverConfigQuery.data?.availableEditors ?? EMPTY_AVAILABLE_EDITORS;
  const providerStatuses = serverConfigQuery.data?.providers ?? EMPTY_PROVIDER_STATUSES;
  const {
    activeProviderStatus,
    dismissActiveThreadError,
    envLocked,
    hasNativeUserMessages,
    isGitRepo,
    onToggleBrowser,
    onToggleDiff,
    refreshVoiceStatus,
    setThreadError,
    threadTerminalRuntimeEnv,
    voiceProviderStatus,
  } = useChatSurfaceBindings({
    activeProjectCwd: activeProject?.cwd ?? null,
    activeThread,
    branchesIsRepo,
    browserOpen,
    diffEnvironmentPending,
    diffOpen,
    navigate,
    onToggleBrowserPanel,
    onToggleDiffPanel,
    providerStatuses,
    queryClient,
    selectedProvider,
    setLocalDraftErrorsByThreadId,
    setStoreThreadError,
    threadId,
  });

  const {
    onAdvanceActivePendingUserInput,
    onChangeActivePendingUserInputCustomAnswer,
    onPreviousActivePendingUserInputQuestion,
    onRespondToApproval,
    onToggleActivePendingUserInputOption,
    setActivePendingUserInputCustomAnswerValue,
  } = useChatPendingInteractionBindings({
    activePendingProgress,
    activePendingResolvedAnswers,
    activePendingUserInput,
    activeThreadId,
    promptRef,
    setComposerCursor,
    setComposerTrigger,
    setPendingUserInputAnswersByRequestId,
    setPendingUserInputQuestionIndexByRequestId,
    setRespondingRequestIds,
    setRespondingUserInputRequestIds,
    setStoreThreadError,
  });
  const {
    appendVoiceTranscriptToComposer,
    applyPromptReplacement,
    clearComposerInput,
    focusComposer,
    restoreFailedComposerSendDraft,
    scheduleComposerFocus,
  } = useChatComposerInputBindings({
    activePendingQuestionId: activePendingProgress?.activeQuestion?.id ?? null,
    addComposerImagesToDraft,
    addComposerTerminalContextsToDraft,
    clearComposerDraftContent,
    composerEditorRef,
    promptRef,
    setActivePendingUserInputCustomAnswerValue,
    setComposerCursor,
    setComposerHighlightedItemId,
    setComposerTrigger,
    setPrompt,
    setSelectedComposerMentions,
    setSelectedComposerSkills,
  });
  const {
    handleRuntimeModeChange,
    handleInteractionModeChange,
    toggleInteractionMode,
    setPlanMode,
    persistThreadSettingsForNextTurn,
  } = useChatThreadSettingsBindings({
    threadId,
    runtimeMode,
    interactionMode,
    isLocalDraftThread,
    serverThread: serverThread ?? null,
    scheduleComposerFocus,
    setComposerDraftRuntimeMode,
    setComposerDraftInteractionMode,
    setDraftThreadContext,
  });
  const { onEnvModeChange } = useChatEnvModeBindings({
    threadId,
    activeThread,
    draftThreadBranch: draftThread?.branch ?? null,
    activeRootBranch,
    hasNativeUserMessages,
    isLocalDraftThread,
    isServerThread,
    scheduleComposerFocus,
    setDraftThreadContext,
  });
  const {
    isVoiceRecording,
    isVoiceTranscribing,
    voiceWaveformLevels,
    voiceRecordingDurationLabel,
    showVoiceNotesControl,
    toggleComposerVoiceRecording,
    submitComposerVoiceRecording,
    cancelComposerVoiceRecording,
  } = useComposerVoiceController({
    activeProject,
    activeThreadId,
    threadId,
    selectedProvider,
    activeProviderStatus: voiceProviderStatus,
    pendingUserInputCount: pendingUserInputs.length,
    onTranscriptReady: appendVoiceTranscriptToComposer,
    refreshVoiceStatus,
  });
  const { addTerminalContextToDraft, removeComposerTerminalContextFromDraft } =
    useChatComposerTerminalContextBindings({
      activeThreadId,
      composerCursor,
      composerEditorRef,
      composerTerminalContexts,
      insertComposerDraftTerminalContext,
      promptRef,
      removeComposerDraftTerminalContext,
      setComposerCursor,
      setComposerTrigger,
      setPrompt,
      threadId,
    });
  const resolveNextSplitViewThreadAfterTerminalDelete = useCallback((splitViewId: string) => {
    const nextSplitView = useSplitViewStore.getState().splitViewsById[splitViewId];
    const nextThreadId = nextSplitView ? resolveSplitViewFocusedThreadId(nextSplitView) : null;
    return nextSplitView && nextThreadId
      ? { splitViewId: nextSplitView.id, threadId: nextThreadId }
      : null;
  }, []);
  const navigateToSplitViewThreadAfterTerminalDelete = useCallback(
    async (nextThreadId: ThreadId, splitViewId: string) => {
      await navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
        replace: true,
        search: () => ({ splitViewId }),
      });
    },
    [navigate],
  );
  const navigateHomeAfterTerminalDelete = useCallback(async () => {
    await navigate({ to: "/", replace: true });
  }, [navigate]);
  const {
    toggleTerminalVisibility,
    expandTerminalWorkspace,
    collapseTerminalWorkspace,
    closeTerminal,
    closeActiveWorkspaceView,
  } = useChatTerminalActionBindings({
    activeThread,
    activeThreadId,
    activeSplitViewId: activeSplitView?.id ?? null,
    closeTerminalState,
    clearTerminalState,
    closeWorkspaceChat,
    confirmTerminalTabCloseEnabled: settings.confirmTerminalTabClose,
    isServerThread,
    removeThreadFromSplitViews,
    resolveNextSplitViewThread: resolveNextSplitViewThreadAfterTerminalDelete,
    setTerminalOpen,
    setTerminalPresentationMode,
    setTerminalWorkspaceLayout,
    setTerminalWorkspaceTab,
    syncServerReadModel,
    terminalState: {
      activeTerminalId: terminalState.activeTerminalId,
      entryPoint: terminalState.entryPoint,
      terminalIds: terminalState.terminalIds,
      terminalLabelsById: terminalState.terminalLabelsById,
      terminalOpen: terminalState.terminalOpen,
      terminalTitleOverridesById: terminalState.terminalTitleOverridesById,
      workspaceActiveTab: terminalState.workspaceActiveTab,
      workspaceLayout: terminalState.workspaceLayout,
    },
    terminalWorkspaceOpen,
    navigateHome: navigateHomeAfterTerminalDelete,
    navigateToThread: navigateToSplitViewThreadAfterTerminalDelete,
  });
  const { runProjectScript, saveProjectScript, updateProjectScript, deleteProjectScript } =
    useChatProjectScriptBindings({
      activeProject: activeProject ?? null,
      activeThread,
      activeThreadId,
      gitCwd,
      terminalState: {
        activeTerminalId: terminalState.activeTerminalId,
        runningTerminalIds: terminalState.runningTerminalIds,
        terminalIds: terminalState.terminalIds,
      },
      activateTerminal,
      moveTerminalToNewGroup,
      setLastInvokedScriptByProjectId,
      setTerminalMetadata,
      setTerminalOpen,
      setThreadError,
    });
  const {
    confirmWorktreeHandoff,
    envMode,
    envState,
    expandedWorkGroups,
    forceStickToBottom,
    handoffBusy,
    isComposerFooterCompact,
    messagesScrollElement,
    nowIso,
    onHandoffToLocal,
    onHandoffToWorktree,
    onTimelineHeightChange,
    onMessagesClickCapture,
    onMessagesPointerCancel,
    onMessagesPointerDown,
    onMessagesPointerUp,
    onMessagesScroll,
    onMessagesTouchEnd,
    onMessagesTouchMove,
    onMessagesTouchStart,
    onMessagesWheel,
    onRevertToTurnCount,
    setExpandedWorkGroups,
    setMessagesBottomAnchorRef,
    setMessagesScrollContainerRef,
    setWorktreeHandoffDialogOpen,
    setWorktreeHandoffName,
    showScrollToBottom,
    worktreeHandoffDialogOpen,
    worktreeHandoffName,
  } = useChatViewRuntimeBindings({
    activeProject,
    activeRootBranch,
    activeThread,
    activeThreadAssociatedWorktree,
    autoDispatchingQueuedTurnRef,
    composerCursorSetter: setComposerCursor,
    composerFooterHasWideActions,
    composerFormRef,
    composerImages,
    composerImagesRef,
    composerTerminalContexts,
    composerTerminalContextsRef,
    draftThreadEnvMode: draftThread?.envMode ?? null,
    focusComposer,
    hasLiveTurn,
    isConnecting,
    isRevertingCheckpoint,
    isSendBusy,
    isServerThread,
    isWorking,
    messageCount: timelineEntries.length,
    prompt,
    promptRef,
    queuedComposerTurns,
    queuedComposerTurnsRef,
    resolvedThreadEnvMode,
    resolvedThreadWorktreePath,
    runProjectScript,
    setIsRevertingCheckpoint,
    setStoreThreadWorkspace,
    setThreadError,
    syncServerReadModel,
    terminalOpen: terminalState.terminalOpen,
  });

  const { beginLocalDispatch, dispatchChatTurn, onInterrupt, resetLocalDispatch } =
    useChatTurnDispatchBindings({
      activeThread,
      clearComposerInput,
      composerImagesRef,
      composerTerminalContextsRef,
      createWorktree: createWorktreeMutation.mutateAsync,
      forceStickToBottom,
      formatOutgoingPrompt,
      isConnecting,
      isLocalDraftThread,
      isSendBusy,
      isServerThread,
      persistThreadSettingsForNextTurn,
      promptIncludesSkillMention,
      promptRef,
      resolvePromptPluginMentions: ({ prompt, existingMentions }) =>
        resolvePromptPluginMentions({
          prompt,
          existingMentions,
          providerPlugins,
        }),
      restoreFailedComposerSendDraft,
      runProjectScript,
      sendInFlightRef,
      serverAcknowledgedLocalDispatch,
      setLocalDispatch,
      setOptimisticUserMessages,
      setStoreThreadWorkspace,
      setThreadError,
      settingsEnableAssistantStreaming: settings.enableAssistantStreaming,
    });
  const {
    browserPanelShortcutLabel,
    chatSplitShortcutLabel,
    closeTerminalShortcutLabel,
    closeWorkspaceShortcutLabel,
    diffPanelShortcutLabel,
    newTerminalShortcutLabel,
    splitTerminalDownShortcutLabel,
    splitTerminalShortcutLabel,
    terminalToggleShortcutLabel,
  } = useChatTerminalShortcutBindings({
    activeProjectScripts: activeProject?.scripts,
    activeThreadId,
    closeActiveWorkspaceView,
    closeTerminal,
    composerFormRef,
    createTerminalFromShortcut,
    focusComposer,
    hasLiveTurn,
    isElectron,
    isFocusedPane,
    keybindings,
    onInterrupt,
    onSplitSurface,
    onToggleBrowser,
    onToggleDiff,
    openNewFullWidthTerminal,
    openTerminalThreadPage,
    requestTerminalFocus,
    runProjectScript,
    setTerminalOpen,
    setTerminalWorkspaceTab,
    splitTerminalDown,
    splitTerminalLeft,
    splitTerminalRight,
    splitTerminalUp,
    surfaceMode,
    terminalState: {
      activeTerminalId: terminalState.activeTerminalId,
      entryPoint: terminalState.entryPoint,
      open: terminalState.terminalOpen,
      workspaceActiveTab: terminalState.workspaceActiveTab,
      workspaceLayout: terminalState.workspaceLayout,
    },
    terminalWorkspaceChatTabActive,
    terminalWorkspaceOpen,
    terminalWorkspaceTerminalTabActive,
    toggleTerminalVisibility,
  });
  const terminalDrawerProps = useChatTerminalDrawerBindings({
    activateTerminal,
    activeProjectCwd: activeProject?.cwd,
    addTerminalContextToDraft,
    closeTerminal,
    closeTerminalGroup,
    closeTerminalShortcutLabel,
    closeWorkspaceShortcutLabel,
    createNewTerminal,
    createNewTerminalTab,
    gitCwd,
    moveTerminalToNewGroup,
    newTerminalShortcutLabel,
    resizeTerminalSplit,
    setTerminalActivity,
    setTerminalHeight,
    setTerminalMetadata,
    splitTerminalDown,
    splitTerminalDownShortcutLabel,
    splitTerminalRight,
    splitTerminalShortcutLabel,
    terminalFocusRequestId,
    terminalState,
    threadId,
    threadTerminalRuntimeEnv,
  });

  const { dispatchQueuedChatTurn, onSend, removeQueuedComposerTurn, restoreQueuedTurnToComposer } =
    useChatSendBindings({
      activeProject,
      activeProposedPlan,
      activeThread,
      addComposerImagesToDraft,
      addComposerTerminalContextsToDraft,
      clearComposerDraftContent,
      clearComposerInput,
      composerEditorRef,
      composerImages,
      composerTerminalContexts,
      dispatchChatTurn,
      enqueueQueuedComposerTurn,
      envMode,
      handleStandaloneSlashCommandRef,
      hasActivePendingProgress: activePendingProgress !== null,
      hasLiveTurn,
      hasNativeUserMessages,
      interactionMode,
      isConnecting,
      isSendBusy,
      isServerThread,
      isVoiceTranscribing,
      onAdvanceActivePendingUserInput,
      promptRef,
      providerOptionsForDispatch,
      removeQueuedComposerTurnFromDraft,
      runtimeMode,
      scheduleComposerFocus,
      selectedComposerMentions,
      selectedComposerSkills,
      selectedModel,
      selectedModelSelection,
      selectedPromptEffort,
      selectedProvider,
      sendInFlightRef,
      setComposerCursor,
      setComposerDraftInteractionMode,
      setComposerDraftModelSelection,
      setComposerDraftPrompt,
      setComposerDraftRuntimeMode,
      setComposerTrigger,
      setDraftThreadContext,
      setSelectedComposerMentions,
      setSelectedComposerSkills,
      setStoreThreadError,
      showPlanFollowUpPrompt,
      submitPlanFollowUpRef,
      threadId,
    });

  const {
    onEditQueuedComposerTurn,
    onImplementPlanInNewThread,
    onSteerQueuedComposerTurn,
    submitPlanFollowUp,
  } = useChatQueuedTurnBindings({
    activeProject,
    activeProposedPlan,
    activeThread,
    activeThreadAssociatedWorktree,
    autoDispatchingQueuedTurnRef,
    beginLocalDispatch,
    dispatchQueuedChatTurn,
    forceStickToBottom,
    formatOutgoingPrompt,
    handleImplementationThreadOpened,
    handlePlanImplementationStarted,
    hasActivePendingApproval: activePendingApproval !== null,
    hasActivePendingProgress: activePendingProgress !== null,
    hasLiveTurn,
    insertQueuedComposerTurn,
    isConnecting,
    isDisconnected: phase === "disconnected",
    isSendBusy,
    isServerThread,
    pendingUserInputCount: pendingUserInputs.length,
    persistThreadSettingsForNextTurn,
    providerOptionsForDispatch,
    queuedComposerTurns,
    queuedComposerTurnsRef,
    removeQueuedComposerTurn,
    removeQueuedComposerTurnFromDraft,
    resetLocalDispatch,
    restoreQueuedTurnToComposer,
    runtimeMode,
    selectedModel,
    selectedModelSelection,
    selectedPromptEffort,
    selectedProvider,
    sendInFlightRef,
    setComposerDraftInteractionMode,
    setOptimisticUserMessages,
    setThreadError,
    settingsEnableAssistantStreaming: settings.enableAssistantStreaming,
    syncServerReadModel,
    threadId,
  });
  submitPlanFollowUpRef.current = submitPlanFollowUp;

  const { composerTraitSelection, onProviderModelSelect, providerTraitsPicker, toggleFastMode } =
    useChatComposerModelBindings({
      activeThread,
      composerModelOptions,
      customModelsByProvider,
      lockedProvider,
      prompt,
      promptRef,
      scheduleComposerFocus,
      selectedModel,
      selectedProvider,
      setComposerCursor,
      setComposerDraftModelSelection,
      setComposerDraftProviderModelOptions,
      setComposerTrigger,
      setPrompt,
      setStickyComposerModelSelection,
      threadId,
    });

  const {
    handleStandaloneSlashCommand,
    isSlashStatusDialogOpen,
    onComposerCommandKey,
    onComposerMenuItemHighlighted,
    onPromptChange,
    onSelectComposerItem,
    setIsSlashStatusDialogOpen,
  } = useChatComposerCommandBindings({
    activePendingQuestionId: activePendingProgress?.activeQuestion?.id ?? null,
    activeProject,
    activeRootBranch,
    activeThread,
    applyPromptReplacement,
    buildSkillMentionReplacement: (skillName) =>
      `${skillMentionPrefix(selectedProvider)}${skillName} `,
    clearComposerDraftContent,
    composerCommandPicker,
    composerCursor,
    composerEditorRef,
    composerHighlightedItemId,
    composerMenuItems,
    composerMenuOpen,
    composerTerminalContexts,
    currentProviderModelOptions,
    fastModeEnabled,
    handleInteractionModeChange,
    hasActivePendingUserInput: activePendingUserInput !== null,
    interactionMode,
    isServerThread,
    onChangeActivePendingUserInputCustomAnswer,
    onProviderModelSelect,
    onSend,
    openFreshThread: async () => {
      if (!activeProject) {
        toastManager.add({
          type: "warning",
          title: "Clear is unavailable",
          description: "Open a project before starting a fresh thread.",
        });
        return;
      }
      await handleNewThread(activeProject.id, { entryPoint: "chat" });
    },
    providerCommandDiscoveryCwd: composerSkillCwd,
    providerNativeCommands,
    promptRef,
    runtimeMode,
    scheduleComposerFocus,
    selectedModelSelection,
    selectedProvider,
    setComposerCommandPicker,
    setComposerCursor,
    setComposerDraftProviderModelOptions,
    setComposerDraftTerminalContexts,
    setComposerHighlightedItemId,
    setComposerTrigger,
    setPrompt,
    setSelectedComposerMentions,
    setSelectedComposerSkills,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
    syncServerReadModel,
    threadId,
    toggleInteractionMode,
    navigateToThread: async (nextThreadId) => {
      await navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
      });
    },
  });
  handleStandaloneSlashCommandRef.current = handleStandaloneSlashCommand;
  const {
    addComposerImages,
    isDragOverComposer,
    onComposerDragEnter,
    onComposerDragLeave,
    onComposerDragOver,
    onComposerDrop,
    onComposerPaste,
    removeComposerImage,
    resetComposerAttachmentUi,
  } = useChatComposerAttachmentBindings({
    activeThreadId,
    addComposerImage,
    addComposerImagesToDraft,
    composerImagesRef,
    focusComposer,
    imageSizeLimitLabel: IMAGE_SIZE_LIMIT_LABEL,
    pendingUserInputCount: pendingUserInputs.length,
    removeComposerImageFromDraft,
    setThreadError,
  });

  useEffect(() => {
    setOptimisticUserMessages((existing) => {
      for (const message of existing) {
        revokeUserMessagePreviewUrls(message);
      }
      return [];
    });
    setLocalDispatch(null);
    setComposerHighlightedItemId(null);
    setComposerCursor(collapseExpandedComposerCursor(promptRef.current, promptRef.current.length));
    setComposerTrigger(detectComposerTrigger(promptRef.current, promptRef.current.length));
    setSelectedComposerSkills([]);
    setSelectedComposerMentions([]);
    resetComposerAttachmentUi();
  }, [resetComposerAttachmentUi, threadId]);

  const {
    onExpandTimelineImage,
    onNavigateToThread,
    onOpenTurnDiff,
    onRevertUserMessage,
    onRunProjectScriptFromHeader,
    onScrollToBottom,
    onToggleWorkGroup,
  } = useChatTranscriptBindings({
    diffEnvironmentPending,
    forceStickToBottom,
    navigate,
    onExpandTimelineImage: onExpandImage,
    onOpenTurnDiffPanel,
    onRevertToTurnCount,
    revertTurnCountByUserMessageId,
    runProjectScript,
    setExpandedWorkGroups,
    threadId,
  });
  const composerPlanTitle =
    showPlanFollowUpPrompt && activeProposedPlan
      ? (proposedPlanTitle(activeProposedPlan.planMarkdown) ?? null)
      : null;
  const composerPromptValue = isComposerApprovalState
    ? ""
    : activePendingProgress
      ? activePendingProgress.customAnswer
      : prompt;
  const composerPromptPlaceholder = isComposerApprovalState
    ? (activePendingApproval?.detail ?? "Resolve this approval request to continue")
    : activePendingProgress
      ? "Type your own answer, or leave this blank to use the selected option"
      : showPlanFollowUpPrompt && activeProposedPlan
        ? "Add feedback to refine the plan, or leave this blank to implement it"
        : hasLiveTurn
          ? "Ask for follow-up changes"
          : phase === "disconnected"
            ? "Ask for follow-up changes or attach images"
            : "Ask anything, @tag files/folders, or use / to show available commands";
  const {
    composerActivePlanCard,
    composerCommandMenuNode,
    composerFooter,
    composerImageAttachmentsNode,
    composerPromptEditorNode,
    composerStatusBanner,
  } = useChatComposerFooterBindings({
    activePlan,
    activePendingApproval,
    activePendingDraftAnswers,
    activePendingIsResponding,
    activePendingProgress,
    activePendingQuestionIndex,
    activePendingResolvedAnswers: Boolean(activePendingResolvedAnswers),
    activePlanBackgroundTaskCount: activeBackgroundTasks?.activeCount ?? 0,
    activeProposedPlanTitle: composerPlanTitle,
    composerCommandMenuItems: composerMenuItems,
    composerCommandMenuTriggerKind:
      composerCommandPicker !== null ? "slash-command" : effectiveComposerTriggerKind,
    composerCursor,
    composerEditorRef,
    composerImages,
    composerMenuActiveItemId: activeComposerMenuItem?.id ?? null,
    composerMenuOpen,
    composerPromptPlaceholder,
    composerPromptValue,
    composerTerminalContexts,
    fastModeEnabled: composerTraitSelection.fastModeEnabled,
    hasComposerSendableContent: composerSendState.hasSendableContent,
    interactionMode,
    isComposerApprovalState,
    isComposerDisabled: isConnecting || isComposerApprovalState,
    isComposerFooterCompact,
    isComposerMenuLoading,
    isConnecting,
    isPreparingWorktree,
    isSendBusy,
    isVoiceRecording,
    isVoiceTranscribing,
    lockedProvider,
    modelOptionsByProvider,
    modelPickerIconClassName: composerProviderState.modelPickerIconClassName,
    nonPersistedComposerImageIdSet,
    onAddComposerPhotos: addComposerImages,
    onAdvanceActivePendingUserInput,
    onCancelComposerVoiceRecording: cancelComposerVoiceRecording,
    onExpandComposerImage: onExpandImage,
    onImplementPlanInNewThread,
    onOpenPlanSidebar: openPlanSidebar,
    onPreviousActivePendingUserInputQuestion,
    onComposerCommandKey,
    onComposerPaste,
    onPromptChange,
    onProviderModelSelect,
    onRemoveComposerImage: removeComposerImage,
    onRemoveComposerTerminalContext: removeComposerTerminalContextFromDraft,
    onRespondToApproval,
    onSelectComposerMenuItem: onSelectComposerItem,
    onSetPlanMode: setPlanMode,
    onSubmitComposerVoiceRecording: submitComposerVoiceRecording,
    onToggleActivePendingUserInputOption,
    onToggleComposerMenuItemHighlighted: onComposerMenuItemHighlighted,
    onToggleComposerVoiceRecording: toggleComposerVoiceRecording,
    onToggleFastMode: toggleFastMode,
    onToggleInteractionMode: toggleInteractionMode,
    onInterrupt,
    pendingApprovalsCount: pendingApprovals.length,
    pendingUserInputs,
    phase,
    planSidebarOpen,
    providerStatuses,
    providerTraitsPicker,
    resolvedTheme,
    respondingRequestIds,
    selectedModelForPicker: selectedModelForPickerWithCustomFallback,
    selectedProvider,
    showPlanFollowUpPrompt,
    showVoiceNotesControl,
    supportsFastMode: composerTraitSelection.caps.supportsFastMode,
    voiceRecordingDurationLabel,
    voiceWaveformLevels,
  });

  // Empty state: no active thread
  if (!activeThread) {
    return <ChatEmptyThreadState sidebarSide={settings.sidebarSide} />;
  }

  const { chatComposerPaneProps, chatTranscriptPaneProps } = useChatViewPaneBindings({
    activeThreadId: activeThread.id,
    activeTurnInProgress,
    activeTurnStartedAt: activeWorkStartedAt,
    chatFontSizePx: settings.chatFontSizePx,
    completionDividerBeforeEntryId,
    completionSummary,
    composerActivePlanCard,
    composerCommandMenuNode,
    composerFooter,
    composerFormRef,
    composerFrameClassName: composerProviderState.composerFrameClassName,
    composerImageAttachmentsNode,
    composerPromptEditorNode,
    composerStatusBanner,
    composerSurfaceClassName: composerProviderState.composerSurfaceClassName,
    emptyStateProjectName: activeProject?.name,
    expandedWorkGroups,
    hasMessages: timelineEntries.length > 0,
    isDragOverComposer,
    isGitRepo,
    isRevertingCheckpoint,
    isWorking,
    markdownCwd: threadWorkspaceCwd ?? undefined,
    messagesScrollElement,
    nowIso,
    onComposerDragEnter,
    onComposerDragLeave,
    onComposerDragOver,
    onComposerDrop,
    onEditQueuedComposerTurn,
    onExpandTimelineImage,
    onMessagesClickCapture,
    onMessagesPointerCancel,
    onMessagesPointerDown,
    onMessagesPointerUp,
    onMessagesScroll,
    onMessagesTouchEnd,
    onMessagesTouchMove,
    onMessagesTouchStart,
    onMessagesWheel,
    onOpenThread: onNavigateToThread,
    onOpenTurnDiff,
    onRemoveQueuedComposerTurn: removeQueuedComposerTurn,
    onRevertUserMessage,
    onScrollToBottom,
    onSend,
    onSteerQueuedComposerTurn,
    onTimelineHeightChange,
    onToggleWorkGroup,
    paneScopeId,
    queuedComposerTurns,
    resolvedTheme,
    revertTurnCountByUserMessageId,
    scrollButtonVisible: showScrollToBottom,
    setMessagesBottomAnchorRef,
    setMessagesScrollContainerRef,
    terminalWorkspaceTerminalTabActive,
    timelineEntries,
    timestampFormat,
    turnDiffSummaryByAssistantMessageId,
    workspaceRoot: activeProject?.cwd ?? undefined,
  });
  const activeThreadTitle = activeThread.parentThreadId
    ? resolveSubagentPresentationForThread({
        thread: activeThread,
        threads: allThreads,
      }).fullLabel
    : activeThread.title;
  const chatLayoutAction =
    surfaceMode === "single" && onSplitSurface
      ? {
          kind: "split" as const,
          label: "Split chat",
          shortcutLabel: chatSplitShortcutLabel,
          onClick: onSplitSurface,
        }
      : surfaceMode === "split" && isFocusedPane && onMaximizeSurface
        ? {
            kind: "maximize" as const,
            label: "Expand this chat",
            shortcutLabel: null,
            onClick: onMaximizeSurface,
          }
        : null;
  const { chatThreadPaneProps } = useChatViewShellBindings({
    activeContextWindow,
    activeCumulativeCostUsd,
    activePlan,
    activeProjectCwd: activeProject?.cwd,
    activeProjectName: activeProject?.name,
    activeProjectScripts: activeProject?.scripts,
    activeProviderStatus,
    activeRateLimitStatus,
    activeThreadError: activeThread.error,
    activeThreadId: activeThread.id,
    activeThreadTitle,
    availableEditors,
    browserOpen: resolvedBrowserOpen,
    browserToggleShortcutLabel: browserPanelShortcutLabel,
    canCheckoutPullRequestIntoThread,
    chatComposerPaneProps,
    chatLayoutAction,
    chatTranscriptPaneProps,
    collapseTerminalWorkspace,
    diffDisabledReason,
    diffOpen: resolvedDiffOpen,
    diffToggleShortcutLabel: diffPanelShortcutLabel,
    dismissActiveThreadError,
    envLocked,
    expandTerminalWorkspace,
    gitCwd: threadWorkspaceCwd,
    handoffActionLabel,
    handoffActionTargetProvider: handoffTargetProvider,
    handoffBadgeLabel,
    handoffBadgeSourceProvider,
    handoffBadgeTargetProvider,
    handoffBusy,
    handoffDisabled,
    hideHandoffControls: terminalWorkspaceTerminalTabActive,
    isElectron,
    isGitRepo,
    keybindings,
    markdownCwd: threadWorkspaceCwd ?? undefined,
    onAddProjectScript: saveProjectScript,
    onClosePlanSidebar: closePlanSidebar,
    onClosePullRequestDialog: closePullRequestDialog,
    onComposerFocusRequest: scheduleComposerFocus,
    onCreateHandoff: onCreateHandoffThread,
    onDeleteProjectScript: deleteProjectScript,
    onEnvModeChange,
    onHandoffToLocal,
    onHandoffToWorktree,
    onNavigateToThread,
    onPreparedPullRequestThread: handlePreparedPullRequestThread,
    onRunProjectScript: onRunProjectScriptFromHeader,
    onRuntimeModeChange: handleRuntimeModeChange,
    onToggleBrowser,
    onToggleDiff,
    onToggleTerminal: toggleTerminalVisibility,
    onUpdateProjectScript: updateProjectScript,
    openInCwd: threadWorkspaceCwd,
    openPullRequestDialog,
    planSidebarOpen,
    preferredScriptId: activeProject
      ? (lastInvokedScriptByProjectId[activeProject.id] ?? null)
      : null,
    pullRequestDialogState,
    runtimeMode,
    sidebarProposedPlan,
    sidebarSide: settings.sidebarSide,
    surfaceMode,
    terminalAvailable: activeProject !== undefined,
    terminalCount: terminalState.terminalIds.length,
    terminalDrawerProps,
    terminalOpen: terminalState.terminalOpen,
    terminalRunningCount: terminalState.runningTerminalIds.length,
    terminalToggleShortcutLabel,
    terminalWorkspaceActiveTab: terminalState.workspaceActiveTab,
    terminalWorkspaceLayout: terminalState.workspaceLayout,
    terminalWorkspaceOpen,
    terminalWorkspaceTerminalTabActive,
    onSelectTerminalWorkspaceTab: setTerminalWorkspaceTab,
    threadBreadcrumbs,
    timestampFormat,
    workspaceRoot: activeProject?.cwd ?? undefined,
  });
  const { chatExpandedImageDialogProps, chatViewDialogsProps } = useChatViewDialogBindings({
    activeContextWindow,
    activeCumulativeCostUsd,
    activeRateLimitStatus,
    activeRootBranch,
    activeThreadBranch: activeThread?.branch,
    confirmWorktreeHandoff,
    envMode,
    envState,
    expandedImage,
    fastModeEnabled,
    handoffBusy,
    interactionMode,
    isSlashStatusDialogOpen,
    navigateExpandedImage,
    onCloseExpandedImage: closeExpandedImage,
    selectedModel,
    selectedPromptEffort,
    setIsSlashStatusDialogOpen,
    setWorktreeHandoffDialogOpen,
    setWorktreeHandoffName,
    worktreeHandoffDialogOpen,
    worktreeHandoffName,
  });

  return (
    <>
      <ChatViewShell chatThreadPaneProps={chatThreadPaneProps} />

      <ChatViewDialogs {...chatViewDialogsProps} />

      <ChatExpandedImageDialog {...chatExpandedImageDialogProps} />
    </>
  );
}

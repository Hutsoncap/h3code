import {
  type ApprovalRequestId,
  DEFAULT_MODEL_BY_PROVIDER,
  type ClaudeCodeEffort,
  type MessageId,
  type ModelSelection,
  type ProviderKind,
  type ProjectEntry,
  type ProviderMentionReference,
  type ProviderNativeCommandDescriptor,
  type ProviderPluginDescriptor,
  type ProviderSkillDescriptor,
  type ProviderSkillReference,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  type ResolvedKeybindingsConfig,
  type ServerProviderStatus,
  ThreadId,
  type ThreadId as ThreadIdType,
  type TurnId,
  type EditorId,
  OrchestrationThreadActivity,
} from "@t3tools/contracts";
import {
  applyClaudePromptEffortPrefix,
  getModelCapabilities,
  normalizeModelSlug,
} from "@t3tools/shared/model";
import {
  resolveThreadWorkspaceState,
  resolveThreadBranchSourceCwd,
  resolveThreadWorkspaceCwd as resolveSharedThreadWorkspaceCwd,
} from "@t3tools/shared/threadEnvironment";
import { deriveAssociatedWorktreeMetadata } from "@t3tools/shared/threadWorkspace";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { gitCreateWorktreeMutationOptions, gitBranchesQueryOptions } from "~/lib/gitReactQuery";
import { resolveProviderDiscoveryCwd } from "~/lib/providerDiscovery";
import {
  providerComposerCapabilitiesQueryOptions,
  providerCommandsQueryOptions,
  providerPluginsQueryOptions,
  providerSkillsQueryOptions,
  supportsNativeSlashCommandDiscovery,
  supportsPluginDiscovery,
  supportsSkillDiscovery,
} from "~/lib/providerDiscoveryReactQuery";
import { projectSearchEntriesQueryOptions } from "~/lib/projectReactQuery";
import { serverConfigQueryOptions, serverQueryKeys } from "~/lib/serverReactQuery";
import { isElectron } from "../env";
import { parseDiffRouteSearch, stripDiffSearchParams } from "../diffRouteSearch";
import {
  humanizeSubagentStatus,
  resolveSubagentPresentationForThread,
} from "../lib/subagentPresentation";
import {
  clampCollapsedComposerCursor,
  type ComposerTrigger,
  collapseExpandedComposerCursor,
  detectComposerTrigger,
  expandCollapsedComposerCursor,
  replaceTextRange,
  stripComposerTriggerText,
} from "../composer-logic";
import { createProjectSelector, createThreadSelector } from "../storeSelectors";
import {
  canOfferForkSlashCommand,
  canOfferReviewSlashCommand,
  hasProviderNativeSlashCommand,
  resolveComposerSlashRootBranch,
} from "../composerSlashCommands";
import {
  derivePendingApprovals,
  derivePendingUserInputs,
  derivePhase,
  deriveTimelineEntries,
  deriveActiveWorkStartedAt,
  deriveActivePlanState,
  deriveActiveBackgroundTasksState,
  findSidebarProposedPlan,
  findLatestProposedPlan,
  deriveWorkLogEntries,
  hasActionableProposedPlan,
  hasLiveTurnTailWork,
  hasToolActivityForTurn,
  isLatestTurnSettled,
  formatElapsed,
  type WorkLogEntry,
} from "../session-logic";
import {
  buildPendingUserInputAnswers,
  derivePendingUserInputProgress,
  type PendingUserInputDraftAnswer,
} from "../pendingUserInput";
import { useStore } from "../store";
import { proposedPlanTitle } from "../proposedPlan";
import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  type ChatMessage,
  type Thread,
  type TurnDiffSummary,
} from "../types";
import { useTheme } from "../hooks/useTheme";
import { useThreadWorkspaceHandoff } from "../hooks/useThreadWorkspaceHandoff";
import { useComposerCommandMenuItems } from "../hooks/useComposerCommandMenuItems";
import { useThreadHandoff } from "../hooks/useThreadHandoff";
import { useTurnDiffSummaries } from "../hooks/useTurnDiffSummaries";
import { toastManager } from "./ui/toast";
import { projectScriptRuntimeEnv } from "~/projectScripts";
import { newCommandId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import {
  getCustomModelOptionsByProvider,
  getCustomModelsByProvider,
  getProviderStartOptions,
  useAppSettings,
} from "../appSettings";
import {
  type ComposerImageAttachment,
  type DraftThreadEnvMode,
  type QueuedComposerPlanFollowUp,
  type QueuedComposerTurn,
  useEffectiveComposerModelState,
} from "../composerDraftStore";
import { type TerminalContextDraft } from "../lib/terminalContext";
import { deriveLatestContextWindowSnapshot, deriveCumulativeCostUsd } from "../lib/contextWindow";
import { shouldUseCompactComposerFooter } from "./composerFooterLayout";
import {
  resolveSplitViewFocusedThreadId,
  selectSplitView,
  type SplitViewPanePanelState,
  useSplitViewStore,
} from "../splitViewStore";
import { type ComposerPromptEditorHandle } from "./ComposerPromptEditor";
import { AVAILABLE_PROVIDER_OPTIONS } from "./chat/ProviderModelPicker";
import { ChatEmptyThreadState } from "./chat/ChatEmptyThreadState";
import { ChatExpandedImageDialog } from "./chat/ChatExpandedImageDialog";
import { ChatViewDialogs } from "./chat/ChatViewDialogs";
import { ChatViewShell } from "./chat/ChatViewShell";
import { useChatComposerAttachmentBindings } from "./chat/useChatComposerAttachmentBindings";
import { useChatComposerDraftBindings } from "./chat/useChatComposerDraftBindings";
import { useChatComposerCommandBindings } from "./chat/useChatComposerCommandBindings";
import { useChatComposerFooterBindings } from "./chat/useChatComposerFooterBindings";
import { useChatMediaBindings } from "./chat/useChatMediaBindings";
import { useChatComposerModelBindings } from "./chat/useChatComposerModelBindings";
import { useChatPlanHandoffBindings } from "./chat/useChatPlanHandoffBindings";
import { useChatSendBindings } from "./chat/useChatSendBindings";
import { useChatComposerTerminalContextBindings } from "./chat/useChatComposerTerminalContextBindings";
import { useChatViewDialogBindings } from "./chat/useChatViewDialogBindings";
import { useChatTranscriptBindings } from "./chat/useChatTranscriptBindings";
import { useChatViewPaneBindings } from "./chat/useChatViewPaneBindings";
import { useChatViewShellBindings } from "./chat/useChatViewShellBindings";
import { useComposerVoiceController } from "./chat/useComposerVoiceController";
import { useChatEnvModeBindings } from "./chat/useChatEnvModeBindings";
import { useChatTerminalActionBindings } from "./chat/useChatTerminalActionBindings";
import { useChatTerminalBindings } from "./chat/useChatTerminalBindings";
import { useChatTerminalShortcutBindings } from "./chat/useChatTerminalShortcutBindings";
import { useChatThreadSettingsBindings } from "./chat/useChatThreadSettingsBindings";
import { useChatPullRequestController } from "./chat/useChatPullRequestController";
import { useChatAutoScrollController } from "./chat/useChatAutoScrollController";
import { useChatPendingInteractionBindings } from "./chat/useChatPendingInteractionBindings";
import { useChatQueuedTurnBindings } from "./chat/useChatQueuedTurnBindings";
import { useChatProjectScriptBindings } from "./chat/useChatProjectScriptBindings";
import { useChatTurnDispatchBindings } from "./chat/useChatTurnDispatchBindings";
import { getComposerProviderState } from "./chat/composerProviderRegistry";
import { deriveLatestRateLimitStatus } from "./chat/RateLimitBanner";
import {
  ACTIVE_TURN_LAYOUT_SETTLE_DELAY_MS,
  appendVoiceTranscriptToPrompt,
  shouldStartActiveTurnLayoutGrace,
  buildLocalDraftThread,
  hasServerAcknowledgedLocalDispatch,
  LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
  LastInvokedScriptByProjectSchema,
  type LocalDispatchSnapshot,
  revokeUserMessagePreviewUrls,
} from "./ChatView.logic";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import {
  resolveDiffEnvironmentState,
  resolveThreadEnvironmentMode,
} from "../lib/threadEnvironment";

const IMAGE_SIZE_LIMIT_LABEL = `${Math.round(PROVIDER_SEND_TURN_MAX_IMAGE_BYTES / (1024 * 1024))}MB`;
const EMPTY_ACTIVITIES: OrchestrationThreadActivity[] = [];
const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const EMPTY_PROJECT_ENTRIES: ProjectEntry[] = [];
const EMPTY_PROVIDER_NATIVE_COMMANDS: ProviderNativeCommandDescriptor[] = [];
const EMPTY_PROVIDER_SKILLS: ProviderSkillDescriptor[] = [];
const EMPTY_AVAILABLE_EDITORS: EditorId[] = [];
const EMPTY_PROVIDER_STATUSES: ServerProviderStatus[] = [];
const EMPTY_PENDING_USER_INPUT_ANSWERS: Record<string, PendingUserInputDraftAnswer> = {};

type ComposerPluginSuggestion = {
  plugin: ProviderPluginDescriptor;
  mention: ProviderMentionReference;
};

const EMPTY_COMPOSER_PLUGIN_SUGGESTIONS: ComposerPluginSuggestion[] = [];

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

const COMPOSER_PATH_QUERY_DEBOUNCE_MS = 120;
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

const providerMentionReferencesEqual = (
  left: ReadonlyArray<ProviderMentionReference>,
  right: ReadonlyArray<ProviderMentionReference>,
): boolean =>
  left.length === right.length &&
  left.every(
    (mention, index) => mention.path === right[index]?.path && mention.name === right[index]?.name,
  );

interface ThreadBreadcrumb {
  threadId: ThreadIdType;
  title: string;
}

function buildThreadBreadcrumbs(
  threads: ReadonlyArray<Thread>,
  thread: Pick<Thread, "id" | "parentThreadId"> | null | undefined,
): ThreadBreadcrumb[] {
  if (!thread?.parentThreadId) {
    return [];
  }

  const threadById = new Map(threads.map((entry) => [entry.id, entry] as const));
  const breadcrumbs: ThreadBreadcrumb[] = [];
  const visited = new Set<ThreadIdType>();
  let currentParentId: ThreadIdType | null = thread.parentThreadId ?? null;

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parentThread = threadById.get(currentParentId);
    if (!parentThread) {
      break;
    }
    breadcrumbs.unshift({
      threadId: parentThread.id,
      title: parentThread.parentThreadId
        ? resolveSubagentPresentationForThread({ thread: parentThread, threads }).fullLabel
        : parentThread.title,
    });
    currentParentId = parentThread.parentThreadId ?? null;
  }

  return breadcrumbs;
}

function deriveSubagentStatus(thread: Thread | undefined): {
  isActive: boolean;
  label: string | undefined;
} {
  if (!thread) {
    return {
      isActive: false,
      label: undefined,
    };
  }

  if (thread.error || thread.session?.status === "error") {
    return {
      isActive: false,
      label: "Error",
    };
  }
  if (thread.session?.status === "connecting") {
    return {
      isActive: true,
      label: "Connecting",
    };
  }
  if (
    thread.session?.status === "running" ||
    hasLiveTurnTailWork({
      latestTurn: thread.latestTurn,
      messages: thread.messages,
      activities: thread.activities,
      session: thread.session,
    })
  ) {
    return {
      isActive: true,
      label: "Running",
    };
  }
  if (thread.session?.status === "closed") {
    return {
      isActive: false,
      label: "Closed",
    };
  }

  return {
    isActive: false,
    label: thread.session ? "Idle" : undefined,
  };
}

function humanizeSubagentRawStatus(rawStatus: string | undefined): string | undefined {
  return humanizeSubagentStatus(rawStatus);
}

function localSubagentThreadId(
  parentThreadId: ThreadIdType,
  providerThreadId: string,
): ThreadIdType {
  return ThreadId.makeUnsafe(`subagent:${parentThreadId}:${providerThreadId}`);
}

function resolveTimelineSubagentThread(input: {
  subagent: NonNullable<WorkLogEntry["subagents"]>[number];
  parentThreadId: ThreadIdType | null;
  threadById: ReadonlyMap<ThreadIdType, Thread>;
  threads: ReadonlyArray<Thread>;
}): Thread | undefined {
  const directThreadId = input.subagent.resolvedThreadId ?? input.subagent.threadId;
  if (directThreadId) {
    const directMatch = input.threadById.get(ThreadId.makeUnsafe(directThreadId));
    if (directMatch) {
      return directMatch;
    }
  }

  if (input.parentThreadId) {
    const providerThreadId = input.subagent.providerThreadId ?? input.subagent.threadId;
    const derivedLocalThreadId = localSubagentThreadId(input.parentThreadId, providerThreadId);
    const derivedLocalMatch = input.threadById.get(derivedLocalThreadId);
    if (derivedLocalMatch) {
      return derivedLocalMatch;
    }

    if (input.subagent.agentId) {
      const matchedByAgent = input.threads.find(
        (thread) =>
          thread.parentThreadId === input.parentThreadId &&
          thread.subagentAgentId === input.subagent.agentId,
      );
      if (matchedByAgent) {
        return matchedByAgent;
      }
    }
  }

  if (input.subagent.agentId) {
    return input.threads.find((thread) => thread.subagentAgentId === input.subagent.agentId);
  }

  return undefined;
}

function enrichSubagentWorkEntries(
  workEntries: ReadonlyArray<WorkLogEntry>,
  threads: ReadonlyArray<Thread>,
  parentThreadId: ThreadIdType | null,
): WorkLogEntry[] {
  if (workEntries.length === 0) {
    return [];
  }

  const threadById = new Map(threads.map((thread) => [thread.id, thread] as const));

  return workEntries.map((entry) => {
    if ((entry.subagents?.length ?? 0) === 0) {
      return entry;
    }

    const subagents = entry.subagents!.map((subagent) => {
      const matchedThread = resolveTimelineSubagentThread({
        subagent,
        parentThreadId,
        threadById,
        threads,
      });
      const status = deriveSubagentStatus(matchedThread);
      const fallbackStatusLabel = humanizeSubagentRawStatus(subagent.rawStatus);
      const matchedPresentation =
        matchedThread !== undefined
          ? resolveSubagentPresentationForThread({ thread: matchedThread, threads })
          : null;
      const nextSubagent = Object.assign({}, subagent);
      if (matchedThread) {
        nextSubagent.resolvedThreadId = matchedThread.id;
      }
      if (matchedPresentation) {
        nextSubagent.title = matchedPresentation.fullLabel;
      }
      if (status.label ?? fallbackStatusLabel) {
        nextSubagent.statusLabel = status.label ?? fallbackStatusLabel;
      }
      if (status.isActive || fallbackStatusLabel === "Running") {
        nextSubagent.isActive = true;
      }
      return nextSubagent;
    });

    return {
      ...entry,
      subagents,
    };
  });
}

interface ChatViewProps {
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

export default function ChatView({
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
  const [expandedWorkGroups, setExpandedWorkGroups] = useState<Record<string, boolean>>({});
  const [isComposerFooterCompact, setIsComposerFooterCompact] = useState(false);
  const [composerCommandPicker, setComposerCommandPicker] = useState<
    null | "fork-target" | "review-target"
  >(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
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
  const composerFormHeightRef = useRef(0);
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
  const threadBreadcrumbs = useMemo(
    () => buildThreadBreadcrumbs(allThreads, activeThread),
    [activeThread, allThreads],
  );
  const resolvedThreadEnvMode = isServerThread
    ? (activeThread?.envMode ?? null)
    : (draftThread?.envMode ?? null);
  const resolvedThreadWorktreePath = isServerThread
    ? (activeThread?.worktreePath ?? null)
    : (draftThread?.worktreePath ?? null);
  const diffEnvironmentState = resolveDiffEnvironmentState({
    projectCwd: activeProject?.cwd ?? null,
    envMode: resolvedThreadEnvMode,
    worktreePath: resolvedThreadWorktreePath,
  });
  const diffEnvironmentPending = diffEnvironmentState.pending;
  const diffDisabledReason = diffEnvironmentState.disabledReason;
  const activeThreadAssociatedWorktree = useMemo(
    () =>
      deriveAssociatedWorktreeMetadata({
        branch: activeThread?.branch ?? null,
        worktreePath: activeThread?.worktreePath ?? null,
        associatedWorktreePath: activeThread?.associatedWorktreePath ?? null,
        associatedWorktreeBranch: activeThread?.associatedWorktreeBranch ?? null,
        associatedWorktreeRef: activeThread?.associatedWorktreeRef ?? null,
      }),
    [
      activeThread?.associatedWorktreeBranch,
      activeThread?.associatedWorktreePath,
      activeThread?.associatedWorktreeRef,
      activeThread?.branch,
      activeThread?.worktreePath,
    ],
  );

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

  useEffect(() => {
    if (!activeThread?.id) return;
    if (!latestTurnSettled) return;
    if (!activeLatestTurn?.completedAt) return;
    const turnCompletedAt = Date.parse(activeLatestTurn.completedAt);
    if (Number.isNaN(turnCompletedAt)) return;
    const lastVisitedAt = activeThread.lastVisitedAt ? Date.parse(activeThread.lastVisitedAt) : NaN;
    if (!Number.isNaN(lastVisitedAt) && lastVisitedAt >= turnCompletedAt) return;

    markThreadVisited(activeThread.id);
  }, [
    activeThread?.id,
    activeThread?.lastVisitedAt,
    activeLatestTurn?.completedAt,
    latestTurnSettled,
    markThreadVisited,
  ]);

  const sessionProvider = activeThread?.session?.provider ?? null;
  const selectedProviderByThreadId = composerDraft.activeProvider ?? null;
  const threadProvider =
    activeThread?.modelSelection.provider ?? activeProject?.defaultModelSelection?.provider ?? null;
  const hasThreadStarted = Boolean(
    activeThread &&
    (activeThread.latestTurn !== null ||
      activeThread.messages.length > 0 ||
      activeThread.session !== null),
  );
  const lockedProvider: ProviderKind | null = hasThreadStarted
    ? (sessionProvider ?? threadProvider ?? selectedProviderByThreadId ?? null)
    : null;
  const selectedProvider: ProviderKind =
    lockedProvider ?? selectedProviderByThreadId ?? threadProvider ?? settings.defaultProvider;
  const customModelsByProvider = useMemo(() => getCustomModelsByProvider(settings), [settings]);
  const { modelOptions: composerModelOptions, selectedModel } = useEffectiveComposerModelState({
    threadId,
    selectedProvider,
    threadModelSelection: activeThread?.modelSelection,
    projectModelSelection: activeProject?.defaultModelSelection,
    customModelsByProvider,
  });
  const composerProviderState = useMemo(
    () =>
      getComposerProviderState({
        provider: selectedProvider,
        model: selectedModel,
        prompt,
        modelOptions: composerModelOptions,
      }),
    [composerModelOptions, prompt, selectedModel, selectedProvider],
  );
  const selectedPromptEffort = composerProviderState.promptEffort;
  const selectedModelOptionsForDispatch = composerProviderState.modelOptionsForDispatch;
  const selectedModelSelection = useMemo<ModelSelection>(
    () => ({
      provider: selectedProvider,
      model: selectedModel,
      ...(selectedModelOptionsForDispatch ? { options: selectedModelOptionsForDispatch } : {}),
    }),
    [selectedModel, selectedModelOptionsForDispatch, selectedProvider],
  );
  const providerOptionsForDispatch = useMemo(() => getProviderStartOptions(settings), [settings]);
  const selectedModelForPicker = selectedModel;
  const modelOptionsByProvider = useMemo(
    () => getCustomModelOptionsByProvider(settings),
    [settings],
  );
  const selectedModelForPickerWithCustomFallback = useMemo(() => {
    const currentOptions = modelOptionsByProvider[selectedProvider];
    return currentOptions.some((option) => option.slug === selectedModelForPicker)
      ? selectedModelForPicker
      : (normalizeModelSlug(selectedModelForPicker, selectedProvider) ?? selectedModelForPicker);
  }, [modelOptionsByProvider, selectedModelForPicker, selectedProvider]);
  const searchableModelOptions = useMemo(
    () =>
      AVAILABLE_PROVIDER_OPTIONS.filter(
        (option) => lockedProvider === null || option.value === lockedProvider,
      ).flatMap((option) =>
        modelOptionsByProvider[option.value].map(({ slug, name }) => ({
          provider: option.value,
          providerLabel: option.label,
          slug,
          name,
          searchSlug: slug.toLowerCase(),
          searchName: name.toLowerCase(),
          searchProvider: option.label.toLowerCase(),
        })),
      ),
    [lockedProvider, modelOptionsByProvider],
  );
  const phase = derivePhase(activeThread?.session ?? null);
  const workLogEntries = useMemo(
    () =>
      enrichSubagentWorkEntries(
        deriveWorkLogEntries(threadActivities, activeLatestTurn?.turnId ?? undefined),
        allThreads,
        activeThread?.id ?? null,
      ),
    [activeLatestTurn?.turnId, activeThread?.id, allThreads, threadActivities],
  );
  const latestTurnHasToolActivity = useMemo(
    () => hasToolActivityForTurn(threadActivities, activeLatestTurn?.turnId),
    [activeLatestTurn?.turnId, threadActivities],
  );
  const pendingApprovals = useMemo(
    () => derivePendingApprovals(threadActivities),
    [threadActivities],
  );
  const pendingUserInputs = useMemo(
    () => derivePendingUserInputs(threadActivities),
    [threadActivities],
  );
  const activePendingUserInput = pendingUserInputs[0] ?? null;
  const activePendingDraftAnswers = useMemo(
    () =>
      activePendingUserInput
        ? (pendingUserInputAnswersByRequestId[activePendingUserInput.requestId] ??
          EMPTY_PENDING_USER_INPUT_ANSWERS)
        : EMPTY_PENDING_USER_INPUT_ANSWERS,
    [activePendingUserInput, pendingUserInputAnswersByRequestId],
  );
  const activePendingQuestionIndex = activePendingUserInput
    ? (pendingUserInputQuestionIndexByRequestId[activePendingUserInput.requestId] ?? 0)
    : 0;
  const activePendingProgress = useMemo(
    () =>
      activePendingUserInput
        ? derivePendingUserInputProgress(
            activePendingUserInput.questions,
            activePendingDraftAnswers,
            activePendingQuestionIndex,
          )
        : null,
    [activePendingDraftAnswers, activePendingQuestionIndex, activePendingUserInput],
  );
  const activePendingResolvedAnswers = useMemo(
    () =>
      activePendingUserInput
        ? buildPendingUserInputAnswers(activePendingUserInput.questions, activePendingDraftAnswers)
        : null,
    [activePendingDraftAnswers, activePendingUserInput],
  );
  const activePendingIsResponding = activePendingUserInput
    ? respondingUserInputRequestIds.includes(activePendingUserInput.requestId)
    : false;
  const activeProposedPlan = useMemo(() => {
    if (!latestTurnSettled) {
      return null;
    }
    return findLatestProposedPlan(
      activeThread?.proposedPlans ?? [],
      activeLatestTurn?.turnId ?? null,
    );
  }, [activeLatestTurn?.turnId, activeThread?.proposedPlans, latestTurnSettled]);
  const sidebarPlanSourceThreadId = !latestTurnSettled
    ? (activeLatestTurn?.sourceProposedPlan?.threadId ?? null)
    : null;
  const sidebarPlanSourceThread = useStore(
    useMemo(() => createThreadSelector(sidebarPlanSourceThreadId), [sidebarPlanSourceThreadId]),
  );
  const activeThreadPlanThreadId = activeThread?.id ?? null;
  const activeThreadPlanProposedPlans = activeThread?.proposedPlans;
  const sidebarPlanSourceThreadPlanId = sidebarPlanSourceThread?.id ?? null;
  const sidebarPlanSourceThreadProposedPlans = sidebarPlanSourceThread?.proposedPlans;
  const sidebarProposedPlan = useMemo(
    () =>
      findSidebarProposedPlan({
        threads: [
          ...(activeThreadPlanThreadId
            ? [
                {
                  id: activeThreadPlanThreadId,
                  proposedPlans: activeThreadPlanProposedPlans ?? [],
                },
              ]
            : []),
          ...(sidebarPlanSourceThreadPlanId &&
          sidebarPlanSourceThreadPlanId !== activeThreadPlanThreadId
            ? [
                {
                  id: sidebarPlanSourceThreadPlanId,
                  proposedPlans: sidebarPlanSourceThreadProposedPlans ?? [],
                },
              ]
            : []),
        ],
        latestTurn: activeLatestTurn,
        latestTurnSettled,
        threadId: activeThreadPlanThreadId,
      }),
    [
      activeLatestTurn,
      activeThreadPlanProposedPlans,
      activeThreadPlanThreadId,
      latestTurnSettled,
      sidebarPlanSourceThreadPlanId,
      sidebarPlanSourceThreadProposedPlans,
    ],
  );
  const activePlan = useMemo(
    () =>
      latestTurnSettled
        ? null
        : deriveActivePlanState(threadActivities, activeLatestTurn?.turnId ?? undefined),
    [activeLatestTurn?.turnId, latestTurnSettled, threadActivities],
  );
  const activeBackgroundTasks = useMemo(
    () =>
      latestTurnSettled
        ? null
        : deriveActiveBackgroundTasksState(threadActivities, activeLatestTurn?.turnId ?? undefined),
    [activeLatestTurn?.turnId, latestTurnSettled, threadActivities],
  );
  const showPlanFollowUpPrompt =
    pendingUserInputs.length === 0 &&
    interactionMode === "plan" &&
    latestTurnSettled &&
    hasActionableProposedPlan(activeProposedPlan);
  const activePendingApproval = pendingApprovals[0] ?? null;
  const serverAcknowledgedLocalDispatch = useMemo(
    () =>
      hasServerAcknowledgedLocalDispatch({
        localDispatch,
        phase,
        latestTurn: activeLatestTurn,
        session: activeThread?.session ?? null,
        hasPendingApproval: activePendingApproval !== null,
        hasPendingUserInput: activePendingUserInput !== null,
        threadError: activeThread?.error,
      }),
    [
      activeLatestTurn,
      activePendingApproval,
      activePendingUserInput,
      activeThread?.error,
      activeThread?.session,
      localDispatch,
      phase,
    ],
  );
  const isSendBusy = localDispatch !== null && !serverAcknowledgedLocalDispatch;
  const isPreparingWorktree = localDispatch?.preparingWorktree ?? false;
  const hasLiveTurn = phase === "running";
  const isWorking = hasLiveTurn || isSendBusy || isConnecting || isRevertingCheckpoint;
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
  const activeTurnLayoutLive = isWorking || !latestTurnSettled;
  const [keepSettledActiveTurnLayout, setKeepSettledActiveTurnLayout] = useState(false);
  const previousActiveTurnLayoutLiveRef = useRef(activeTurnLayoutLive);
  const previousActiveTurnLayoutKeyRef = useRef<string | null>(null);
  const nowIso = new Date(nowTick).toISOString();
  const activeWorkStartedAt = hasLiveTurnTail
    ? (activeLatestTurn?.startedAt ?? localDispatch?.startedAt ?? null)
    : deriveActiveWorkStartedAt(
        activeLatestTurn,
        activeThread?.session ?? null,
        localDispatch?.startedAt ?? null,
      );
  const activeTurnLayoutKey =
    activeThreadId === null ? null : `${activeThreadId}:${activeLatestTurn?.turnId ?? "idle"}`;
  const activeTurnInProgress = activeTurnLayoutLive || keepSettledActiveTurnLayout;
  const isComposerApprovalState = activePendingApproval !== null;
  const composerFooterHasWideActions = showPlanFollowUpPrompt || activePendingProgress !== null;
  const lastSyncedPendingInputRef = useRef<{
    requestId: string | null;
    questionId: string | null;
  } | null>(null);
  useLayoutEffect(() => {
    if (previousActiveTurnLayoutKeyRef.current !== activeTurnLayoutKey) {
      previousActiveTurnLayoutKeyRef.current = activeTurnLayoutKey;
      previousActiveTurnLayoutLiveRef.current = activeTurnLayoutLive;
      setKeepSettledActiveTurnLayout(false);
      return;
    }

    const shouldStartGrace = shouldStartActiveTurnLayoutGrace({
      previousTurnLayoutLive: previousActiveTurnLayoutLiveRef.current,
      currentTurnLayoutLive: activeTurnLayoutLive,
      latestTurnStartedAt: activeLatestTurn?.startedAt ?? null,
    });
    previousActiveTurnLayoutLiveRef.current = activeTurnLayoutLive;

    if (activeTurnLayoutLive) {
      setKeepSettledActiveTurnLayout(false);
      return;
    }

    if (!shouldStartGrace) {
      return;
    }

    setKeepSettledActiveTurnLayout(true);
    const timeoutId = window.setTimeout(() => {
      setKeepSettledActiveTurnLayout(false);
    }, ACTIVE_TURN_LAYOUT_SETTLE_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeLatestTurn?.startedAt, activeTurnLayoutKey, activeTurnLayoutLive]);

  useEffect(() => {
    const nextCustomAnswer = activePendingProgress?.customAnswer;
    if (typeof nextCustomAnswer !== "string") {
      lastSyncedPendingInputRef.current = null;
      return;
    }
    const nextRequestId = activePendingUserInput?.requestId ?? null;
    const nextQuestionId = activePendingProgress?.activeQuestion?.id ?? null;
    const questionChanged =
      lastSyncedPendingInputRef.current?.requestId !== nextRequestId ||
      lastSyncedPendingInputRef.current?.questionId !== nextQuestionId;
    const textChangedExternally = promptRef.current !== nextCustomAnswer;

    lastSyncedPendingInputRef.current = {
      requestId: nextRequestId,
      questionId: nextQuestionId,
    };

    if (!questionChanged && !textChangedExternally) {
      return;
    }

    promptRef.current = nextCustomAnswer;
    const nextCursor = collapseExpandedComposerCursor(nextCustomAnswer, nextCustomAnswer.length);
    setComposerCursor(nextCursor);
    setComposerTrigger(
      detectComposerTrigger(
        nextCustomAnswer,
        expandCollapsedComposerCursor(nextCustomAnswer, nextCursor),
      ),
    );
    setComposerHighlightedItemId(null);
  }, [
    activePendingProgress?.customAnswer,
    activePendingUserInput?.requestId,
    activePendingProgress?.activeQuestion?.id,
  ]);
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
  const timelineEntries = useMemo(
    () =>
      deriveTimelineEntries(timelineMessages, activeThread?.proposedPlans ?? [], workLogEntries),
    [activeThread?.proposedPlans, timelineMessages, workLogEntries],
  );
  const { turnDiffSummaries, inferredCheckpointTurnCountByTurnId } =
    useTurnDiffSummaries(activeThread);
  const turnDiffSummaryByAssistantMessageId = useMemo(() => {
    const byMessageId = new Map<MessageId, TurnDiffSummary>();
    for (const summary of turnDiffSummaries) {
      if (!summary.assistantMessageId) continue;
      byMessageId.set(summary.assistantMessageId, summary);
    }
    return byMessageId;
  }, [turnDiffSummaries]);
  const revertTurnCountByUserMessageId = useMemo(() => {
    const byUserMessageId = new Map<MessageId, number>();
    for (let index = 0; index < timelineEntries.length; index += 1) {
      const entry = timelineEntries[index];
      if (!entry || entry.kind !== "message" || entry.message.role !== "user") {
        continue;
      }

      for (let nextIndex = index + 1; nextIndex < timelineEntries.length; nextIndex += 1) {
        const nextEntry = timelineEntries[nextIndex];
        if (!nextEntry || nextEntry.kind !== "message") {
          continue;
        }
        if (nextEntry.message.role === "user") {
          break;
        }
        const summary = turnDiffSummaryByAssistantMessageId.get(nextEntry.message.id);
        if (!summary) {
          continue;
        }
        const turnCount =
          summary.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[summary.turnId];
        if (typeof turnCount !== "number") {
          break;
        }
        byUserMessageId.set(entry.message.id, Math.max(0, turnCount - 1));
        break;
      }
    }

    return byUserMessageId;
  }, [inferredCheckpointTurnCountByTurnId, timelineEntries, turnDiffSummaryByAssistantMessageId]);

  const completionSummary = useMemo(() => {
    if (!latestTurnSettled) return null;
    if (!activeLatestTurn?.startedAt) return null;
    if (!activeLatestTurn.completedAt) return null;
    if (!latestTurnHasToolActivity) return null;

    const elapsed = formatElapsed(activeLatestTurn.startedAt, activeLatestTurn.completedAt);
    return elapsed ? `Worked for ${elapsed}` : null;
  }, [
    activeLatestTurn?.completedAt,
    activeLatestTurn?.startedAt,
    latestTurnHasToolActivity,
    latestTurnSettled,
  ]);
  const completionDividerBeforeEntryId = useMemo(() => {
    if (!latestTurnSettled) return null;
    if (!activeLatestTurn?.startedAt) return null;
    if (!activeLatestTurn.completedAt) return null;
    if (!completionSummary) return null;

    const turnStartedAt = Date.parse(activeLatestTurn.startedAt);
    const turnCompletedAt = Date.parse(activeLatestTurn.completedAt);
    if (Number.isNaN(turnStartedAt)) return null;
    if (Number.isNaN(turnCompletedAt)) return null;

    let inRangeMatch: string | null = null;
    let fallbackMatch: string | null = null;
    for (const timelineEntry of timelineEntries) {
      if (timelineEntry.kind !== "message") continue;
      if (timelineEntry.message.role !== "assistant") continue;
      const messageAt = Date.parse(timelineEntry.message.createdAt);
      if (Number.isNaN(messageAt) || messageAt < turnStartedAt) continue;
      fallbackMatch = timelineEntry.id;
      if (messageAt <= turnCompletedAt) {
        inRangeMatch = timelineEntry.id;
      }
    }
    return inRangeMatch ?? fallbackMatch;
  }, [
    activeLatestTurn?.completedAt,
    activeLatestTurn?.startedAt,
    completionSummary,
    latestTurnSettled,
    timelineEntries,
  ]);
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
  const composerTriggerKind = composerTrigger?.kind ?? null;
  const mentionTriggerQuery = composerTrigger?.kind === "mention" ? composerTrigger.query : "";
  const isMentionTrigger = composerTriggerKind === "mention";
  const skillTriggerQuery = composerTrigger?.kind === "skill" ? composerTrigger.query : "";
  const isSkillTrigger = composerTriggerKind === "skill";
  const [debouncedPathQuery, composerPathQueryDebouncer] = useDebouncedValue(
    mentionTriggerQuery,
    { wait: COMPOSER_PATH_QUERY_DEBOUNCE_MS },
    (debouncerState) => ({ isPending: debouncerState.isPending }),
  );
  const effectiveMentionQuery = mentionTriggerQuery.length > 0 ? debouncedPathQuery : "";
  const branchesQuery = useQuery(gitBranchesQueryOptions(gitBranchSourceCwd));
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const composerSkillCwd = resolveProviderDiscoveryCwd({
    activeThreadWorktreePath: resolvedThreadWorktreePath,
    activeProjectCwd: activeProject?.cwd ?? null,
    serverCwd: serverConfigQuery.data?.cwd ?? null,
  });
  const providerComposerCapabilitiesQuery = useQuery(
    providerComposerCapabilitiesQueryOptions(selectedProvider),
  );
  const providerCommandsQuery = useQuery(
    providerCommandsQueryOptions({
      provider: selectedProvider,
      cwd: composerSkillCwd,
      threadId,
      query:
        composerTriggerKind === "slash-command" || composerTriggerKind === "slash-model"
          ? (composerTrigger?.query ?? "")
          : "",
      enabled:
        (composerTriggerKind === "slash-command" || composerTriggerKind === "slash-model") &&
        supportsNativeSlashCommandDiscovery(providerComposerCapabilitiesQuery.data) &&
        composerSkillCwd !== null,
    }),
  );
  const providerSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: selectedProvider,
      cwd: composerSkillCwd,
      threadId,
      query: skillTriggerQuery,
      enabled:
        isSkillTrigger &&
        supportsSkillDiscovery(providerComposerCapabilitiesQuery.data) &&
        composerSkillCwd !== null,
    }),
  );
  const providerPluginsQuery = useQuery(
    providerPluginsQueryOptions({
      provider: selectedProvider,
      cwd: composerSkillCwd,
      threadId,
      enabled:
        supportsPluginDiscovery(providerComposerCapabilitiesQuery.data) &&
        composerSkillCwd !== null,
    }),
  );
  const workspaceEntriesQuery = useQuery(
    projectSearchEntriesQueryOptions({
      cwd: gitCwd,
      query: effectiveMentionQuery,
      enabled: isMentionTrigger,
      limit: 80,
    }),
  );
  const workspaceEntries = workspaceEntriesQuery.data?.entries ?? EMPTY_PROJECT_ENTRIES;
  const activeRootBranch = useMemo(
    () =>
      resolveComposerSlashRootBranch({
        branches: branchesQuery.data?.branches,
        activeProjectCwd: activeProject?.cwd,
        activeThreadBranch: activeThread?.branch,
      }),
    [activeProject?.cwd, activeThread?.branch, branchesQuery.data?.branches],
  );
  // Keep plugin suggestions referentially stable so prompt-sync effects do not loop on rerender.
  const providerPlugins = useMemo(
    () =>
      providerPluginsQuery.data?.marketplaces.flatMap((marketplace) =>
        marketplace.plugins.map((plugin) => ({
          plugin,
          mention: {
            name: plugin.name,
            path: `plugin://${plugin.name}@${marketplace.name}`,
          } satisfies ProviderMentionReference,
        })),
      ) ?? EMPTY_COMPOSER_PLUGIN_SUGGESTIONS,
    [providerPluginsQuery.data],
  );
  const providerNativeCommands =
    providerCommandsQuery.data?.commands ?? EMPTY_PROVIDER_NATIVE_COMMANDS;
  const providerNativeCommandNames = useMemo(
    () => providerNativeCommands.map((command) => command.name),
    [providerNativeCommands],
  );
  const effectiveComposerTrigger = useMemo(() => {
    if (
      composerTrigger?.kind === "slash-model" &&
      hasProviderNativeSlashCommand(selectedProvider, providerNativeCommandNames, "model")
    ) {
      return {
        ...composerTrigger,
        kind: "slash-command" as const,
        query: "model",
      };
    }
    return composerTrigger;
  }, [composerTrigger, providerNativeCommandNames, selectedProvider]);
  const effectiveComposerTriggerKind = effectiveComposerTrigger?.kind ?? null;
  const supportsTextNativeReviewCommand = useMemo(
    () => providerNativeCommands.some((command) => command.name.toLowerCase() === "review"),
    [providerNativeCommands],
  );
  const providerSkills = providerSkillsQuery.data?.skills ?? EMPTY_PROVIDER_SKILLS;
  const selectedModelCaps = useMemo(
    () => getModelCapabilities(selectedProvider, selectedModel),
    [selectedModel, selectedProvider],
  );
  const supportsFastSlashCommand = selectedModelCaps.supportsFastMode;
  const currentProviderModelOptions = composerModelOptions?.[selectedProvider];
  const fastModeEnabled =
    supportsFastSlashCommand &&
    (currentProviderModelOptions as { fastMode?: boolean } | undefined)?.fastMode === true;
  const composerPromptWithoutActiveSlashTrigger =
    composerTrigger?.kind === "slash-command"
      ? stripComposerTriggerText(prompt, composerTrigger)
      : prompt;
  const canOfferReviewCommand =
    (branchesQuery.data?.isRepo ?? true) &&
    canOfferReviewSlashCommand({
      prompt: composerPromptWithoutActiveSlashTrigger,
      imageCount: composerImages.length,
      terminalContextCount: composerTerminalContexts.length,
      selectedSkillCount: selectedComposerSkills.length,
      selectedMentionCount: selectedComposerMentions.length,
    });
  const canOfferForkCommand =
    isServerThread &&
    activeThread !== undefined &&
    canOfferForkSlashCommand({
      prompt: composerPromptWithoutActiveSlashTrigger,
      imageCount: composerImages.length,
      terminalContextCount: composerTerminalContexts.length,
      selectedSkillCount: selectedComposerSkills.length,
      selectedMentionCount: selectedComposerMentions.length,
      interactionMode,
    });
  const normalComposerMenuItems = useComposerCommandMenuItems({
    composerTrigger: effectiveComposerTrigger,
    provider: selectedProvider,
    providerPlugins,
    providerNativeCommands,
    providerSkills,
    workspaceEntries,
    searchableModelOptions,
    supportsFastSlashCommand,
    canOfferReviewCommand,
    canOfferForkCommand,
  });
  const composerMenuItems = useMemo(() => {
    if (composerCommandPicker === "fork-target") {
      return [
        {
          id: "fork-target:worktree",
          type: "fork-target" as const,
          target: "worktree" as const,
          label: "Fork Into New Worktree",
          description: "Continue in a new worktree",
        },
        {
          id: "fork-target:local",
          type: "fork-target" as const,
          target: "local" as const,
          label: "Fork Into Local",
          description:
            activeThread?.worktreePath || activeThread?.envMode === "worktree"
              ? "Continue in this local worktree"
              : "Continue in the current local thread",
        },
      ];
    }
    if (composerCommandPicker === "review-target") {
      return [
        {
          id: "review-target:changes",
          type: "review-target" as const,
          target: "changes" as const,
          label: "Review Uncommitted Changes",
          description: "Review local uncommitted changes",
        },
        {
          id: "review-target:base-branch",
          type: "review-target" as const,
          target: "base-branch" as const,
          label: "Review Against Base Branch",
          description: "Review the current branch diff against its base",
        },
      ];
    }

    return normalComposerMenuItems;
  }, [
    activeThread?.envMode,
    activeThread?.worktreePath,
    composerCommandPicker,
    normalComposerMenuItems,
  ]);
  const composerMenuOpen = Boolean(composerTrigger || composerCommandPicker);
  const activeComposerMenuItem = useMemo(
    () =>
      composerMenuItems.find((item) => item.id === composerHighlightedItemId) ??
      composerMenuItems[0] ??
      null,
    [composerHighlightedItemId, composerMenuItems],
  );
  const nonPersistedComposerImageIdSet = useMemo(
    () => new Set(nonPersistedComposerImageIds),
    [nonPersistedComposerImageIds],
  );
  const keybindings = serverConfigQuery.data?.keybindings ?? EMPTY_KEYBINDINGS;
  const availableEditors = serverConfigQuery.data?.availableEditors ?? EMPTY_AVAILABLE_EDITORS;
  const providerStatuses = serverConfigQuery.data?.providers ?? EMPTY_PROVIDER_STATUSES;
  const activeProviderStatus = useMemo(
    () => providerStatuses.find((status) => status.provider === selectedProvider) ?? null,
    [selectedProvider, providerStatuses],
  );
  const voiceProviderStatus = useMemo(
    () => providerStatuses.find((status) => status.provider === "codex") ?? null,
    [providerStatuses],
  );
  const refreshVoiceStatus = useCallback(() => {
    const api = readNativeApi();
    if (!api) return;
    void api.server
      .refreshProviders()
      .then((result) => {
        queryClient.setQueryData(serverQueryKeys.config(), (current) =>
          current ? { ...current, providers: result.providers } : current,
        );
      })
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Unable to refresh provider status",
          description:
            error instanceof Error ? error.message : "Unknown error refreshing provider status.",
        });
      });
  }, [queryClient, toastManager]);
  const activeProjectCwd = activeProject?.cwd ?? null;
  const activeThreadWorktreePath = activeThread?.worktreePath ?? null;
  const hasNativeUserMessages = useMemo(
    () =>
      activeThread?.messages.some(
        (message) => message.role === "user" && message.source === "native",
      ) ?? false,
    [activeThread?.messages],
  );
  const threadTerminalRuntimeEnv = useMemo(() => {
    if (!activeProjectCwd) return {};
    return projectScriptRuntimeEnv({
      project: {
        cwd: activeProjectCwd,
      },
      worktreePath: activeThreadWorktreePath,
    });
  }, [activeProjectCwd, activeThreadWorktreePath]);
  // Default true while loading to avoid toolbar flicker.
  const isGitRepo = branchesQuery.data?.isRepo ?? true;
  const onToggleDiff = useCallback(() => {
    if (diffEnvironmentPending && !diffOpen) {
      return;
    }
    if (onToggleDiffPanel) {
      onToggleDiffPanel();
      return;
    }
    void navigate({
      to: "/$threadId",
      params: { threadId },
      replace: true,
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return diffOpen
          ? { ...rest, panel: undefined, diff: undefined }
          : { ...rest, panel: "diff", diff: "1" };
      },
    });
  }, [diffEnvironmentPending, diffOpen, navigate, onToggleDiffPanel, threadId]);
  const onToggleBrowser = useCallback(() => {
    if (onToggleBrowserPanel) {
      onToggleBrowserPanel();
      return;
    }
    void navigate({
      to: "/$threadId",
      params: { threadId },
      replace: true,
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return browserOpen ? { ...rest, panel: undefined } : { ...rest, panel: "browser" };
      },
    });
  }, [browserOpen, navigate, onToggleBrowserPanel, threadId]);

  const envLocked = Boolean(
    activeThread &&
    (activeThread.messages.length > 0 ||
      (activeThread.session !== null && activeThread.session.status !== "closed")),
  );
  const setThreadError = useCallback(
    (targetThreadId: ThreadId | null, error: string | null) => {
      if (!targetThreadId) return;
      if (useStore.getState().threads.some((thread) => thread.id === targetThreadId)) {
        setStoreThreadError(targetThreadId, error);
        return;
      }
      setLocalDraftErrorsByThreadId((existing) => {
        if ((existing[targetThreadId] ?? null) === error) {
          return existing;
        }
        return {
          ...existing,
          [targetThreadId]: error,
        };
      });
    },
    [setStoreThreadError],
  );

  const focusComposer = useCallback(() => {
    composerEditorRef.current?.focusAtEnd();
  }, []);
  const scheduleComposerFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      focusComposer();
    });
  }, [focusComposer]);
  const appendVoiceTranscriptToComposer = useCallback(
    (transcript: string) => {
      const nextPrompt = appendVoiceTranscriptToPrompt(promptRef.current, transcript);
      if (!nextPrompt) {
        return;
      }

      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      setComposerCursor(collapseExpandedComposerCursor(nextPrompt, nextPrompt.length));
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      scheduleComposerFocus();
    },
    [scheduleComposerFocus, setPrompt],
  );
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
  const stopActiveThreadSession = useCallback(async () => {
    const api = readNativeApi();
    if (
      !api ||
      !isServerThread ||
      !activeThread ||
      activeThread.session === null ||
      activeThread.session.status === "closed"
    ) {
      return;
    }

    await api.orchestration.dispatchCommand({
      type: "thread.session.stop",
      commandId: newCommandId(),
      threadId: activeThread.id,
      createdAt: new Date().toISOString(),
    });
  }, [activeThread, isServerThread]);
  const {
    handoffBusy,
    worktreeHandoffDialogOpen,
    setWorktreeHandoffDialogOpen,
    worktreeHandoffName,
    setWorktreeHandoffName,
    onHandoffToWorktree,
    onHandoffToLocal,
    confirmWorktreeHandoff,
  } = useThreadWorkspaceHandoff({
    activeProject,
    activeThread,
    activeRootBranch,
    activeThreadAssociatedWorktree,
    isServerThread,
    stopActiveThreadSession,
    runProjectScript,
    setStoreThreadWorkspace,
    syncServerReadModel,
  });
  // Scroll behavior is isolated in a dedicated controller so the renderer tree only wires events.
  const messageCount = timelineEntries.length;
  const {
    messagesScrollElement,
    showScrollToBottom,
    setMessagesBottomAnchorRef,
    setMessagesScrollContainerRef,
    forceStickToBottom,
    onTimelineHeightChange,
    onComposerHeightChange,
    onMessagesClickCapture,
    onMessagesPointerCancel,
    onMessagesPointerDown,
    onMessagesPointerUp,
    onMessagesScroll,
    onMessagesTouchEnd,
    onMessagesTouchMove,
    onMessagesTouchStart,
    onMessagesWheel,
  } = useChatAutoScrollController({
    threadId: activeThread?.id ?? null,
    isStreaming: isWorking,
    messageCount,
  });

  useLayoutEffect(() => {
    const composerForm = composerFormRef.current;
    if (!composerForm) return;
    const measureComposerFormWidth = () => composerForm.clientWidth;

    composerFormHeightRef.current = composerForm.getBoundingClientRect().height;
    setIsComposerFooterCompact(
      shouldUseCompactComposerFooter(measureComposerFormWidth(), {
        hasWideActions: composerFooterHasWideActions,
      }),
    );
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;

      const nextCompact = shouldUseCompactComposerFooter(measureComposerFormWidth(), {
        hasWideActions: composerFooterHasWideActions,
      });
      setIsComposerFooterCompact((previous) => (previous === nextCompact ? previous : nextCompact));

      const nextHeight = entry.contentRect.height;
      const previousHeight = composerFormHeightRef.current;
      composerFormHeightRef.current = nextHeight;

      onComposerHeightChange(previousHeight, nextHeight);
    });

    observer.observe(composerForm);
    return () => {
      observer.disconnect();
    };
  }, [activeThread?.id, composerFooterHasWideActions, onComposerHeightChange]);

  useEffect(() => {
    setExpandedWorkGroups({});
  }, [activeThread?.id]);

  useEffect(() => {
    if (!composerMenuOpen) {
      setComposerHighlightedItemId(null);
      return;
    }
    setComposerHighlightedItemId((existing) =>
      existing && composerMenuItems.some((item) => item.id === existing)
        ? existing
        : (composerMenuItems[0]?.id ?? null),
    );
  }, [composerMenuItems, composerMenuOpen]);

  useEffect(() => {
    setIsRevertingCheckpoint(false);
  }, [activeThread?.id]);

  useEffect(() => {
    if (!activeThread?.id || terminalState.terminalOpen) return;
    const frame = window.requestAnimationFrame(() => {
      focusComposer();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeThread?.id, focusComposer, terminalState.terminalOpen]);

  useEffect(() => {
    composerImagesRef.current = composerImages;
  }, [composerImages]);

  useEffect(() => {
    composerTerminalContextsRef.current = composerTerminalContexts;
  }, [composerTerminalContexts]);

  useEffect(() => {
    queuedComposerTurnsRef.current = queuedComposerTurns;
  }, [queuedComposerTurns]);

  useEffect(() => {
    autoDispatchingQueuedTurnRef.current = false;
  }, [threadId]);

  useEffect(() => {
    promptRef.current = prompt;
    setComposerCursor((existing) => clampCollapsedComposerCursor(prompt, existing));
  }, [prompt]);

  useEffect(() => {
    setSelectedComposerSkills((existing) =>
      existing.filter((skill) => promptIncludesSkillMention(prompt, skill.name, selectedProvider)),
    );
  }, [prompt, selectedProvider]);

  useEffect(() => {
    setSelectedComposerMentions((existing) => {
      const nextMentions = resolvePromptPluginMentions({
        prompt,
        existingMentions: existing,
        providerPlugins,
      });
      return providerMentionReferencesEqual(existing, nextMentions) ? existing : nextMentions;
    });
  }, [prompt, providerPlugins]);

  // Clear selected skills when switching providers — skills are provider-specific.
  useEffect(() => {
    setSelectedComposerSkills([]);
    setSelectedComposerMentions([]);
  }, [selectedProvider]);

  useEffect(() => {
    if (!composerMenuOpen) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setComposerCommandPicker(null);
      setComposerHighlightedItemId(null);
      setComposerTrigger(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composerMenuOpen]);

  const activeWorktreePath = activeThread?.worktreePath;
  const envMode: DraftThreadEnvMode = isServerThread
    ? resolveThreadEnvironmentMode({
        envMode: activeThread?.envMode,
        worktreePath: activeWorktreePath ?? null,
      })
    : (draftThread?.envMode ?? "local");
  const envState = resolveThreadWorkspaceState({
    envMode: resolvedThreadEnvMode,
    worktreePath: resolvedThreadWorktreePath,
  });

  useEffect(() => {
    if (!isWorking) return;
    setNowTick(Date.now());
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isWorking]);

  const clearComposerInput = useCallback(
    (threadId: ThreadId) => {
      promptRef.current = "";
      clearComposerDraftContent(threadId);
      setSelectedComposerSkills([]);
      setSelectedComposerMentions([]);
      setComposerHighlightedItemId(null);
      setComposerCursor(0);
      setComposerTrigger(null);
    },
    [clearComposerDraftContent],
  );

  const restoreFailedComposerSendDraft = useCallback(
    ({
      prompt,
      images,
      terminalContexts,
      skills,
      mentions,
    }: {
      prompt: string;
      images: ComposerImageAttachment[];
      terminalContexts: TerminalContextDraft[];
      skills: ProviderSkillReference[];
      mentions: ProviderMentionReference[];
    }) => {
      promptRef.current = prompt;
      setPrompt(prompt);
      setComposerCursor(collapseExpandedComposerCursor(prompt, prompt.length));
      if (images.length > 0) {
        addComposerImagesToDraft(images);
      }
      if (terminalContexts.length > 0) {
        addComposerTerminalContextsToDraft(terminalContexts);
      }
      setSelectedComposerSkills(skills);
      setSelectedComposerMentions(mentions);
      setComposerTrigger(detectComposerTrigger(prompt, prompt.length));
    },
    [
      addComposerImagesToDraft,
      addComposerTerminalContextsToDraft,
      setPrompt,
      setSelectedComposerMentions,
      setSelectedComposerSkills,
    ],
  );

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
  const terminalDrawerProps = useMemo(
    () => ({
      threadId,
      cwd: gitCwd ?? activeProject?.cwd ?? "",
      runtimeEnv: threadTerminalRuntimeEnv,
      height: terminalState.terminalHeight,
      terminalIds: terminalState.terminalIds,
      terminalLabelsById: terminalState.terminalLabelsById,
      terminalTitleOverridesById: terminalState.terminalTitleOverridesById,
      terminalCliKindsById: terminalState.terminalCliKindsById,
      terminalAttentionStatesById: terminalState.terminalAttentionStatesById ?? {},
      runningTerminalIds: terminalState.runningTerminalIds,
      activeTerminalId: terminalState.activeTerminalId,
      terminalGroups: terminalState.terminalGroups,
      activeTerminalGroupId: terminalState.activeTerminalGroupId,
      focusRequestId: terminalFocusRequestId,
      onSplitTerminal: splitTerminalRight,
      onSplitTerminalDown: splitTerminalDown,
      onNewTerminal: createNewTerminal,
      onNewTerminalTab: createNewTerminalTab,
      onMoveTerminalToGroup: moveTerminalToNewGroup,
      splitShortcutLabel: splitTerminalShortcutLabel ?? undefined,
      splitDownShortcutLabel: splitTerminalDownShortcutLabel ?? undefined,
      newShortcutLabel: newTerminalShortcutLabel ?? undefined,
      closeShortcutLabel: closeTerminalShortcutLabel ?? undefined,
      workspaceCloseShortcutLabel: closeWorkspaceShortcutLabel ?? undefined,
      onActiveTerminalChange: activateTerminal,
      onCloseTerminal: closeTerminal,
      onCloseTerminalGroup: closeTerminalGroup,
      onHeightChange: setTerminalHeight,
      onResizeTerminalSplit: resizeTerminalSplit,
      onTerminalMetadataChange: setTerminalMetadata,
      onTerminalActivityChange: setTerminalActivity,
      onAddTerminalContext: addTerminalContextToDraft,
    }),
    [
      activeProject?.cwd,
      activateTerminal,
      addTerminalContextToDraft,
      closeTerminal,
      closeTerminalShortcutLabel,
      closeWorkspaceShortcutLabel,
      createNewTerminal,
      createNewTerminalTab,
      moveTerminalToNewGroup,
      gitCwd,
      newTerminalShortcutLabel,
      closeTerminalGroup,
      resizeTerminalSplit,
      setTerminalActivity,
      setTerminalHeight,
      setTerminalMetadata,
      splitTerminalRight,
      splitTerminalDown,
      splitTerminalShortcutLabel,
      splitTerminalDownShortcutLabel,
      terminalFocusRequestId,
      terminalState.activeTerminalGroupId,
      terminalState.activeTerminalId,
      terminalState.terminalAttentionStatesById,
      terminalState.terminalCliKindsById,
      terminalState.terminalGroups,
      terminalState.terminalHeight,
      terminalState.terminalIds,
      terminalState.terminalLabelsById,
      terminalState.terminalTitleOverridesById,
      terminalState.runningTerminalIds,
      threadId,
      threadTerminalRuntimeEnv,
    ],
  );

  const onRevertToTurnCount = useCallback(
    async (turnCount: number) => {
      const api = readNativeApi();
      if (!api || !activeThread || isRevertingCheckpoint) return;

      if (hasLiveTurn || isSendBusy || isConnecting) {
        setThreadError(activeThread.id, "Interrupt the current turn before reverting checkpoints.");
        return;
      }
      const confirmed = await api.dialogs.confirm(
        [
          `Revert this thread to checkpoint ${turnCount}?`,
          "This will discard newer messages and turn diffs in this thread.",
          "This action cannot be undone.",
        ].join("\n"),
      );
      if (!confirmed) {
        return;
      }

      setIsRevertingCheckpoint(true);
      setThreadError(activeThread.id, null);
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.checkpoint.revert",
          commandId: newCommandId(),
          threadId: activeThread.id,
          turnCount,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        setThreadError(
          activeThread.id,
          err instanceof Error ? err.message : "Failed to revert thread state.",
        );
      }
      setIsRevertingCheckpoint(false);
    },
    [activeThread, hasLiveTurn, isConnecting, isRevertingCheckpoint, isSendBusy, setThreadError],
  );

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
  const applyPromptReplacement = useCallback(
    (
      rangeStart: number,
      rangeEnd: number,
      replacement: string,
      options?: { expectedText?: string; cursorOffset?: number },
    ): number | false => {
      const currentText = promptRef.current;
      const safeStart = Math.max(0, Math.min(currentText.length, rangeStart));
      const safeEnd = Math.max(safeStart, Math.min(currentText.length, rangeEnd));
      if (
        options?.expectedText !== undefined &&
        currentText.slice(safeStart, safeEnd) !== options.expectedText
      ) {
        return false;
      }
      const next = replaceTextRange(promptRef.current, rangeStart, rangeEnd, replacement);
      let nextCursor = collapseExpandedComposerCursor(next.text, next.cursor);
      // Apply cursor offset if specified (e.g., -1 to position inside parentheses)
      if (options?.cursorOffset !== undefined) {
        nextCursor = Math.max(0, nextCursor + options.cursorOffset);
      }
      promptRef.current = next.text;
      const activePendingQuestion = activePendingProgress?.activeQuestion;
      if (activePendingQuestion && activePendingUserInput) {
        setActivePendingUserInputCustomAnswerValue(activePendingQuestion.id, next.text);
      } else {
        setPrompt(next.text);
      }
      setComposerCursor(nextCursor);
      setComposerTrigger(
        detectComposerTrigger(next.text, expandCollapsedComposerCursor(next.text, nextCursor)),
      );
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCursor);
      });
      return nextCursor;
    },
    [
      activePendingProgress?.activeQuestion,
      activePendingUserInput,
      setActivePendingUserInputCustomAnswerValue,
      setPrompt,
    ],
  );

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

  const isComposerMenuLoading =
    (composerTriggerKind === "mention" &&
      ((mentionTriggerQuery.length > 0 && composerPathQueryDebouncer.state.isPending) ||
        workspaceEntriesQuery.isLoading ||
        workspaceEntriesQuery.isFetching ||
        providerPluginsQuery.isLoading ||
        providerPluginsQuery.isFetching)) ||
    (composerTriggerKind === "slash-command" &&
      (providerCommandsQuery.isLoading || providerCommandsQuery.isFetching));
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
  const dismissActiveThreadError = useCallback(() => {
    if (!activeThread) return;
    setThreadError(activeThread.id, null);
  }, [activeThread, setThreadError]);
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

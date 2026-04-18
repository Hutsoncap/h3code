import {
  type ApprovalRequestId,
  DEFAULT_MODEL_BY_PROVIDER,
  type ClaudeCodeEffort,
  type MessageId,
  type ModelSelection,
  type ProjectScript,
  type ProviderKind,
  type ProjectEntry,
  type ProviderMentionReference,
  type ProviderNativeCommandDescriptor,
  type ProviderPluginDescriptor,
  type ProviderSkillDescriptor,
  type ProviderSkillReference,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_SEND_TURN_MAX_ATTACHMENTS,
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
import { GoTasklist } from "react-icons/go";
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
import { proposedPlanTitle, resolvePlanFollowUpSubmission } from "../proposedPlan";
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
import BranchToolbar from "./BranchToolbar";
import { resolveShortcutCommand, shortcutLabelForCommand } from "../keybindings";
import PlanSidebar from "./PlanSidebar";
import ThreadTerminalDrawer from "./ThreadTerminalDrawer";
import { ChevronDownIcon } from "~/lib/icons";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./ui/menu";
import { cn, isMacPlatform, randomUUID } from "~/lib/utils";
import { toastManager } from "./ui/toast";
import { projectScriptRuntimeEnv, projectScriptIdFromCommand } from "~/projectScripts";
import { newCommandId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import {
  getCustomModelOptionsByProvider,
  getCustomModelsByProvider,
  getProviderStartOptions,
  useAppSettings,
} from "../appSettings";
import { isTerminalFocused } from "../lib/terminalFocus";
import {
  type ComposerImageAttachment,
  type DraftThreadEnvMode,
  type PersistedComposerImageAttachment,
  type QueuedComposerChatTurn,
  type QueuedComposerTurn,
  useComposerDraftStore,
  useEffectiveComposerModelState,
} from "../composerDraftStore";
import {
  formatTerminalContextLabel,
  insertInlineTerminalContextPlaceholder,
  removeInlineTerminalContextPlaceholder,
  type TerminalContextDraft,
  type TerminalContextSelection,
} from "../lib/terminalContext";
import { deriveLatestContextWindowSnapshot, deriveCumulativeCostUsd } from "../lib/contextWindow";
import { shouldUseCompactComposerFooter } from "./composerFooterLayout";
import {
  resolveSplitViewFocusedThreadId,
  selectSplitView,
  type SplitViewPanePanelState,
  useSplitViewStore,
} from "../splitViewStore";
import { ComposerPromptEditor, type ComposerPromptEditorHandle } from "./ComposerPromptEditor";
import { ExpandedImagePreview } from "./chat/ExpandedImagePreview";
import { AVAILABLE_PROVIDER_OPTIONS, ProviderModelPicker } from "./chat/ProviderModelPicker";
import { ComposerCommandItem, ComposerCommandMenu } from "./chat/ComposerCommandMenu";
import { ComposerPendingApprovalActions } from "./chat/ComposerPendingApprovalActions";
import { ComposerExtrasMenu } from "./chat/ComposerExtrasMenu";
import { ComposerVoiceButton } from "./chat/ComposerVoiceButton";
import { ComposerVoiceRecorderBar } from "./chat/ComposerVoiceRecorderBar";
import { ChatEmptyThreadState } from "./chat/ChatEmptyThreadState";
import { ChatExpandedImageDialog } from "./chat/ChatExpandedImageDialog";
import { ComposerImageAttachmentChip } from "./chat/ComposerImageAttachmentChip";
import { ChatComposerFooter } from "./chat/ChatComposerFooter";
import { ChatActivePlanCard } from "./chat/ChatActivePlanCard";
import { ChatComposerStatusBanner } from "./chat/ChatComposerStatusBanner";
import { ChatPullRequestDialog } from "./chat/ChatPullRequestDialog";
import { ChatViewDialogs } from "./chat/ChatViewDialogs";
import { ChatViewShell } from "./chat/ChatViewShell";
import { useChatComposerDraftBindings } from "./chat/useChatComposerDraftBindings";
import { useChatComposerModelBindings } from "./chat/useChatComposerModelBindings";
import { useComposerVoiceController } from "./chat/useComposerVoiceController";
import { useChatEnvModeBindings } from "./chat/useChatEnvModeBindings";
import { useChatTerminalActionBindings } from "./chat/useChatTerminalActionBindings";
import { useChatTerminalBindings } from "./chat/useChatTerminalBindings";
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
  buildExpiredTerminalContextToastCopy,
  buildLocalDraftThread,
  cloneComposerImageForRetry,
  collectUserMessageBlobPreviewUrls,
  deriveComposerSendState,
  hasServerAcknowledgedLocalDispatch,
  LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
  LastInvokedScriptByProjectSchema,
  type LocalDispatchSnapshot,
  readFileAsDataUrl,
  revokeBlobPreviewUrl,
  revokeUserMessagePreviewUrls,
} from "./ChatView.logic";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useComposerSlashCommands } from "../hooks/useComposerSlashCommands";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import {
  canCreateThreadHandoff,
  resolveHandoffTargetProvider,
  resolveThreadHandoffBadgeLabel,
} from "../lib/threadHandoff";
import {
  resolveDiffEnvironmentState,
  resolveThreadEnvironmentMode,
} from "../lib/threadEnvironment";

const ATTACHMENT_PREVIEW_HANDOFF_TTL_MS = 5000;
const IMAGE_SIZE_LIMIT_LABEL = `${Math.round(PROVIDER_SEND_TURN_MAX_IMAGE_BYTES / (1024 * 1024))}MB`;
const EMPTY_ACTIVITIES: OrchestrationThreadActivity[] = [];
const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const EMPTY_PROJECT_ENTRIES: ProjectEntry[] = [];
const EMPTY_PROVIDER_NATIVE_COMMANDS: ProviderNativeCommandDescriptor[] = [];
const EMPTY_PROVIDER_SKILLS: ProviderSkillDescriptor[] = [];
function eventTargetsComposer(
  event: globalThis.KeyboardEvent,
  composerForm: HTMLFormElement | null,
): boolean {
  if (!composerForm) return false;
  const target = event.target;
  return target instanceof Node ? composerForm.contains(target) : false;
}
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

function buildQueuedComposerPreviewText(input: {
  trimmedPrompt: string;
  images: ReadonlyArray<ComposerImageAttachment>;
  terminalContexts: ReadonlyArray<TerminalContextDraft>;
}): string {
  if (input.trimmedPrompt.length > 0) {
    return input.trimmedPrompt;
  }
  const firstImage = input.images[0];
  if (firstImage) {
    return `Image: ${firstImage.name}`;
  }
  const firstTerminalContext = input.terminalContexts[0];
  if (firstTerminalContext) {
    return formatTerminalContextLabel(firstTerminalContext);
  }
  return "Queued follow-up";
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

const extendReplacementRangeForTrailingSpace = (
  text: string,
  rangeEnd: number,
  replacement: string,
): number => {
  if (!replacement.endsWith(" ")) {
    return rangeEnd;
  }
  return text[rangeEnd] === " " ? rangeEnd + 1 : rangeEnd;
};

const syncTerminalContextsByIds = (
  contexts: ReadonlyArray<TerminalContextDraft>,
  ids: ReadonlyArray<string>,
): TerminalContextDraft[] => {
  const contextsById = new Map(contexts.map((context) => [context.id, context]));
  return ids.flatMap((id) => {
    const context = contextsById.get(id);
    return context ? [context] : [];
  });
};

const terminalContextIdListsEqual = (
  contexts: ReadonlyArray<TerminalContextDraft>,
  ids: ReadonlyArray<string>,
): boolean =>
  contexts.length === ids.length && contexts.every((context, index) => context.id === ids[index]);

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
  const [isDragOverComposer, setIsDragOverComposer] = useState(false);
  const [expandedImage, setExpandedImage] = useState<ExpandedImagePreview | null>(null);
  const [optimisticUserMessages, setOptimisticUserMessages] = useState<ChatMessage[]>([]);
  const optimisticUserMessagesRef = useRef(optimisticUserMessages);
  optimisticUserMessagesRef.current = optimisticUserMessages;
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
  const [planSidebarOpen, setPlanSidebarOpen] = useState(false);
  const [isComposerFooterCompact, setIsComposerFooterCompact] = useState(false);
  const [composerCommandPicker, setComposerCommandPicker] = useState<
    null | "fork-target" | "review-target"
  >(null);
  // Tracks whether the user explicitly dismissed the sidebar for the active turn.
  const planSidebarDismissedForTurnRef = useRef<string | null>(null);
  // When set, the thread-change reset effect will open the sidebar instead of closing it.
  // Used by "Implement in a new thread" to carry the sidebar-open intent across navigation.
  const planSidebarOpenOnNextThreadRef = useRef(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [composerHighlightedItemId, setComposerHighlightedItemId] = useState<string | null>(null);
  const [attachmentPreviewHandoffByMessageId, setAttachmentPreviewHandoffByMessageId] = useState<
    Record<string, string[]>
  >({});
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
  useEffect(() => {
    // Thread-bound handoff dialog state is reset by the dedicated hook.
  }, [threadId]);
  const composerEditorRef = useRef<ComposerPromptEditorHandle>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const composerFormHeightRef = useRef(0);
  const composerImagesRef = useRef<ComposerImageAttachment[]>([]);
  const composerSelectLockRef = useRef(false);
  const composerMenuOpenRef = useRef(false);
  const composerMenuItemsRef = useRef<ComposerCommandItem[]>([]);
  const queuedComposerTurnsRef = useRef<QueuedComposerTurn[]>([]);
  const autoDispatchingQueuedTurnRef = useRef(false);
  const activeComposerMenuItemRef = useRef<ComposerCommandItem | null>(null);
  const attachmentPreviewHandoffByMessageIdRef = useRef<Record<string, string[]>>({});
  const attachmentPreviewHandoffTimeoutByMessageIdRef = useRef<Record<string, number>>({});
  const sendInFlightRef = useRef(false);
  const dragDepthRef = useRef(0);
  const terminalOpenByThreadRef = useRef<Record<string, boolean>>({});
  const activatedThreadIdRef = useRef<ThreadId | null>(null);

  const removeComposerTerminalContextFromDraft = useCallback(
    (contextId: string) => {
      const contextIndex = composerTerminalContexts.findIndex(
        (context) => context.id === contextId,
      );
      if (contextIndex < 0) {
        return;
      }
      const nextPrompt = removeInlineTerminalContextPlaceholder(promptRef.current, contextIndex);
      promptRef.current = nextPrompt.prompt;
      setPrompt(nextPrompt.prompt);
      removeComposerDraftTerminalContext(threadId, contextId);
      setComposerCursor(nextPrompt.cursor);
      setComposerTrigger(
        detectComposerTrigger(
          nextPrompt.prompt,
          expandCollapsedComposerCursor(nextPrompt.prompt, nextPrompt.cursor),
        ),
      );
    },
    [composerTerminalContexts, removeComposerDraftTerminalContext, setPrompt, threadId],
  );

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
  const handoffBadgeLabel = useMemo(
    () => (activeThread ? resolveThreadHandoffBadgeLabel(activeThread) : null),
    [activeThread],
  );
  const handoffBadgeSourceProvider = activeThread?.handoff?.sourceProvider ?? null;
  const handoffBadgeTargetProvider = activeThread?.handoff
    ? activeThread.modelSelection.provider
    : null;
  const handoffTargetProvider = useMemo(
    () =>
      activeThread ? resolveHandoffTargetProvider(activeThread.modelSelection.provider) : null,
    [activeThread],
  );
  const handoffActionLabel = useMemo(() => {
    if (!activeThread) {
      return "Create handoff thread";
    }
    return `Handoff to ${PROVIDER_DISPLAY_NAMES[handoffTargetProvider ?? "codex"]}`;
  }, [activeThread, handoffTargetProvider]);
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
  const handoffDisabled = !(
    activeThread &&
    activeProject &&
    isServerThread &&
    canCreateThreadHandoff({
      thread: activeThread,
      isBusy: isWorking,
      hasPendingApprovals: pendingApprovals.length > 0,
      hasPendingUserInput: pendingUserInputs.length > 0,
    })
  );
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
  useEffect(() => {
    attachmentPreviewHandoffByMessageIdRef.current = attachmentPreviewHandoffByMessageId;
  }, [attachmentPreviewHandoffByMessageId]);
  const clearAttachmentPreviewHandoffs = useCallback(() => {
    for (const timeoutId of Object.values(attachmentPreviewHandoffTimeoutByMessageIdRef.current)) {
      window.clearTimeout(timeoutId);
    }
    attachmentPreviewHandoffTimeoutByMessageIdRef.current = {};
    for (const previewUrls of Object.values(attachmentPreviewHandoffByMessageIdRef.current)) {
      for (const previewUrl of previewUrls) {
        revokeBlobPreviewUrl(previewUrl);
      }
    }
    attachmentPreviewHandoffByMessageIdRef.current = {};
    setAttachmentPreviewHandoffByMessageId({});
  }, []);
  useEffect(() => {
    return () => {
      clearAttachmentPreviewHandoffs();
      for (const message of optimisticUserMessagesRef.current) {
        revokeUserMessagePreviewUrls(message);
      }
    };
  }, [clearAttachmentPreviewHandoffs]);
  const handoffAttachmentPreviews = useCallback((messageId: MessageId, previewUrls: string[]) => {
    if (previewUrls.length === 0) return;

    const previousPreviewUrls = attachmentPreviewHandoffByMessageIdRef.current[messageId] ?? [];
    for (const previewUrl of previousPreviewUrls) {
      if (!previewUrls.includes(previewUrl)) {
        revokeBlobPreviewUrl(previewUrl);
      }
    }
    setAttachmentPreviewHandoffByMessageId((existing) => {
      const next = {
        ...existing,
        [messageId]: previewUrls,
      };
      attachmentPreviewHandoffByMessageIdRef.current = next;
      return next;
    });

    const existingTimeout = attachmentPreviewHandoffTimeoutByMessageIdRef.current[messageId];
    if (typeof existingTimeout === "number") {
      window.clearTimeout(existingTimeout);
    }
    attachmentPreviewHandoffTimeoutByMessageIdRef.current[messageId] = window.setTimeout(() => {
      const currentPreviewUrls = attachmentPreviewHandoffByMessageIdRef.current[messageId];
      if (currentPreviewUrls) {
        for (const previewUrl of currentPreviewUrls) {
          revokeBlobPreviewUrl(previewUrl);
        }
      }
      setAttachmentPreviewHandoffByMessageId((existing) => {
        if (!(messageId in existing)) return existing;
        const next = { ...existing };
        delete next[messageId];
        attachmentPreviewHandoffByMessageIdRef.current = next;
        return next;
      });
      delete attachmentPreviewHandoffTimeoutByMessageIdRef.current[messageId];
    }, ATTACHMENT_PREVIEW_HANDOFF_TTL_MS);
  }, []);
  const serverMessages = activeThread?.messages;
  const timelineMessages = useMemo(() => {
    const messages = serverMessages ?? [];
    const serverMessagesWithPreviewHandoff =
      Object.keys(attachmentPreviewHandoffByMessageId).length === 0
        ? messages
        : // Spread only fires for the few messages that actually changed;
          // unchanged ones early-return their original reference.
          // In-place mutation would break React's immutable state contract.
          // oxlint-disable-next-line no-map-spread
          messages.map((message) => {
            if (
              message.role !== "user" ||
              !message.attachments ||
              message.attachments.length === 0
            ) {
              return message;
            }
            const handoffPreviewUrls = attachmentPreviewHandoffByMessageId[message.id];
            if (!handoffPreviewUrls || handoffPreviewUrls.length === 0) {
              return message;
            }

            let changed = false;
            let imageIndex = 0;
            const attachments = message.attachments.map((attachment) => {
              if (attachment.type !== "image") {
                return attachment;
              }
              const handoffPreviewUrl = handoffPreviewUrls[imageIndex];
              imageIndex += 1;
              if (!handoffPreviewUrl || attachment.previewUrl === handoffPreviewUrl) {
                return attachment;
              }
              changed = true;
              return {
                ...attachment,
                previewUrl: handoffPreviewUrl,
              };
            });

            return changed ? { ...message, attachments } : message;
          });

    if (optimisticUserMessages.length === 0) {
      return serverMessagesWithPreviewHandoff;
    }
    const serverIds = new Set(serverMessagesWithPreviewHandoff.map((message) => message.id));
    const pendingMessages = optimisticUserMessages.filter((message) => !serverIds.has(message.id));
    if (pendingMessages.length === 0) {
      return serverMessagesWithPreviewHandoff;
    }
    return [...serverMessagesWithPreviewHandoff, ...pendingMessages];
  }, [serverMessages, attachmentPreviewHandoffByMessageId, optimisticUserMessages]);
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
  composerMenuOpenRef.current = composerMenuOpen;
  composerMenuItemsRef.current = composerMenuItems;
  activeComposerMenuItemRef.current = activeComposerMenuItem;
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
  const terminalToggleShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.toggle"),
    [keybindings],
  );
  const splitTerminalShortcutLabel = useMemo(
    () =>
      shortcutLabelForCommand(keybindings, "terminal.splitRight") ??
      shortcutLabelForCommand(keybindings, "terminal.split"),
    [keybindings],
  );
  const splitTerminalDownShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.splitDown"),
    [keybindings],
  );
  const newTerminalShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.new"),
    [keybindings],
  );
  const closeTerminalShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.close"),
    [keybindings],
  );
  const closeWorkspaceShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.workspace.closeActive"),
    [keybindings],
  );
  const diffPanelShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "diff.toggle"),
    [keybindings],
  );
  const browserPanelShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "browser.toggle"),
    [keybindings],
  );
  const chatSplitShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "chat.split"),
    [keybindings],
  );
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
  const addTerminalContextToDraft = useCallback(
    (selection: TerminalContextSelection) => {
      if (!activeThread) {
        return;
      }
      const snapshot = composerEditorRef.current?.readSnapshot() ?? {
        value: promptRef.current,
        cursor: composerCursor,
        expandedCursor: expandCollapsedComposerCursor(promptRef.current, composerCursor),
        terminalContextIds: composerTerminalContexts.map((context) => context.id),
      };
      const insertion = insertInlineTerminalContextPlaceholder(
        snapshot.value,
        snapshot.expandedCursor,
      );
      const nextCollapsedCursor = collapseExpandedComposerCursor(
        insertion.prompt,
        insertion.cursor,
      );
      const inserted = insertComposerDraftTerminalContext(
        activeThread.id,
        insertion.prompt,
        {
          id: randomUUID(),
          threadId: activeThread.id,
          createdAt: new Date().toISOString(),
          ...selection,
        },
        insertion.contextIndex,
      );
      if (!inserted) {
        return;
      }
      promptRef.current = insertion.prompt;
      setComposerCursor(nextCollapsedCursor);
      setComposerTrigger(detectComposerTrigger(insertion.prompt, insertion.cursor));
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCollapsedCursor);
      });
    },
    [activeThread, composerCursor, composerTerminalContexts, insertComposerDraftTerminalContext],
  );
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
  // Desktop accelerators like Cmd+T can be claimed by Electron before the page sees keydown.
  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function" || !isFocusedPane) {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      if (action !== "new-terminal-tab") return;
      createTerminalFromShortcut();
    });

    return () => {
      unsubscribe?.();
    };
  }, [createTerminalFromShortcut, isFocusedPane]);
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
    if (planSidebarOpenOnNextThreadRef.current) {
      planSidebarOpenOnNextThreadRef.current = false;
      setPlanSidebarOpen(true);
    } else {
      setPlanSidebarOpen(false);
    }
    planSidebarDismissedForTurnRef.current = null;
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
    if (!activeThread?.id) return;
    if (activeThread.messages.length === 0) {
      return;
    }
    const serverIds = new Set(activeThread.messages.map((message) => message.id));
    const removedMessages = optimisticUserMessages.filter((message) => serverIds.has(message.id));
    if (removedMessages.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setOptimisticUserMessages((existing) =>
        existing.filter((message) => !serverIds.has(message.id)),
      );
    }, 0);
    for (const removedMessage of removedMessages) {
      const previewUrls = collectUserMessageBlobPreviewUrls(removedMessage);
      if (previewUrls.length > 0) {
        handoffAttachmentPreviews(removedMessage.id, previewUrls);
        continue;
      }
      revokeUserMessagePreviewUrls(removedMessage);
    }
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeThread?.id, activeThread?.messages, handoffAttachmentPreviews, optimisticUserMessages]);

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
    dragDepthRef.current = 0;
    setIsDragOverComposer(false);
    setExpandedImage(null);
  }, [threadId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (composerImages.length === 0) {
        clearComposerDraftPersistedAttachments(threadId);
        return;
      }
      const getPersistedAttachmentsForThread = () =>
        useComposerDraftStore.getState().draftsByThreadId[threadId]?.persistedAttachments ?? [];
      try {
        const currentPersistedAttachments = getPersistedAttachmentsForThread();
        const existingPersistedById = new Map(
          currentPersistedAttachments.map((attachment) => [attachment.id, attachment]),
        );
        const stagedAttachmentById = new Map<string, PersistedComposerImageAttachment>();
        await Promise.all(
          composerImages.map(async (image) => {
            try {
              const dataUrl = await readFileAsDataUrl(image.file);
              stagedAttachmentById.set(image.id, {
                id: image.id,
                name: image.name,
                mimeType: image.mimeType,
                sizeBytes: image.sizeBytes,
                dataUrl,
              });
            } catch {
              const existingPersisted = existingPersistedById.get(image.id);
              if (existingPersisted) {
                stagedAttachmentById.set(image.id, existingPersisted);
              }
            }
          }),
        );
        const serialized = Array.from(stagedAttachmentById.values());
        if (cancelled) {
          return;
        }
        // Stage attachments in persisted draft state first so persist middleware can write them.
        syncComposerDraftPersistedAttachments(threadId, serialized);
      } catch {
        const currentImageIds = new Set(composerImages.map((image) => image.id));
        const fallbackPersistedAttachments = getPersistedAttachmentsForThread();
        const fallbackPersistedIds = fallbackPersistedAttachments
          .map((attachment) => attachment.id)
          .filter((id) => currentImageIds.has(id));
        const fallbackPersistedIdSet = new Set(fallbackPersistedIds);
        const fallbackAttachments = fallbackPersistedAttachments.filter((attachment) =>
          fallbackPersistedIdSet.has(attachment.id),
        );
        if (cancelled) {
          return;
        }
        syncComposerDraftPersistedAttachments(threadId, fallbackAttachments);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    clearComposerDraftPersistedAttachments,
    composerImages,
    syncComposerDraftPersistedAttachments,
    threadId,
  ]);

  const closeExpandedImage = useCallback(() => {
    setExpandedImage(null);
  }, []);
  const navigateExpandedImage = useCallback((direction: -1 | 1) => {
    setExpandedImage((existing) => {
      if (!existing || existing.images.length <= 1) {
        return existing;
      }
      const nextIndex =
        (existing.index + direction + existing.images.length) % existing.images.length;
      if (nextIndex === existing.index) {
        return existing;
      }
      return { ...existing, index: nextIndex };
    });
  }, []);

  useEffect(() => {
    if (!expandedImage) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeExpandedImage();
        return;
      }
      if (expandedImage.images.length <= 1) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        navigateExpandedImage(-1);
        return;
      }
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();
      navigateExpandedImage(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeExpandedImage, expandedImage, navigateExpandedImage]);

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

  useEffect(() => {
    if (!activeThreadId) return;
    const previous = terminalOpenByThreadRef.current[activeThreadId] ?? false;
    const current = Boolean(terminalState.terminalOpen);

    if (!previous && current) {
      terminalOpenByThreadRef.current[activeThreadId] = current;
      requestTerminalFocus();
      return;
    } else if (previous && !current) {
      terminalOpenByThreadRef.current[activeThreadId] = current;
      const frame = window.requestAnimationFrame(() => {
        focusComposer();
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    terminalOpenByThreadRef.current[activeThreadId] = current;
  }, [activeThreadId, focusComposer, requestTerminalFocus, terminalState.terminalOpen]);

  useEffect(() => {
    if (!activeThreadId) {
      activatedThreadIdRef.current = null;
      return;
    }
    if (activatedThreadIdRef.current === activeThreadId) {
      return;
    }
    activatedThreadIdRef.current = activeThreadId;
    if (terminalState.entryPoint !== "terminal") {
      return;
    }
    openTerminalThreadPage();
  }, [activeThreadId, openTerminalThreadPage, terminalState.entryPoint]);

  useEffect(() => {
    if (!terminalWorkspaceOpen) {
      return;
    }

    if (terminalState.workspaceActiveTab === "terminal") {
      requestTerminalFocus();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      focusComposer();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    focusComposer,
    requestTerminalFocus,
    terminalState.workspaceActiveTab,
    terminalWorkspaceOpen,
  ]);

  useEffect(() => {
    if (surfaceMode === "split" && !isFocusedPane) {
      return;
    }

    const handler = (event: globalThis.KeyboardEvent) => {
      if (!activeThreadId || event.defaultPrevented) return;
      // Mirror terminal interrupt semantics without stealing regular copy shortcuts.
      if (
        hasLiveTurn &&
        isMacPlatform(navigator.platform) &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "c" &&
        eventTargetsComposer(event, composerFormRef.current)
      ) {
        event.preventDefault();
        event.stopPropagation();
        void onInterrupt();
        return;
      }
      const shortcutContext = {
        terminalFocus: isTerminalFocused(),
        terminalOpen: Boolean(terminalState.terminalOpen),
        terminalWorkspaceOpen,
        terminalWorkspaceTerminalOnly: terminalState.workspaceLayout === "terminal-only",
        terminalWorkspaceTerminalTabActive,
        terminalWorkspaceChatTabActive,
      };

      const command = resolveShortcutCommand(event, keybindings, {
        context: shortcutContext,
      });
      if (!command) return;

      if (command === "terminal.toggle") {
        event.preventDefault();
        event.stopPropagation();
        toggleTerminalVisibility();
        return;
      }

      if (command === "terminal.split" || command === "terminal.splitRight") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) {
          setTerminalOpen(true);
        }
        splitTerminalRight();
        return;
      }

      if (command === "terminal.splitLeft") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) {
          setTerminalOpen(true);
        }
        splitTerminalLeft();
        return;
      }

      if (command === "terminal.splitDown") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) {
          setTerminalOpen(true);
        }
        splitTerminalDown();
        return;
      }

      if (command === "terminal.splitUp") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) {
          setTerminalOpen(true);
        }
        splitTerminalUp();
        return;
      }

      if (command === "terminal.close") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) return;
        closeTerminal(terminalState.activeTerminalId);
        return;
      }

      if (command === "terminal.new") {
        event.preventDefault();
        event.stopPropagation();
        createTerminalFromShortcut();
        return;
      }

      if (command === "terminal.workspace.newFullWidth") {
        event.preventDefault();
        event.stopPropagation();
        openNewFullWidthTerminal();
        return;
      }

      if (command === "terminal.workspace.closeActive") {
        event.preventDefault();
        event.stopPropagation();
        closeActiveWorkspaceView();
        return;
      }

      if (command === "terminal.workspace.terminal") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalWorkspaceOpen) return;
        setTerminalWorkspaceTab("terminal");
        return;
      }

      if (command === "terminal.workspace.chat") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalWorkspaceOpen) return;
        setTerminalWorkspaceTab("chat");
        return;
      }

      if (command === "diff.toggle") {
        event.preventDefault();
        event.stopPropagation();
        onToggleDiff();
        return;
      }

      if (command === "browser.toggle") {
        event.preventDefault();
        event.stopPropagation();
        if (!isElectron) return;
        onToggleBrowser();
        return;
      }

      if (command === "chat.split") {
        event.preventDefault();
        event.stopPropagation();
        if (surfaceMode === "single" && onSplitSurface) {
          onSplitSurface();
        }
        return;
      }

      const scriptId = projectScriptIdFromCommand(command);
      if (!scriptId || !activeProject) return;
      const script = activeProject.scripts.find((entry) => entry.id === scriptId);
      if (!script) return;
      event.preventDefault();
      event.stopPropagation();
      void runProjectScript(script);
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [
    activeProject,
    terminalState.terminalOpen,
    terminalState.activeTerminalId,
    terminalState.workspaceLayout,
    activeThreadId,
    closeTerminal,
    closeActiveWorkspaceView,
    createTerminalFromShortcut,
    setTerminalOpen,
    openNewFullWidthTerminal,
    runProjectScript,
    keybindings,
    splitTerminalDown,
    splitTerminalLeft,
    splitTerminalRight,
    splitTerminalUp,
    terminalWorkspaceChatTabActive,
    terminalWorkspaceOpen,
    terminalWorkspaceTerminalTabActive,
    onToggleBrowser,
    onToggleDiff,
    onInterrupt,
    onSplitSurface,
    isFocusedPane,
    hasLiveTurn,
    setTerminalWorkspaceTab,
    surfaceMode,
    toggleTerminalVisibility,
  ]);

  // --- Composer attachment entry points -------------------------------------
  const addComposerImages = (files: File[]) => {
    if (!activeThreadId || files.length === 0) return;

    if (pendingUserInputs.length > 0) {
      toastManager.add({
        type: "error",
        title: "Attach images after answering plan questions.",
      });
      return;
    }

    const nextImages: ComposerImageAttachment[] = [];
    let nextImageCount = composerImagesRef.current.length;
    let error: string | null = null;
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        error = `Unsupported file type for '${file.name}'. Please attach image files only.`;
        continue;
      }
      if (file.size > PROVIDER_SEND_TURN_MAX_IMAGE_BYTES) {
        error = `'${file.name}' exceeds the ${IMAGE_SIZE_LIMIT_LABEL} attachment limit.`;
        continue;
      }
      if (nextImageCount >= PROVIDER_SEND_TURN_MAX_ATTACHMENTS) {
        error = `You can attach up to ${PROVIDER_SEND_TURN_MAX_ATTACHMENTS} images per message.`;
        break;
      }

      const previewUrl = URL.createObjectURL(file);
      nextImages.push({
        type: "image",
        id: randomUUID(),
        name: file.name || "image",
        mimeType: file.type,
        sizeBytes: file.size,
        previewUrl,
        file,
      });
      nextImageCount += 1;
    }

    if (nextImages.length === 1 && nextImages[0]) {
      addComposerImage(nextImages[0]);
    } else if (nextImages.length > 1) {
      addComposerImagesToDraft(nextImages);
    }
    setThreadError(activeThreadId, error);
  };

  const removeComposerImage = (imageId: string) => {
    removeComposerImageFromDraft(imageId);
  };

  const onComposerPaste = (event: React.ClipboardEvent<HTMLElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) {
      return;
    }
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      return;
    }
    event.preventDefault();
    addComposerImages(imageFiles);
  };

  const onComposerDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOverComposer(true);
  };

  const onComposerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOverComposer(true);
  };

  const onComposerDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOverComposer(false);
    }
  };

  const onComposerDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOverComposer(false);
    const files = Array.from(event.dataTransfer.files);
    addComposerImages(files);
    focusComposer();
  };

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

  const onCreateHandoffThread = useCallback(async () => {
    if (!activeThread || handoffDisabled) {
      return;
    }

    try {
      await createThreadHandoff(activeThread);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not create handoff thread",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while creating the handoff thread.",
      });
    }
  }, [activeThread, createThreadHandoff, handoffDisabled]);

  const restoreQueuedTurnToComposer = useCallback(
    (queuedTurn: QueuedComposerTurn) => {
      if (!activeThread) {
        return;
      }
      const nextPrompt = queuedTurn.kind === "chat" ? queuedTurn.prompt : queuedTurn.text;
      const restoredImages =
        queuedTurn.kind === "chat" ? queuedTurn.images.map(cloneComposerImageForRetry) : [];
      promptRef.current = nextPrompt;
      clearComposerDraftContent(activeThread.id);
      setComposerDraftPrompt(activeThread.id, nextPrompt);
      // Editing a queued turn should recreate the same draft state the user queued.
      setDraftThreadContext(activeThread.id, {
        runtimeMode: queuedTurn.runtimeMode,
        interactionMode: queuedTurn.interactionMode,
        ...(queuedTurn.kind === "chat" ? { envMode: queuedTurn.envMode } : {}),
      });
      if (queuedTurn.kind === "chat") {
        if (restoredImages.length > 0) {
          addComposerImagesToDraft(restoredImages);
        }
        if (queuedTurn.terminalContexts.length > 0) {
          addComposerTerminalContextsToDraft(queuedTurn.terminalContexts);
        }
        setSelectedComposerSkills(queuedTurn.skills);
        setSelectedComposerMentions(queuedTurn.mentions);
      } else {
        setSelectedComposerSkills([]);
        setSelectedComposerMentions([]);
      }
      setComposerDraftModelSelection(activeThread.id, queuedTurn.modelSelection);
      setComposerDraftRuntimeMode(activeThread.id, queuedTurn.runtimeMode);
      setComposerDraftInteractionMode(activeThread.id, queuedTurn.interactionMode);
      setComposerCursor(collapseExpandedComposerCursor(nextPrompt, nextPrompt.length));
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      scheduleComposerFocus();
    },
    [
      activeThread,
      addComposerImagesToDraft,
      addComposerTerminalContextsToDraft,
      clearComposerDraftContent,
      scheduleComposerFocus,
      setDraftThreadContext,
      setComposerDraftInteractionMode,
      setComposerDraftModelSelection,
      setComposerDraftPrompt,
      setComposerDraftRuntimeMode,
    ],
  );

  const removeQueuedComposerTurn = useCallback(
    (queuedTurnId: string) => {
      removeQueuedComposerTurnFromDraft(threadId, queuedTurnId);
    },
    [removeQueuedComposerTurnFromDraft, threadId],
  );

  const onSend = async (
    e?: { preventDefault: () => void },
    dispatchMode: "queue" | "steer" = "queue",
    queuedTurn?: QueuedComposerChatTurn,
  ): Promise<boolean> => {
    e?.preventDefault();
    const api = readNativeApi();
    if (
      !api ||
      !activeThread ||
      isSendBusy ||
      isConnecting ||
      isVoiceTranscribing ||
      sendInFlightRef.current
    ) {
      return false;
    }
    if (activePendingProgress) {
      onAdvanceActivePendingUserInput();
      return true;
    }
    const queuedChatTurn = queuedTurn ?? null;
    const liveComposerSnapshot =
      queuedChatTurn === null ? (composerEditorRef.current?.readSnapshot() ?? null) : null;
    const promptForSend =
      queuedChatTurn?.prompt ?? liveComposerSnapshot?.value ?? promptRef.current;
    const composerImagesForSend = queuedChatTurn?.images ?? composerImages;
    const composerTerminalContextsForSend =
      queuedChatTurn?.terminalContexts ?? composerTerminalContexts;
    const selectedComposerSkillsForSend = queuedChatTurn?.skills ?? selectedComposerSkills;
    const selectedComposerMentionsForSend = queuedChatTurn?.mentions ?? selectedComposerMentions;
    const selectedProviderForSend = queuedChatTurn?.selectedProvider ?? selectedProvider;
    const selectedModelForSend = queuedChatTurn?.selectedModel ?? selectedModel;
    const selectedPromptEffortForSend =
      queuedChatTurn?.selectedPromptEffort ?? selectedPromptEffort;
    const selectedModelSelectionForSend = queuedChatTurn?.modelSelection ?? selectedModelSelection;
    const providerOptionsForDispatchForSend =
      queuedChatTurn?.providerOptionsForDispatch ?? providerOptionsForDispatch;
    const runtimeModeForSend = queuedChatTurn?.runtimeMode ?? runtimeMode;
    const interactionModeForSend = queuedChatTurn?.interactionMode ?? interactionMode;
    const envModeForSend = queuedChatTurn?.envMode ?? envMode;
    const {
      trimmedPrompt: trimmed,
      sendableTerminalContexts: sendableComposerTerminalContexts,
      expiredTerminalContextCount,
      hasSendableContent,
    } = deriveComposerSendState({
      prompt: promptForSend,
      imageCount: composerImagesForSend.length,
      terminalContexts: composerTerminalContextsForSend,
    });
    if (showPlanFollowUpPrompt && activeProposedPlan) {
      const followUp = resolvePlanFollowUpSubmission({
        draftText: trimmed,
        planMarkdown: activeProposedPlan.planMarkdown,
      });
      if (hasLiveTurn && dispatchMode === "queue" && queuedChatTurn === null) {
        clearComposerInput(activeThread.id);
        enqueueQueuedComposerTurn(activeThread.id, {
          id: randomUUID(),
          kind: "plan-follow-up",
          createdAt: new Date().toISOString(),
          previewText: followUp.text.trim(),
          text: followUp.text,
          interactionMode: followUp.interactionMode,
          selectedProvider,
          selectedModel,
          selectedPromptEffort,
          modelSelection: selectedModelSelection,
          ...(providerOptionsForDispatch ? { providerOptionsForDispatch } : {}),
          runtimeMode,
        });
        return true;
      }
      clearComposerInput(activeThread.id);
      return submitPlanFollowUp({
        text: followUp.text,
        interactionMode: followUp.interactionMode,
        dispatchMode,
      });
    }
    if (composerImagesForSend.length === 0 && sendableComposerTerminalContexts.length === 0) {
      const handledSlashCommand = await handleStandaloneSlashCommand(trimmed);
      if (handledSlashCommand) {
        return true;
      }
    }
    if (!hasSendableContent) {
      if (expiredTerminalContextCount > 0) {
        const toastCopy = buildExpiredTerminalContextToastCopy(
          expiredTerminalContextCount,
          "empty",
        );
        toastManager.add({
          type: "warning",
          title: toastCopy.title,
          description: toastCopy.description,
        });
      }
      return false;
    }
    if (!activeProject) return false;
    if (hasLiveTurn && dispatchMode === "queue" && queuedChatTurn === null) {
      clearComposerInput(activeThread.id);
      const queuedImagesForPersistence = await Promise.all(
        composerImagesForSend.map(async (image) => {
          try {
            return {
              ...image,
              previewUrl: await readFileAsDataUrl(image.file),
            };
          } catch {
            return image;
          }
        }),
      );
      enqueueQueuedComposerTurn(activeThread.id, {
        id: randomUUID(),
        kind: "chat",
        createdAt: new Date().toISOString(),
        previewText: buildQueuedComposerPreviewText({
          trimmedPrompt: trimmed,
          images: queuedImagesForPersistence,
          terminalContexts: sendableComposerTerminalContexts,
        }),
        prompt: promptForSend,
        images: queuedImagesForPersistence,
        terminalContexts: sendableComposerTerminalContexts,
        skills: selectedComposerSkillsForSend,
        mentions: selectedComposerMentionsForSend,
        selectedProvider: selectedProviderForSend,
        selectedModel: selectedModelForSend,
        selectedPromptEffort: selectedPromptEffortForSend,
        modelSelection: selectedModelSelectionForSend,
        ...(providerOptionsForDispatchForSend
          ? { providerOptionsForDispatch: providerOptionsForDispatchForSend }
          : {}),
        runtimeMode: runtimeModeForSend,
        interactionMode: interactionModeForSend,
        envMode: envModeForSend,
      });
      return true;
    }
    const isFirstMessage = !isServerThread || !hasNativeUserMessages;
    const baseBranchForWorktree =
      isFirstMessage && envModeForSend === "worktree" && !activeThread.worktreePath
        ? activeThread.branch
        : null;

    // In worktree mode, require an explicit base branch so we don't silently
    // fall back to local execution when branch selection is missing.
    const shouldCreateWorktree =
      isFirstMessage && envModeForSend === "worktree" && !activeThread.worktreePath;
    if (shouldCreateWorktree && !activeThread.branch) {
      setStoreThreadError(
        activeThread.id,
        "Select a base branch before sending in New worktree mode.",
      );
      return false;
    }

    return dispatchChatTurn({
      activeProject,
      baseBranchForWorktree,
      composerImagesForSend,
      composerMentionsForSend: selectedComposerMentionsForSend,
      composerSkillsForSend: selectedComposerSkillsForSend,
      composerTerminalContextsForSend: sendableComposerTerminalContexts,
      dispatchMode,
      envModeForSend,
      expiredTerminalContextCount,
      interactionModeForSend,
      promptForSend,
      queuedChatTurn,
      runtimeModeForSend,
      selectedModelForSend,
      selectedModelSelectionForSend,
      selectedPromptEffortForSend,
      selectedProviderForSend,
      providerOptionsForDispatchForSend,
      trimmedPrompt: trimmed,
    });
  };

  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const dispatchQueuedChatTurn = useCallback(
    async (dispatchMode: "queue" | "steer", queuedTurn: QueuedComposerChatTurn) =>
      onSendRef.current(undefined, dispatchMode, queuedTurn),
    [],
  );

  const handlePlanImplementationStarted = useCallback(() => {
    planSidebarDismissedForTurnRef.current = null;
    setPlanSidebarOpen(true);
  }, []);

  const handleImplementationThreadOpened = useCallback(
    async (nextThreadId: ThreadIdType) => {
      planSidebarOpenOnNextThreadRef.current = true;
      await navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
      });
    },
    [navigate],
  );

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

  const readComposerSnapshot = useCallback((): {
    value: string;
    cursor: number;
    expandedCursor: number;
    terminalContextIds: string[];
  } => {
    const editorSnapshot = composerEditorRef.current?.readSnapshot();
    if (editorSnapshot) {
      return editorSnapshot;
    }
    return {
      value: promptRef.current,
      cursor: composerCursor,
      expandedCursor: expandCollapsedComposerCursor(promptRef.current, composerCursor),
      terminalContextIds: composerTerminalContexts.map((context) => context.id),
    };
  }, [composerCursor, composerTerminalContexts]);

  const resolveActiveComposerTrigger = useCallback((): {
    snapshot: { value: string; cursor: number; expandedCursor: number };
    trigger: ComposerTrigger | null;
  } => {
    const snapshot = readComposerSnapshot();
    return {
      snapshot,
      trigger: detectComposerTrigger(snapshot.value, snapshot.expandedCursor),
    };
  }, [readComposerSnapshot]);

  const setComposerPromptValue = useCallback(
    (nextPrompt: string) => {
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      const nextCursor = collapseExpandedComposerCursor(nextPrompt, nextPrompt.length);
      setComposerCursor(nextCursor);
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      setComposerHighlightedItemId(null);
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCursor);
      });
    },
    [setPrompt],
  );

  const clearComposerSlashDraft = useCallback(() => {
    promptRef.current = "";
    clearComposerDraftContent(threadId);
    setComposerHighlightedItemId(null);
    setComposerCursor(0);
    setComposerTrigger(null);
    scheduleComposerFocus();
  }, [clearComposerDraftContent, scheduleComposerFocus, threadId]);

  const slashEditorActions = useMemo(
    () => ({
      resolveActiveComposerTrigger,
      applyPromptReplacement,
      extendReplacementRangeForTrailingSpace,
      clearComposerSlashDraft,
      setComposerPromptValue,
      scheduleComposerFocus,
      setComposerHighlightedItemId,
    }),
    [
      applyPromptReplacement,
      clearComposerSlashDraft,
      resolveActiveComposerTrigger,
      scheduleComposerFocus,
      setComposerPromptValue,
    ],
  );

  const {
    handleForkTargetSelection,
    handleReviewTargetSelection,
    isSlashStatusDialogOpen,
    setIsSlashStatusDialogOpen,
    handleStandaloneSlashCommand,
    handleSlashCommandSelection,
  } = useComposerSlashCommands({
    activeProject,
    activeThread,
    activeRootBranch,
    isServerThread,
    supportsFastSlashCommand,
    supportsTextNativeReviewCommand,
    fastModeEnabled,
    providerNativeCommands,
    providerCommandDiscoveryCwd: composerSkillCwd,
    selectedProvider,
    currentProviderModelOptions,
    selectedModelSelection,
    runtimeMode,
    interactionMode,
    threadId,
    syncServerReadModel,
    navigateToThread: (nextThreadId) =>
      navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
      }),
    handleClearConversation: async () => {
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
    handleInteractionModeChange,
    openForkTargetPicker: () => {
      setComposerCommandPicker("fork-target");
      setComposerHighlightedItemId("fork-target:worktree");
    },
    openReviewTargetPicker: () => {
      setComposerCommandPicker("review-target");
      setComposerHighlightedItemId("review-target:changes");
    },
    setComposerDraftProviderModelOptions,
    editorActions: slashEditorActions,
  });

  const onSelectComposerItem = useCallback(
    (item: ComposerCommandItem) => {
      if (composerSelectLockRef.current) return;
      composerSelectLockRef.current = true;
      window.requestAnimationFrame(() => {
        composerSelectLockRef.current = false;
      });
      if (item.type === "fork-target") {
        setComposerCommandPicker(null);
        setComposerHighlightedItemId(null);
        void handleForkTargetSelection(item.target);
        return;
      }
      if (item.type === "review-target") {
        setComposerCommandPicker(null);
        setComposerHighlightedItemId(null);
        void handleReviewTargetSelection(item.target);
        return;
      }
      const { snapshot, trigger } = resolveActiveComposerTrigger();
      if (!trigger) return;
      if (item.type === "path") {
        const replacement = `@${item.path} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "slash-command") {
        handleSlashCommandSelection(item);
        return;
      }
      if (item.type === "provider-native-command") {
        const replacement = `/${item.command} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "skill") {
        const replacement = `${skillMentionPrefix(selectedProvider)}${item.skill.name} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setSelectedComposerSkills((existing) => {
            const nextSkill = {
              name: item.skill.name,
              path: item.skill.path,
            } satisfies ProviderSkillReference;
            return existing.some(
              (skill) => skill.name === nextSkill.name && skill.path === nextSkill.path,
            )
              ? existing
              : [...existing, nextSkill];
          });
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "plugin") {
        const replacement = `@${item.plugin.name} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied !== false) {
          setSelectedComposerMentions((existing) => {
            const nextMention = item.mention;
            const nextWithoutSameName = existing.filter(
              (mention) => mention.name !== nextMention.name,
            );
            return [...nextWithoutSameName, nextMention];
          });
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "model") {
        onProviderModelSelect(item.provider, item.model);
        const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, "", {
          expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
        });
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "agent") {
        // Insert @alias() and position cursor inside parentheses
        const replacement = `@${item.alias}()`;
        const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, replacement, {
          expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
          cursorOffset: -1, // Move cursor back 1 to be inside the parentheses
        });
        if (applied !== false) {
          setComposerHighlightedItemId(null);
        }
      }
    },
    [
      applyPromptReplacement,
      composerCursor,
      handleForkTargetSelection,
      handleReviewTargetSelection,
      handleSlashCommandSelection,
      onProviderModelSelect,
      setComposerCommandPicker,
      selectedProvider,
      setSelectedComposerMentions,
      setSelectedComposerSkills,
      resolveActiveComposerTrigger,
    ],
  );
  const onComposerMenuItemHighlighted = useCallback((itemId: string | null) => {
    setComposerHighlightedItemId(itemId);
  }, []);
  const nudgeComposerMenuHighlight = useCallback(
    (key: "ArrowDown" | "ArrowUp") => {
      if (composerMenuItems.length === 0) {
        return;
      }
      const highlightedIndex = composerMenuItems.findIndex(
        (item) => item.id === composerHighlightedItemId,
      );
      const normalizedIndex =
        highlightedIndex >= 0 ? highlightedIndex : key === "ArrowDown" ? -1 : 0;
      const offset = key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (normalizedIndex + offset + composerMenuItems.length) % composerMenuItems.length;
      const nextItem = composerMenuItems[nextIndex];
      setComposerHighlightedItemId(nextItem?.id ?? null);
    },
    [composerHighlightedItemId, composerMenuItems],
  );
  const isComposerMenuLoading =
    (composerTriggerKind === "mention" &&
      ((mentionTriggerQuery.length > 0 && composerPathQueryDebouncer.state.isPending) ||
        workspaceEntriesQuery.isLoading ||
        workspaceEntriesQuery.isFetching ||
        providerPluginsQuery.isLoading ||
        providerPluginsQuery.isFetching)) ||
    (composerTriggerKind === "slash-command" &&
      (providerCommandsQuery.isLoading || providerCommandsQuery.isFetching));

  const onPromptChange = useCallback(
    (
      nextPrompt: string,
      nextCursor: number,
      expandedCursor: number,
      cursorAdjacentToMention: boolean,
      terminalContextIds: string[],
    ) => {
      if (activePendingProgress?.activeQuestion && activePendingUserInput) {
        onChangeActivePendingUserInputCustomAnswer(
          activePendingProgress.activeQuestion.id,
          nextPrompt,
          nextCursor,
          expandedCursor,
          cursorAdjacentToMention,
        );
        return;
      }
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      if (composerCommandPicker !== null && nextPrompt.trim().length > 0) {
        setComposerCommandPicker(null);
      }
      if (!terminalContextIdListsEqual(composerTerminalContexts, terminalContextIds)) {
        setComposerDraftTerminalContexts(
          threadId,
          syncTerminalContextsByIds(composerTerminalContexts, terminalContextIds),
        );
      }
      setComposerCursor(nextCursor);
      setComposerTrigger(
        cursorAdjacentToMention ? null : detectComposerTrigger(nextPrompt, expandedCursor),
      );
    },
    [
      activePendingProgress?.activeQuestion,
      activePendingUserInput,
      composerTerminalContexts,
      composerCommandPicker,
      onChangeActivePendingUserInputCustomAnswer,
      setPrompt,
      setComposerDraftTerminalContexts,
      setComposerCommandPicker,
      threadId,
    ],
  );

  const onComposerCommandKey = (
    key: "ArrowDown" | "ArrowUp" | "Enter" | "Tab",
    event: KeyboardEvent,
  ) => {
    if (key === "Tab" && event.shiftKey) {
      toggleInteractionMode();
      return true;
    }

    const { trigger } = resolveActiveComposerTrigger();
    const menuIsActive = composerMenuOpenRef.current || trigger !== null;

    if (menuIsActive) {
      const currentItems = composerMenuItemsRef.current;
      if (key === "ArrowDown" && currentItems.length > 0) {
        nudgeComposerMenuHighlight("ArrowDown");
        return true;
      }
      if (key === "ArrowUp" && currentItems.length > 0) {
        nudgeComposerMenuHighlight("ArrowUp");
        return true;
      }
      if (key === "Tab" || key === "Enter") {
        const selectedItem = activeComposerMenuItemRef.current ?? currentItems[0];
        if (selectedItem) {
          onSelectComposerItem(selectedItem);
          return true;
        }
      }
    }

    if (key === "Enter" && !event.shiftKey) {
      void onSend(undefined, event.metaKey || event.ctrlKey ? "steer" : "queue");
      return true;
    }
    return false;
  };
  const onToggleWorkGroup = useCallback((groupId: string) => {
    setExpandedWorkGroups((existing) => ({
      ...existing,
      [groupId]: !existing[groupId],
    }));
  }, []);
  const onExpandTimelineImage = useCallback((preview: ExpandedImagePreview) => {
    setExpandedImage(preview);
  }, []);
  const onScrollToBottom = useCallback(() => {
    forceStickToBottom("smooth");
  }, [forceStickToBottom]);
  const onOpenTurnDiff = useCallback(
    (turnId: TurnId, filePath?: string) => {
      if (diffEnvironmentPending) {
        return;
      }
      if (onOpenTurnDiffPanel) {
        onOpenTurnDiffPanel(turnId, filePath);
        return;
      }
      void navigate({
        to: "/$threadId",
        params: { threadId },
        search: (previous) => {
          const rest = stripDiffSearchParams(previous);
          return filePath
            ? { ...rest, panel: "diff", diff: "1", diffTurnId: turnId, diffFilePath: filePath }
            : { ...rest, panel: "diff", diff: "1", diffTurnId: turnId };
        },
      });
    },
    [diffEnvironmentPending, navigate, onOpenTurnDiffPanel, threadId],
  );
  const onNavigateToThread = useCallback(
    (nextThreadId: ThreadId) => {
      void navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
        search: (previous) => stripDiffSearchParams(previous),
      });
    },
    [navigate],
  );
  const onRevertUserMessage = useCallback(
    (messageId: MessageId) => {
      const targetTurnCount = revertTurnCountByUserMessageId.get(messageId);
      if (typeof targetTurnCount !== "number") {
        return;
      }
      void onRevertToTurnCount(targetTurnCount);
    },
    [onRevertToTurnCount, revertTurnCountByUserMessageId],
  );
  const onRunProjectScriptFromHeader = useCallback(
    (script: ProjectScript) => {
      void runProjectScript(script);
    },
    [runProjectScript],
  );
  const dismissActiveThreadError = useCallback(() => {
    if (!activeThread) return;
    setThreadError(activeThread.id, null);
  }, [activeThread, setThreadError]);
  const composerActivePlanCard = (
    <ChatActivePlanCard
      activePlan={activePlan && !planSidebarOpen ? activePlan : null}
      backgroundTaskCount={activeBackgroundTasks?.activeCount ?? 0}
      onOpenSidebar={() => setPlanSidebarOpen(true)}
    />
  );
  const composerStatusBanner = (
    <ChatComposerStatusBanner
      activePendingApproval={activePendingApproval}
      pendingApprovalsCount={pendingApprovals.length}
      pendingUserInputs={pendingUserInputs}
      respondingRequestIds={respondingRequestIds}
      activePendingDraftAnswers={activePendingDraftAnswers}
      activePendingQuestionIndex={activePendingQuestionIndex}
      onToggleActivePendingUserInputOption={onToggleActivePendingUserInputOption}
      onAdvanceActivePendingUserInput={onAdvanceActivePendingUserInput}
      showPlanFollowUpPrompt={showPlanFollowUpPrompt}
      planTitle={
        showPlanFollowUpPrompt && activeProposedPlan
          ? (proposedPlanTitle(activeProposedPlan.planMarkdown) ?? null)
          : null
      }
    />
  );
  const composerCommandMenuNode =
    composerMenuOpen && !isComposerApprovalState ? (
      <div className="absolute inset-x-0 bottom-full z-20 mb-2 px-1">
        <ComposerCommandMenu
          items={composerMenuItems}
          resolvedTheme={resolvedTheme}
          isLoading={isComposerMenuLoading}
          triggerKind={
            composerCommandPicker !== null ? "slash-command" : effectiveComposerTriggerKind
          }
          activeItemId={activeComposerMenuItem?.id ?? null}
          onHighlightedItemChange={onComposerMenuItemHighlighted}
          onSelect={onSelectComposerItem}
        />
      </div>
    ) : null;
  const composerImageAttachmentsNode =
    !isComposerApprovalState && pendingUserInputs.length === 0 && composerImages.length > 0 ? (
      <div className="mb-2.5 flex flex-wrap gap-2">
        {composerImages.map((image) => (
          <ComposerImageAttachmentChip
            key={image.id}
            image={image}
            images={composerImages}
            nonPersisted={nonPersistedComposerImageIdSet.has(image.id)}
            onExpandImage={setExpandedImage}
            onRemoveImage={removeComposerImage}
          />
        ))}
      </div>
    ) : null;
  const composerPromptEditorNode = (
    <ComposerPromptEditor
      ref={composerEditorRef}
      value={
        isComposerApprovalState
          ? ""
          : activePendingProgress
            ? activePendingProgress.customAnswer
            : prompt
      }
      cursor={composerCursor}
      terminalContexts={
        !isComposerApprovalState && pendingUserInputs.length === 0 ? composerTerminalContexts : []
      }
      onRemoveTerminalContext={removeComposerTerminalContextFromDraft}
      onChange={onPromptChange}
      onCommandKeyDown={onComposerCommandKey}
      onPaste={onComposerPaste}
      placeholder={
        isComposerApprovalState
          ? (activePendingApproval?.detail ?? "Resolve this approval request to continue")
          : activePendingProgress
            ? "Type your own answer, or leave this blank to use the selected option"
            : showPlanFollowUpPrompt && activeProposedPlan
              ? "Add feedback to refine the plan, or leave this blank to implement it"
              : hasLiveTurn
                ? "Ask for follow-up changes"
                : phase === "disconnected"
                  ? "Ask for follow-up changes or attach images"
                  : "Ask anything, @tag files/folders, or use / to show available commands"
      }
      disabled={isConnecting || isComposerApprovalState}
    />
  );
  const composerFooterLeftContent = (
    <div
      className={cn(
        "flex items-center",
        isVoiceRecording || isVoiceTranscribing
          ? "min-w-0 shrink-0 gap-1"
          : isComposerFooterCompact
            ? "min-w-0 flex-1 gap-1 overflow-hidden"
            : "-m-1 min-w-0 flex-1 gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:min-w-max sm:overflow-visible",
      )}
    >
      <ComposerExtrasMenu
        interactionMode={interactionMode}
        supportsFastMode={composerTraitSelection.caps.supportsFastMode}
        fastModeEnabled={composerTraitSelection.fastModeEnabled}
        onAddPhotos={addComposerImages}
        onToggleFastMode={toggleFastMode}
        onSetPlanMode={setPlanMode}
      />

      {!isVoiceRecording && !isVoiceTranscribing ? (
        <>
          <ProviderModelPicker
            compact={isComposerFooterCompact}
            provider={selectedProvider}
            model={selectedModelForPickerWithCustomFallback}
            lockedProvider={lockedProvider}
            providers={providerStatuses}
            modelOptionsByProvider={modelOptionsByProvider}
            {...(composerProviderState.modelPickerIconClassName
              ? {
                  activeProviderIconClassName: composerProviderState.modelPickerIconClassName,
                }
              : {})}
            onProviderModelChange={onProviderModelSelect}
          />

          {providerTraitsPicker ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 hidden h-4 sm:block" />
              {providerTraitsPicker}
            </>
          ) : null}

          {interactionMode === "plan" ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 hidden h-4 sm:block" />
              <Button
                variant="ghost"
                className="shrink-0 whitespace-nowrap px-2 text-[length:var(--app-font-size-ui-sm,11px)] sm:text-[length:var(--app-font-size-ui-sm,11px)] font-normal text-blue-400 hover:text-blue-300 sm:px-3"
                size="sm"
                type="button"
                onClick={toggleInteractionMode}
                title="Plan mode — click to return to normal chat mode"
              >
                <GoTasklist className="size-3.5" />
                <span className="sr-only sm:not-sr-only">Plan</span>
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
  const composerFooterRightContent = (
    <div
      data-chat-composer-actions="right"
      className={cn(
        "flex gap-2",
        isVoiceRecording || isVoiceTranscribing ? "items-center" : "items-end",
        isVoiceRecording || isVoiceTranscribing ? "min-w-0 flex-1" : "shrink-0",
      )}
    >
      {isPreparingWorktree ? (
        <span className="text-muted-foreground/70 text-xs">Preparing worktree...</span>
      ) : null}
      {showVoiceNotesControl && (isVoiceRecording || isVoiceTranscribing) ? (
        <ComposerVoiceRecorderBar
          disabled={isComposerApprovalState || isConnecting || isSendBusy}
          isRecording={isVoiceRecording}
          isTranscribing={isVoiceTranscribing}
          durationLabel={voiceRecordingDurationLabel}
          waveformLevels={voiceWaveformLevels}
          onCancel={() => {
            if (isVoiceRecording) {
              void submitComposerVoiceRecording();
              return;
            }
            cancelComposerVoiceRecording();
          }}
          onSubmit={() => {
            void submitComposerVoiceRecording();
          }}
        />
      ) : null}
      {activePendingProgress ? (
        <div className="flex items-center gap-2">
          {activePendingProgress.questionIndex > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={onPreviousActivePendingUserInputQuestion}
              disabled={activePendingIsResponding}
            >
              Previous
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            className="rounded-full px-4"
            disabled={
              activePendingIsResponding ||
              (activePendingProgress.isLastQuestion
                ? !activePendingResolvedAnswers
                : !activePendingProgress.canAdvance)
            }
          >
            {activePendingIsResponding
              ? "Submitting..."
              : activePendingProgress.isLastQuestion
                ? "Submit answers"
                : "Next question"}
          </Button>
        </div>
      ) : phase === "running" ? (
        <button
          type="button"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-all duration-150 hover:scale-105 sm:h-[26px] sm:w-[26px]"
          onClick={() => void onInterrupt()}
          aria-label="Stop generation"
          title="Stop the current response. On Mac, press Ctrl+C to interrupt."
        >
          <span aria-hidden="true" className="block size-2 rounded-[2px] bg-current" />
        </button>
      ) : pendingUserInputs.length === 0 && !isVoiceRecording && !isVoiceTranscribing ? (
        showPlanFollowUpPrompt ? (
          prompt.trim().length > 0 ? (
            <Button
              type="submit"
              size="sm"
              className="h-9 rounded-full px-4 sm:h-8"
              disabled={isSendBusy || isConnecting}
            >
              {isConnecting || isSendBusy ? "Sending..." : "Refine"}
            </Button>
          ) : (
            <div className="flex items-center">
              <Button
                type="submit"
                size="sm"
                className="h-9 rounded-l-full rounded-r-none px-4 sm:h-8"
                disabled={isSendBusy || isConnecting}
              >
                {isConnecting || isSendBusy ? "Sending..." : "Implement"}
              </Button>
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      size="sm"
                      variant="default"
                      className="h-9 rounded-l-none rounded-r-full border-l-white/12 px-2 sm:h-8"
                      aria-label="Implementation actions"
                      disabled={isSendBusy || isConnecting}
                    />
                  }
                >
                  <ChevronDownIcon className="size-3.5" />
                </MenuTrigger>
                <MenuPopup align="end" side="top">
                  <MenuItem
                    disabled={isSendBusy || isConnecting}
                    onClick={() => void onImplementPlanInNewThread()}
                  >
                    Implement in a new thread
                  </MenuItem>
                </MenuPopup>
              </Menu>
            </div>
          )
        ) : (
          <>
            {showVoiceNotesControl ? (
              <ComposerVoiceButton
                disabled={isComposerApprovalState || isConnecting || isSendBusy}
                isRecording={isVoiceRecording}
                isTranscribing={isVoiceTranscribing}
                durationLabel={voiceRecordingDurationLabel}
                onClick={toggleComposerVoiceRecording}
              />
            ) : null}
            <button
              type="submit"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background transition-all duration-150 hover:scale-105 disabled:opacity-20 disabled:hover:scale-100 sm:h-8 sm:w-8"
              disabled={
                isSendBusy ||
                isConnecting ||
                isVoiceTranscribing ||
                !composerSendState.hasSendableContent
              }
              aria-label={
                isConnecting
                  ? "Connecting"
                  : isVoiceTranscribing
                    ? "Transcribing voice note"
                    : isPreparingWorktree
                      ? "Preparing worktree"
                      : isSendBusy
                        ? "Sending"
                        : "Send message"
              }
            >
              {isConnecting || isSendBusy ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="animate-spin"
                  aria-hidden="true"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray="20 12"
                  />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </>
        )
      ) : null}
    </div>
  );
  const composerFooter = (
    <ChatComposerFooter
      activePendingApprovalActions={
        activePendingApproval ? (
          <ComposerPendingApprovalActions
            requestId={activePendingApproval.requestId}
            isResponding={respondingRequestIds.includes(activePendingApproval.requestId)}
            onRespondToApproval={onRespondToApproval}
          />
        ) : null
      }
      isComposerFooterCompact={isComposerFooterCompact}
      leftContent={composerFooterLeftContent}
      rightContent={composerFooterRightContent}
    />
  );

  // Empty state: no active thread
  if (!activeThread) {
    return <ChatEmptyThreadState sidebarSide={settings.sidebarSide} />;
  }

  const chatTranscriptPaneProps = {
    activeThreadId: activeThread.id,
    hasMessages: timelineEntries.length > 0,
    isWorking,
    activeTurnInProgress,
    activeTurnStartedAt: activeWorkStartedAt,
    messagesScrollElement,
    setMessagesBottomAnchorRef,
    setMessagesScrollContainerRef,
    timelineEntries,
    completionDividerBeforeEntryId,
    completionSummary,
    turnDiffSummaryByAssistantMessageId,
    nowIso,
    expandedWorkGroups,
    onToggleWorkGroup,
    onOpenTurnDiff,
    onOpenThread: onNavigateToThread,
    revertTurnCountByUserMessageId,
    onRevertUserMessage,
    isRevertingCheckpoint,
    onExpandTimelineImage,
    onTimelineHeightChange,
    markdownCwd: threadWorkspaceCwd ?? undefined,
    resolvedTheme,
    chatFontSizePx: settings.chatFontSizePx,
    timestampFormat,
    workspaceRoot: activeProject?.cwd ?? undefined,
    emptyStateProjectName: activeProject?.name,
    terminalWorkspaceTerminalTabActive,
    onMessagesScroll,
    onMessagesClickCapture,
    onMessagesWheel,
    onMessagesPointerDown,
    onMessagesPointerUp,
    onMessagesPointerCancel,
    onMessagesTouchStart,
    onMessagesTouchMove,
    onMessagesTouchEnd,
    scrollButtonVisible: showScrollToBottom,
    onScrollToBottom,
  };
  const chatComposerPaneProps = {
    activePlanCard: composerActivePlanCard,
    bottomPaddingClassName: isGitRepo ? "pb-1" : "pb-2.5 sm:pb-3",
    composerCommandMenu: composerCommandMenuNode,
    composerFooter,
    composerFormRef,
    composerFrameClassName: composerProviderState.composerFrameClassName,
    composerImageAttachments: composerImageAttachmentsNode,
    composerPromptEditor: composerPromptEditorNode,
    composerStatusBanner,
    composerSurfaceClassName: composerProviderState.composerSurfaceClassName,
    isDragOverComposer,
    onComposerDragEnter,
    onComposerDragLeave,
    onComposerDragOver,
    onComposerDrop,
    onEditQueuedComposerTurn,
    onRemoveQueuedComposerTurn: removeQueuedComposerTurn,
    onSend,
    onSteerQueuedComposerTurn,
    paneScopeId,
    queuedComposerTurns,
  };
  const terminalWorkspaceTabProps = {
    activeTab: terminalState.workspaceActiveTab,
    isWorking,
    terminalHasRunningActivity: terminalState.runningTerminalIds.length > 0,
    terminalCount: terminalState.terminalIds.length,
    workspaceLayout: terminalState.workspaceLayout,
    onSelectTab: setTerminalWorkspaceTab,
  };
  const chatHeaderProps = {
    activeThreadId: activeThread.id,
    activeThreadTitle: activeThread.parentThreadId
      ? resolveSubagentPresentationForThread({
          thread: activeThread,
          threads: allThreads,
        }).fullLabel
      : activeThread.title,
    activeProjectName: activeProject?.name,
    threadBreadcrumbs,
    hideHandoffControls: terminalWorkspaceTerminalTabActive,
    isGitRepo,
    openInCwd: threadWorkspaceCwd,
    activeProjectScripts: activeProject?.scripts,
    preferredScriptId: activeProject
      ? (lastInvokedScriptByProjectId[activeProject.id] ?? null)
      : null,
    keybindings,
    availableEditors,
    terminalAvailable: activeProject !== undefined,
    terminalOpen: terminalState.terminalOpen,
    terminalToggleShortcutLabel,
    browserToggleShortcutLabel: browserPanelShortcutLabel,
    diffToggleShortcutLabel: diffPanelShortcutLabel,
    handoffBadgeLabel,
    handoffActionLabel,
    handoffDisabled,
    handoffActionTargetProvider: handoffTargetProvider,
    handoffBadgeSourceProvider,
    handoffBadgeTargetProvider,
    browserOpen: resolvedBrowserOpen,
    gitCwd: threadWorkspaceCwd,
    diffOpen: resolvedDiffOpen,
    diffDisabledReason,
    surfaceMode,
    chatLayoutAction:
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
          : null,
    onRunProjectScript: onRunProjectScriptFromHeader,
    onAddProjectScript: saveProjectScript,
    onUpdateProjectScript: updateProjectScript,
    onDeleteProjectScript: deleteProjectScript,
    onToggleTerminal: toggleTerminalVisibility,
    onToggleDiff,
    onToggleBrowser,
    onCreateHandoff: onCreateHandoffThread,
    onNavigateToThread,
  };
  const branchToolbarNode = isGitRepo ? (
    <BranchToolbar
      threadId={activeThread.id}
      onEnvModeChange={onEnvModeChange}
      envLocked={envLocked}
      runtimeMode={runtimeMode}
      onRuntimeModeChange={handleRuntimeModeChange}
      onHandoffToWorktree={onHandoffToWorktree}
      onHandoffToLocal={onHandoffToLocal}
      handoffBusy={handoffBusy}
      onComposerFocusRequest={scheduleComposerFocus}
      contextWindow={activeContextWindow}
      cumulativeCostUsd={activeCumulativeCostUsd}
      {...(canCheckoutPullRequestIntoThread
        ? { onCheckoutPullRequestRequest: openPullRequestDialog }
        : {})}
    />
  ) : null;
  const pullRequestDialogNode = (
    <ChatPullRequestDialog
      dialogState={pullRequestDialogState}
      cwd={activeProject?.cwd ?? null}
      onClose={closePullRequestDialog}
      onPrepared={handlePreparedPullRequestThread}
    />
  );
  const workspaceTerminalDrawer = terminalWorkspaceOpen ? (
    <div
      aria-hidden={!terminalWorkspaceTerminalTabActive}
      className={cn(
        "absolute inset-0 min-h-0 min-w-0 transition-all duration-200 ease-out",
        terminalWorkspaceTerminalTabActive
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-1 opacity-0",
      )}
    >
      <ThreadTerminalDrawer
        key={`${activeThread.id}-workspace`}
        {...terminalDrawerProps}
        presentationMode="workspace"
        isVisible={terminalWorkspaceTerminalTabActive}
        onTogglePresentationMode={
          terminalState.workspaceLayout === "both" ? collapseTerminalWorkspace : undefined
        }
      />
    </div>
  ) : null;
  const planSidebarNode = planSidebarOpen ? (
    <PlanSidebar
      activePlan={activePlan}
      activeProposedPlan={sidebarProposedPlan}
      markdownCwd={threadWorkspaceCwd ?? undefined}
      workspaceRoot={activeProject?.cwd ?? undefined}
      timestampFormat={timestampFormat}
      onClose={() => {
        setPlanSidebarOpen(false);
        // Track that the user explicitly dismissed for this turn so auto-open won't fight them.
        const turnKey = activePlan?.turnId ?? sidebarProposedPlan?.turnId ?? null;
        if (turnKey) {
          planSidebarDismissedForTurnRef.current = turnKey;
        }
      }}
    />
  ) : null;
  const terminalDrawerNode =
    !terminalState.terminalOpen || !activeProject || terminalWorkspaceOpen ? null : (
      <ThreadTerminalDrawer
        key={activeThread.id}
        {...terminalDrawerProps}
        presentationMode="drawer"
        onTogglePresentationMode={expandTerminalWorkspace}
      />
    );

  return (
    <>
      <ChatViewShell
        chatThreadPaneProps={{
          bodyProps: {
            branchToolbar: branchToolbarNode,
            chatComposerPaneProps,
            chatTranscriptPaneProps,
            planSidebar: planSidebarNode,
            pullRequestDialog: pullRequestDialogNode,
            terminalWorkspaceOpen,
            terminalWorkspaceTerminalTabActive,
            workspaceTerminalDrawer,
          },
          headerProps: chatHeaderProps,
          isElectron: isElectron,
          rateLimitStatus: activeRateLimitStatus,
          providerStatus: activeProviderStatus,
          sidebarSide: settings.sidebarSide,
          terminalDrawer: terminalDrawerNode,
          terminalWorkspaceOpen: terminalWorkspaceOpen,
          terminalWorkspaceTabProps,
          threadError: activeThread.error,
          onDismissThreadError: dismissActiveThreadError,
        }}
      />

      <ChatViewDialogs
        composerSlashStatusDialogProps={{
          open: isSlashStatusDialogOpen,
          onOpenChange: setIsSlashStatusDialogOpen,
          selectedModel,
          fastModeEnabled,
          selectedPromptEffort,
          interactionMode,
          envMode,
          envState,
          branch: activeThread?.branch ?? activeRootBranch,
          contextWindow: activeContextWindow,
          cumulativeCostUsd: activeCumulativeCostUsd,
          rateLimitStatus: activeRateLimitStatus,
        }}
        threadWorktreeHandoffDialogProps={{
          open: worktreeHandoffDialogOpen,
          worktreeName: worktreeHandoffName,
          busy: handoffBusy,
          onWorktreeNameChange: setWorktreeHandoffName,
          onOpenChange: setWorktreeHandoffDialogOpen,
          onConfirm: confirmWorktreeHandoff,
        }}
      />

      <ChatExpandedImageDialog
        expandedImage={expandedImage}
        onClose={closeExpandedImage}
        onNavigate={navigateExpandedImage}
      />
    </>
  );
}

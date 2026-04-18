// FILE: providerDiscovery.ts
// Purpose: Shares provider-discovery helpers across chat and browser surfaces.
// Layer: Web lib
// Exports: cwd resolution, search normalization, and provider skill/plugin display helpers.

import { resolveThreadBranchSourceCwd } from "@t3tools/shared/threadEnvironment";
import { trimOrNull } from "@t3tools/shared/model";
import type {
  ProviderNativeCommandDescriptor,
  ProviderPluginDescriptor,
  ProviderSkillDescriptor,
} from "@t3tools/contracts";

function filterNonBlankText(value: string | undefined): string | null {
  return trimOrNull(value);
}

// Prefer the most specific workspace context so discovery reflects the active thread first.
export function resolveProviderDiscoveryCwd(options: {
  activeThreadWorktreePath: string | null;
  activeProjectCwd: string | null;
  serverCwd: string | null;
}): string | null {
  return (
    resolveThreadBranchSourceCwd({
      projectCwd: options.activeProjectCwd,
      worktreePath: options.activeThreadWorktreePath,
    }) ?? options.serverCwd
  );
}

export function normalizeProviderDiscoveryText(value: string | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSkillSearchBlob(
  skill: Pick<ProviderSkillDescriptor, "name" | "description" | "interface">,
): string {
  return normalizeProviderDiscoveryText(
    [skill.name, skill.interface?.displayName, skill.interface?.shortDescription, skill.description]
      .map(filterNonBlankText)
      .filter((value): value is string => value !== null)
      .join("\n"),
  );
}

export function buildPluginSearchBlob(
  plugin: Pick<ProviderPluginDescriptor, "name" | "interface">,
): string {
  return normalizeProviderDiscoveryText(
    [
      plugin.name,
      plugin.interface?.displayName,
      plugin.interface?.shortDescription,
      plugin.interface?.category,
      plugin.interface?.developerName,
    ]
      .map(filterNonBlankText)
      .filter((value): value is string => value !== null)
      .join("\n"),
  );
}

export function buildCommandSearchBlob(
  command: Pick<ProviderNativeCommandDescriptor, "name" | "description">,
): string {
  return normalizeProviderDiscoveryText(
    [command.name, command.description]
      .map(filterNonBlankText)
      .filter((value): value is string => value !== null)
      .join("\n"),
  );
}

export function formatSkillScope(scope: string | undefined): string {
  const normalized = trimOrNull(scope);
  if (!normalized) return "Personal";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

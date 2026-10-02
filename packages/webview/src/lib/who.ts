import { ROLES, type SessionEvent } from "@cathouse/protocol";

export type Role = (typeof ROLES)[number];
export interface RungParts {
  backend: string;
  model: string;
  effort: string | null;
}

export function parseRung(rung: string): RungParts {
  const colon = rung.indexOf(":");
  const backend = colon < 0 ? "" : rung.slice(0, colon);
  const rest = colon < 0 ? rung : rung.slice(colon + 1);
  const hash = rest.lastIndexOf("#");
  return {
    backend,
    model: hash < 0 ? rest : rest.slice(0, hash),
    effort: hash < 0 ? null : rest.slice(hash + 1),
  };
}

export function rungLabel(rung: string): string {
  const { model, effort } = parseRung(rung);
  return effort ? `${model} · ${effort}` : model;
}

function baseModel(id: string): string {
  return id.replace(/\[[^\]]*\]$/, "").replace(/-\d{8}$/, "");
}

export function modelLabel(id: string): string {
  const base = baseModel(id);
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?$/.exec(base);
  if (!match) return base;
  const [, family, major, minor] = match;
  return `${family?.[0]?.toUpperCase()}${family?.slice(1)} ${major}${minor ? `.${minor}` : ""}`;
}

export function sameModel(a: string, b: string): boolean {
  return baseModel(a) === baseModel(b);
}

function knownRole(value: string): Role | null {
  return ROLES.find((role) => role === value) ?? null;
}

export function dispatchRole(name: string): { role: Role | null; lane: string } {
  const role = [...ROLES]
    .sort((a, b) => b.length - a.length)
    .find((candidate) => name === candidate || name.startsWith(`${candidate}-`));
  return role
    ? { role, lane: name === role ? "" : name.slice(role.length + 1) }
    : { role: null, lane: name };
}

export function nativeAgentRole(subagentType: string): Role | null {
  if (!subagentType.startsWith("catherd-")) return null;
  const name = subagentType.slice("catherd-".length);
  let best: { role: Role; end: number } | undefined;
  for (const role of ROLES) {
    let from = 0;
    while (from <= name.length - role.length) {
      const start = name.indexOf(role, from);
      if (start < 0) break;
      const end = start + role.length;
      if (
        (start === 0 || name[start - 1] === "-") &&
        (end === name.length || name[end] === "-") &&
        (!best || end > best.end || (end === best.end && role.length > best.role.length))
      ) {
        best = { role, end };
      }
      from = start + 1;
    }
  }
  return best?.role ?? null;
}

export function liveRole(name: string, routes: { lane: string; role: string }[]): Role | null {
  const parsed = dispatchRole(name);
  if (parsed.role) return parsed.role;
  return knownRole(
    routes.find((route) => route.lane === name || route.lane === parsed.lane)?.role ?? "",
  );
}

export interface AgentInfo {
  id: string;
  taskId: string;
  role: Role | null;
  label: string;
  model: string | undefined;
  running: boolean;
}

export interface WhoState {
  orchestratorModel: string | undefined;
  agents: AgentInfo[];
}

type ModelEvent = { kind: "model"; model: string; parentToolUseId: string | null };
type TaskEvent = Extract<SessionEvent, { kind: "task" }> & { toolUseId?: string };

export function whoFromEvents(events: SessionEvent[]): WhoState {
  const state: WhoState = { orchestratorModel: undefined, agents: [] };
  const byTask = new Map<string, AgentInfo>();
  for (const raw of events) {
    // These fields are added by M1.L3, which can land after this module.
    const event = raw as SessionEvent | ModelEvent;
    if (event.kind === "init") {
      if (event.model) state.orchestratorModel = event.model;
    } else if (event.kind === "model") {
      if (event.parentToolUseId === null) state.orchestratorModel = event.model;
      else {
        const agent = state.agents.find((item) => item.id === event.parentToolUseId);
        if (agent) agent.model = event.model;
      }
    } else if (event.kind === "task") {
      const task = event as TaskEvent;
      let agent = byTask.get(task.taskId);
      if (!agent) {
        agent = {
          id: task.toolUseId ?? task.taskId,
          taskId: task.taskId,
          role: nativeAgentRole(task.subagentType ?? ""),
          label: task.subagentType ?? task.description ?? "task",
          model: undefined,
          running: true,
        };
        byTask.set(task.taskId, agent);
        state.agents.push(agent);
      } else if (task.toolUseId) {
        agent.id = task.toolUseId;
      }
      if (
        task.phase === "notification" ||
        task.status === "completed" ||
        task.status === "failed" ||
        task.status === "killed" ||
        task.status === "stopped"
      ) {
        agent.running = false;
      }
    }
  }
  return state;
}

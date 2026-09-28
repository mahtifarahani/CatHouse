import { z } from "zod";
import { CatalogResultSchema } from "./catalog";
import { PROTOCOL_VERSION } from "./envelope";
import { ProfileDocSchema, ProfileSaveResultSchema, ProfilesStateSchema } from "./profiles";
import { RoleDebugSchema, RoleReplySchema, RunDetailSchema, RunListItemSchema } from "./runs";
import { PromptAnswerSchema, SessionStateSchema } from "./session";
import { SetupActionIdSchema, SetupStateSchema } from "./setup";

/**
 * Every request the webview can make, with its params and result schemas.
 * Add a method here first; the host router and the webview client are typed from this table.
 */
export const methods = {
  "app.ping": {
    params: z.object({}),
    result: z.object({
      pong: z.literal(true),
      extensionVersion: z.string(),
      protocol: z.literal(PROTOCOL_VERSION),
      view: z.literal("sidebar"),
    }),
  },
  "app.workspace": {
    params: z.object({}),
    result: z.object({
      folders: z.array(z.object({ path: z.string(), name: z.string() })),
      repo: z.string().nullable(),
      catherdVersion: z.string(),
    }),
  },
  "app.setRepo": {
    params: z.object({ path: z.string() }),
    result: z.object({ repo: z.string() }),
  },
  "app.addFolders": {
    params: z.object({}),
    result: z.object({ changed: z.boolean() }),
  },
  "app.pickFiles": {
    params: z.object({}),
    result: z.object({ paths: z.array(z.string()) }),
  },
  "app.removeFolder": {
    params: z.object({ path: z.string() }),
    result: z.object({ changed: z.boolean() }),
  },
  "session.setMode": {
    params: z.object({ mode: z.enum(["default", "acceptEdits", "plan", "auto"]) }),
    result: z.object({}),
  },
  "catherd.status": {
    params: z.object({}),
    result: z.object({
      version: z.string(),
      runs: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          repo: z.string(),
          live: z.number(),
          roleRuns: z.number(),
          stateTail: z.array(z.string()),
        }),
      ),
    }),
  },
  "runs.list": {
    params: z.object({}),
    result: z.object({ runs: z.array(RunListItemSchema), corrupt: z.number() }),
  },
  "runs.get": { params: z.object({ id: z.string() }), result: RunDetailSchema },
  "runs.reply": { params: z.object({ id: z.string(), name: z.string() }), result: RoleReplySchema },
  "runs.debug": {
    params: z.object({ id: z.string(), name: z.string() }),
    result: z.array(RoleDebugSchema),
  },
  "runs.cancelRole": {
    params: z.object({ id: z.string(), name: z.string() }),
    result: z.object({ status: z.string(), hints: z.array(z.string()) }),
  },
  "profiles.get": {
    params: z.object({ name: z.string().optional() }),
    result: ProfilesStateSchema,
  },
  "profiles.save": {
    params: z.object({
      name: z.string(),
      base: ProfileDocSchema,
      draft: ProfileDocSchema,
      treatLikes: z.array(z.object({ rung: z.string(), like: z.string() })).default([]),
      activate: z.enum(["no", "global", "repo"]).default("no"),
    }),
    result: ProfileSaveResultSchema,
  },
  "profiles.activate": {
    params: z.object({ name: z.string(), scope: z.enum(["global", "repo"]) }),
    result: z.object({ ok: z.literal(true) }),
  },
  "profiles.unbindRepo": { params: z.object({}), result: z.object({ ok: z.literal(true) }) },
  "profiles.create": {
    params: z.object({ name: z.string(), from: z.string().optional() }),
    result: z.object({ ok: z.literal(true) }),
  },
  "profiles.remove": {
    params: z.object({ name: z.string() }),
    result: z.object({ ok: z.literal(true) }),
  },
  "catalog.query": {
    params: z.object({
      role: z.string().optional(),
      backend: z.string().optional(),
      text: z.string().optional(),
      scoredOnly: z.boolean().default(false),
    }),
    result: CatalogResultSchema,
  },
  "catalog.refresh": {
    params: z.object({}),
    result: z.array(
      z.object({
        backend: z.string(),
        models: z.number(),
        error: z.string().optional(),
        fix: z.string().optional(),
      }),
    ),
  },
  "catalog.treatLike": {
    params: z.object({ rung: z.string(), like: z.string() }),
    result: z.object({ ok: z.literal(true) }),
  },
  "diagnostics.openLogs": { params: z.object({}), result: z.object({ ok: z.literal(true) }) },
  "diagnostics.lock": {
    params: z.object({ command: z.string().min(1), slots: z.number().int().positive().optional() }),
    result: z.object({ ok: z.literal(true) }),
  },
  "setup.state": { params: z.object({}), result: SetupStateSchema },
  "setup.check": {
    params: z.object({ readiness: z.boolean().default(false) }),
    result: SetupStateSchema,
  },
  "setup.run": {
    params: z.object({ action: SetupActionIdSchema }),
    result: z.object({ started: z.boolean() }),
  },
  "session.state": { params: z.object({}), result: SessionStateSchema },
  "session.start": {
    params: z.object({
      task: z.string().min(1),
      repo: z.string().optional(),
      permissionMode: z.enum(["default", "acceptEdits", "plan", "auto"]).default("default"),
    }),
    result: SessionStateSchema,
  },
  "session.resume": {
    params: z.object({ repo: z.string().optional() }),
    result: SessionStateSchema,
  },
  "session.send": { params: z.object({ text: z.string().min(1) }), result: z.object({}) },
  "session.interrupt": { params: z.object({}), result: z.object({}) },
  "session.stop": { params: z.object({}), result: SessionStateSchema },
  "session.reset": { params: z.object({}), result: SessionStateSchema },
  "session.answer": {
    params: z.object({ id: z.string(), answer: PromptAnswerSchema }),
    result: z.object({ accepted: z.boolean() }),
  },
} as const;

export type Methods = typeof methods;
export type MethodName = keyof Methods;
export type ParamsOf<M extends MethodName> = z.input<Methods[M]["params"]>;
export type ResultOf<M extends MethodName> = z.infer<Methods[M]["result"]>;

export function isMethodName(name: string): name is MethodName {
  return Object.hasOwn(methods, name);
}

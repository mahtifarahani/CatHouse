import { BILLING_MODES, type CatalogModel, NOTIFY, type ProfileDoc } from "@cathouse/protocol";
import {
  Button,
  cn,
  IconButton,
  inputClass,
  quietSelectClass,
  Segmented,
  Switch,
} from "@cathouse/ui";
import { useState } from "react";
import { t } from "../../lib/strings";
import { Group, NumberField, Row } from "./fields";
import type { Edit } from "./RolesEditor";

/** Everything in a profile besides the roles, as plain labelled rows that save as you change them. */
export function SettingsEditor({
  doc,
  edit,
  models,
  standIns,
}: {
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  standIns: { from: string; to: string; inferred: boolean; note?: string | null }[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Group title={t("profiles.routing")} help={t("profiles.help.routing")}>
        <Row label={t("profiles.objective")}>
          <Segmented
            label={t("profiles.objective")}
            value={doc.objective as "cost" | "speed"}
            options={[
              { value: "cost", label: t("profiles.objective.cost") },
              { value: "speed", label: t("profiles.objective.speed") },
            ]}
            onChange={(v) =>
              edit((d) => {
                d.objective = v;
              })
            }
          />
        </Row>
        <Row label={t("profiles.jev")} hint={t("profiles.jevHint")}>
          <Switch
            className="[&>span:last-child]:hidden"
            label={t("profiles.jev")}
            checked={doc.jev.use !== "off"}
            onChange={(on) =>
              edit((d) => {
                d.jev.use = on ? "auto" : "off";
              })
            }
          />
        </Row>
      </Group>

      <Group title={t("profiles.budget")} help={t("profiles.help.budget")}>
        {(["minutes", "tokens", "usd"] as const).map((k) => (
          <Row key={k} label={t(`profiles.budget.${k}`)}>
            <NumberField
              label={t(`profiles.budget.${k}`)}
              value={doc.budget[k]}
              allowEmpty
              min={k === "usd" ? 0.01 : 1}
              placeholder={t("profiles.noCap")}
              onCommit={(n) =>
                edit((d) => {
                  if (n === undefined) delete d.budget[k];
                  else d.budget[k] = n;
                })
              }
            />
          </Row>
        ))}
      </Group>

      <Group title={t("profiles.timeouts")} help={t("profiles.help.timeouts")}>
        <Row label={t("profiles.idleMin")}>
          <NumberField
            label={t("profiles.idleMin")}
            value={doc.timeouts.idleMin}
            onCommit={(n) =>
              n &&
              edit((d) => {
                d.timeouts.idleMin = n;
              })
            }
          />
        </Row>
        <Row label={t("profiles.wallMin")}>
          <NumberField
            label={t("profiles.wallMin")}
            value={doc.timeouts.wallMin}
            onCommit={(n) =>
              n &&
              edit((d) => {
                d.timeouts.wallMin = n;
              })
            }
          />
        </Row>
        <Row label={t("profiles.heavy")} hint={t("profiles.heavyHint")}>
          <NumberField
            label={t("profiles.heavy")}
            value={typeof doc.heavy === "number" ? doc.heavy : undefined}
            allowEmpty
            placeholder="cpus/2"
            onCommit={(n) =>
              edit((d) => {
                d.heavy = n ?? "cpus/2";
              })
            }
          />
        </Row>
        <Row label={t("profiles.preflightConfirm")}>
          <Switch
            className="[&>span:last-child]:hidden"
            label={t("profiles.preflightConfirm")}
            checked={doc.preflight.confirm}
            onChange={(on) =>
              edit((d) => {
                d.preflight.confirm = on;
              })
            }
          />
        </Row>
      </Group>

      <Failover doc={doc} edit={edit} models={models} standIns={standIns} />

      {Object.keys(doc.billing).length > 0 && (
        <Group title={t("profiles.billing")} help={t("profiles.help.billing")}>
          {Object.entries(doc.billing).map(([k, v]) => (
            <Row key={k} label={k}>
              <select
                aria-label={t("profiles.billingFor", { backend: k })}
                className={cn(quietSelectClass, "text-foreground")}
                value={v}
                onChange={(e) =>
                  edit((d) => {
                    d.billing[k] = e.target.value;
                  })
                }
              >
                {BILLING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Row>
          ))}
        </Group>
      )}

      {Object.keys(doc.isolated).length > 0 && (
        <Group title={t("profiles.harness")} help={t("profiles.help.harness")}>
          {Object.entries(doc.isolated).map(([k, v]) => (
            <Row
              key={k}
              label={t("profiles.isolateBackend", { backend: k })}
              hint={v ? t("profiles.isolated") : t("profiles.ownConfig")}
            >
              <Switch
                className="[&>span:last-child]:hidden"
                label={t("profiles.isolateBackend", { backend: k })}
                checked={v}
                onChange={(on) =>
                  edit((d) => {
                    d.isolated[k] = on;
                  })
                }
              />
            </Row>
          ))}
        </Group>
      )}

      <Group title={t("profiles.notify")} help={t("profiles.help.notify")}>
        {NOTIFY.map((n) => (
          <Row key={n} label={t(`profiles.notify.${n}`)}>
            <Switch
              className="[&>span:last-child]:hidden"
              label={t(`profiles.notify.${n}`)}
              checked={doc.notify.includes(n)}
              onChange={(on) =>
                edit((d) => {
                  d.notify = on ? [...d.notify, n] : d.notify.filter((x) => x !== n);
                })
              }
            />
          </Row>
        ))}
      </Group>
    </div>
  );
}

function Failover({
  doc,
  edit,
  models,
  standIns,
}: {
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  standIns: { from: string; to: string; inferred: boolean; note?: string | null }[];
}) {
  const [fo, setFo] = useState<{ from: string; to: string }>();
  const ladderRungs = [
    ...new Set(
      Object.values(doc.roles)
        .filter((r) => r.enabled)
        .flatMap((r) => r.rungs),
    ),
  ].filter((r) => !r.startsWith("claude:"));
  const allRungs = models.flatMap((m) =>
    m.rungs.filter((r) => r.scored || r.treatLike).map((r) => r.rung),
  );
  return (
    <Group title={t("profiles.failover")} help={t("profiles.help.failover")}>
      {Object.entries(doc.failover).map(([from, to]) => {
        const s = standIns.find((x) => x.from === from && x.to === to);
        const note = s?.note ?? (s?.inferred ? t("profiles.inferred") : undefined);
        return (
          <div
            key={from}
            className="group flex min-h-8 min-w-0 items-center gap-1 rounded-md px-1 hover:bg-surface"
          >
            <span className="min-w-0 flex-1 font-mono text-xs [overflow-wrap:anywhere]">
              {from} → {to}
              {note && <span className="ms-1 font-sans text-muted-foreground">({note})</span>}
            </span>
            <IconButton
              small
              icon="x"
              tone="danger"
              label={t("profiles.removeFailover", { from })}
              onClick={() =>
                edit((d) => {
                  delete d.failover[from];
                })
              }
            />
          </div>
        );
      })}
      {fo ? (
        <div className="mt-1 flex flex-col gap-1.5 rounded-md bg-surface p-2 text-xs">
          <select
            aria-label={t("profiles.failoverFrom")}
            className={cn(inputClass, "w-full min-w-0")}
            value={fo.from}
            onChange={(e) => setFo({ ...fo, from: e.target.value })}
          >
            <option value="">{t("profiles.failoverFrom")}</option>
            {ladderRungs.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            aria-label={t("profiles.failoverTo")}
            className={cn(inputClass, "w-full min-w-0")}
            value={fo.to}
            onChange={(e) => setFo({ ...fo, to: e.target.value })}
          >
            <option value="">{t("profiles.failoverTo")}</option>
            {allRungs
              .filter((r) => r.split(":")[0] !== fo.from.split(":")[0])
              .map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="quiet" onClick={() => setFo(undefined)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!fo.from || !fo.to}
              onClick={() => {
                edit((d) => {
                  d.failover[fo.from] = fo.to;
                });
                setFo(undefined);
              }}
            >
              {t("profiles.add")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="quiet"
          size="sm"
          className="self-start"
          onClick={() => setFo({ from: "", to: "" })}
        >
          + {t("profiles.addFailover")}
        </Button>
      )}
    </Group>
  );
}

import { Button, Icon, inputClass } from "@cathouse/ui";
import { useEffect, useState } from "react";
import { request } from "../../lib/rpc";
import { t } from "../../lib/strings";
import { toast } from "../../lib/toasts";
import { useSetup } from "../../setup/useSetup";
import { Row } from "./fields";

type Which = "jev" | "aa";

/**
 * The optional catherd keys, right under the Jev switch. A saved key shows as saved and is not asked
 * for again (catherd init keeps a saved key and skips its prompt); a missing one gets a masked field
 * that catherd checks before saving. Keys are machine-wide, not per profile.
 */
export function ApiKeyRows({ jevOn }: { jevOn: boolean }) {
  const { state, lastDone } = useSetup();
  const saved = state?.savedKeys;
  if (!saved) return null;
  const busy = state.checking || !!state.running;
  const saving = state.running === "save-api-keys";
  const failed =
    lastDone?.action === "save-api-keys" && !lastDone.ok ? lastDone.message : undefined;
  return (
    <>
      {jevOn && <KeyRow which="jev" saved={saved.jev} busy={busy} saving={saving} />}
      <KeyRow which="aa" saved={saved.aa} busy={busy} saving={saving} />
      {failed && (
        <p role="alert" className="m-0 px-1 text-xs text-danger">
          {failed}
        </p>
      )}
    </>
  );
}

function KeyRow({
  which,
  saved,
  busy,
  saving,
}: {
  which: Which;
  saved: boolean;
  busy: boolean;
  saving: boolean;
}) {
  const [key, setKey] = useState("");
  const [sent, setSent] = useState(false);
  const label = t(which === "jev" ? "setup.jevKey" : "setup.aaKey");
  useEffect(() => {
    if (saved) setKey("");
  }, [saved]);
  useEffect(() => {
    if (!saving) setSent(false);
  }, [saving]);

  if (saved) {
    return (
      <Row label={label} className="ps-4">
        <span className="flex items-center gap-1 text-xs text-success">
          <Icon name="check" />
          {t("profiles.keySaved")}
        </span>
      </Row>
    );
  }
  const value = key.trim();
  return (
    <Row label={label} hint={t("profiles.keyHint")} className="ps-4">
      <form
        className="flex min-w-0 items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !value) return;
          setSent(true);
          void request(
            "setup.saveKeys",
            which === "jev" ? { jevKey: value } : { aaKey: value },
          ).catch(() => {
            setSent(false);
            toast(t("setup.keysError"), "bad");
          });
        }}
      >
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={2048}
          aria-label={label}
          placeholder={t("profiles.keyPlaceholder")}
          className={`${inputClass} w-40 min-w-0`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={busy || !value}>
          {sent && saving ? <Icon name="spinner" /> : null}
          {t("profiles.saveKey")}
        </Button>
      </form>
    </Row>
  );
}

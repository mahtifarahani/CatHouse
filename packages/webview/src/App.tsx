import { cn, Icon, type IconName } from "@cathouse/ui";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { SettingsMenu } from "./lib/settings";
import { type StringKey, t } from "./lib/strings";
import { ToastRegion } from "./lib/toasts";
import { ModelsPage } from "./pages/ModelsPage";
import { ProfilesPage } from "./pages/profile/ProfilesPage";
import { RunsPage } from "./pages/RunsPage";
import { SessionPage } from "./session/SessionPage";
import { SetupPage } from "./setup/SetupPage";
import { useSetup } from "./setup/useSetup";

const TABS = ["session", "runs", "profiles", "models", "setup"] as const;
type Tab = (typeof TABS)[number];
const TAB: Record<Tab, { label: StringKey; icon: IconName }> = {
  session: { label: "tabs.session", icon: "chat" },
  runs: { label: "tabs.runs", icon: "list" },
  profiles: { label: "tabs.profiles", icon: "sliders" },
  models: { label: "tabs.models", icon: "cpu" },
  setup: { label: "tabs.setup", icon: "wrench" },
};

export function App() {
  return (
    <main className="@container flex h-screen min-h-0 flex-col overflow-hidden">
      <Dashboard />
      <ToastRegion />
    </main>
  );
}

interface Nav {
  tab: Tab;
  run?: string | undefined;
}

function Dashboard() {
  const { state } = useSetup();
  const [nav, setNav] = useState<Nav>({ tab: "session" });
  // The plan's gate: until Bun, catherd, the plugin and the bundled Claude are good, only Setup.
  const gateOpen = state?.gateOpen === true;
  const setupNeedsAttention = state?.canStart === false;
  const active: Tab = gateOpen ? nav.tab : "setup";
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabs.current
      ?.querySelector<HTMLButtonElement>(`#tab-${active}`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!gateOpen || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = TABS.indexOf(active);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setNav({ tab: TABS[next] as Tab });
    requestAnimationFrame(() =>
      tabs.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus(),
    );
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex shrink-0 items-center gap-1 px-2 pt-1.5 pb-1">
        {gateOpen ? (
          <div
            ref={tabs}
            role="tablist"
            aria-label={t("tabs.label")}
            onKeyDown={onTabKey}
            className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none]"
          >
            {TABS.map((id) => {
              const selected = active === id;
              const label = t(TAB[id].label);
              return (
                <button
                  key={id}
                  id={`tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`panel-${id}`}
                  aria-label={
                    id === "setup" && setupNeedsAttention
                      ? `${label}: ${t("status.failed")}`
                      : label
                  }
                  title={label}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setNav({ tab: id })}
                  className={cn(
                    "relative inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md px-2 whitespace-nowrap",
                    selected
                      ? "bg-surface-hover text-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                >
                  <Icon name={TAB[id].icon} />
                  {/* Icon-only in a narrow sidebar; labels come back when there is room. */}
                  <span className="hidden @[30rem]:inline">{label}</span>
                  {id === "setup" && setupNeedsAttention && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 end-1 size-1.5 rounded-full bg-danger"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <h1 className="m-0 flex flex-1 items-center gap-1.5 px-1 text-base font-semibold">
            <Icon name="cat" />
            CatHouse
          </h1>
        )}
        <SettingsMenu />
      </nav>
      <div
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={gateOpen ? `tab-${active}` : undefined}
        className={cn(
          "min-h-0 flex-1",
          active === "session" ? "overflow-hidden" : "overflow-auto px-3 pt-2 pb-4",
        )}
      >
        {active === "setup" && <SetupPage />}
        {active === "session" && (
          <SessionPage canStart={state?.canStart === true} blockedReason={state?.canStartReason} />
        )}
        {active === "runs" && (
          <RunsPage
            openRun={nav.run}
            onOpenRun={(run) => setNav({ tab: "runs", run })}
            onChat={() => setNav({ tab: "session" })}
            canStart={state?.canStart === true}
          />
        )}
        {active === "profiles" && <ProfilesPage />}
        {active === "models" && <ModelsPage />}
      </div>
    </div>
  );
}

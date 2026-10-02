export interface OverviewPageProps {
  canStart: boolean;
  selectedRun: string | undefined;
  onSelectRun: (id: string | undefined) => void;
  onOpenChat: () => void;
  onGo: (tab: "setup" | "profiles") => void;
}

export function OverviewPage(_props: OverviewPageProps) {
  return <p className="text-muted-foreground">Overview</p>;
}

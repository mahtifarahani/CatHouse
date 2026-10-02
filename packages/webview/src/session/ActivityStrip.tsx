import type { SessionState } from "@cathouse/protocol";

export interface ActivityStripProps {
  session: SessionState;
  onOpenRun?: ((id: string) => void) | undefined;
}

export function ActivityStrip(_props: ActivityStripProps) {
  return <p className="text-muted-foreground">Activity</p>;
}

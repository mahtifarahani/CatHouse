import type { ResultOf } from "@cathouse/protocol";

export type Workspace = ResultOf<"app.workspace">;
export interface RepoMenuProps {
  workspace: Workspace | undefined;
  locked: boolean;
  sessionRepo?: string | undefined;
  onChanged: () => void;
  onError: (message: string) => void;
}

export function RepoMenu(_props: RepoMenuProps) {
  return <p className="text-muted-foreground">Repository</p>;
}

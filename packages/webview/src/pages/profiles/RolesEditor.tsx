import type { CatalogModel, ProfileDoc } from "@cathouse/protocol";
import type { Edit, StandIn } from "./types";

export interface RolesEditorProps {
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  enforcement: Record<string, string>;
  standIns: StandIn[];
  filter: string;
}

export function RolesEditor(_props: RolesEditorProps) {
  return <p className="text-muted-foreground">Roles and models</p>;
}

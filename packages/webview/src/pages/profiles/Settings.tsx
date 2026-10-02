import type { CatalogModel, ProfileDoc } from "@cathouse/protocol";
import type { Edit, StandIn } from "./types";

export interface SettingsProps {
  doc: ProfileDoc;
  edit: Edit;
  models: CatalogModel[];
  standIns: StandIn[];
  filter: string;
}

export function BasicSettings(_props: SettingsProps) {
  return <p className="text-muted-foreground">Basics</p>;
}

export function AdvancedSettings(_props: SettingsProps) {
  return <p className="text-muted-foreground">Advanced</p>;
}

import type { ProfileDoc, ProfilesState } from "@cathouse/protocol";

export type TreatLike = { rung: string; like: string };
export type Edit = (fn: (d: ProfileDoc) => void, treatLike?: TreatLike) => void;
export type StandIn = ProfilesState["standIns"][number];

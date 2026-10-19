export type VarType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

export type VarValue =
  | { kind: "alias"; targetId: string }
  | { kind: "literal"; value: string | number | boolean }
  | { kind: "none" };

export interface VarSnap {
  id: string;
  name: string;
  collectionId: string;
  type: VarType;
  scopes: string[];
  value: VarValue;
}

export interface CollectionMeta {
  kind?: "system" | "theme";
  system?: string;
  systemVersion?: number;
  theme?: string;
  schemaVersion?: number;
  isDefault?: boolean;
}

export interface CollectionSnap {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  meta: CollectionMeta;
  variableIds: string[];
}

export interface Snapshot {
  rootSystem: string | null;
  collections: CollectionSnap[];
  variables: Record<string, VarSnap>;
}

export const THEME_PREFIX = "Theme / ";
export const systemCollectionName = (label: string) => `Saider / ${label}`;
export const themeCollectionName = (theme: string) => THEME_PREFIX + theme;

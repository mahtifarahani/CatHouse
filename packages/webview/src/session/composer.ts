export interface ComposerKey {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}

export function shouldSubmitComposer({ key, shiftKey, isComposing }: ComposerKey) {
  return key === "Enter" && !shiftKey && !isComposing;
}

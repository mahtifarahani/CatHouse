export interface RunDetailProps {
  id: string;
  canStart: boolean;
  showBack: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export function RunDetail(_props: RunDetailProps) {
  return <p className="text-muted-foreground">Run detail</p>;
}

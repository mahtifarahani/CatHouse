import { Card } from "@cathouse/ui";
import { useEffect, useState } from "react";

type Tone = "ok" | "bad" | "info";
type Toast = { id: number; tone: Tone; text: string };
const EVENT = "cathouse:toast";

export function toast(text: string, tone: Tone = "info"): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone } }));
}

export function ToastRegion() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string; tone: Tone }>).detail;
      const id = Date.now() + Math.random();
      setItems((old) => [...old.slice(-3), { id, ...detail }]);
      window.setTimeout(() => setItems((old) => old.filter((x) => x.id !== id)), 5000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div
      className="pointer-events-none fixed end-3 top-3 z-50 flex max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => (
        <Card
          key={item.id}
          role={item.tone === "bad" ? "alert" : "status"}
          className={`bg-background shadow ${
            item.tone === "bad"
              ? "border-danger text-danger"
              : item.tone === "ok"
                ? "border-success text-success"
                : "border-info text-info"
          }`}
        >
          {item.text}
        </Card>
      ))}
    </div>
  );
}

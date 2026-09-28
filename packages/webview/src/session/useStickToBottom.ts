import { useCallback, useEffect, useRef, useState } from "react";

/** How close to the bottom (px) still counts as "following" the transcript. */
const THRESHOLD = 48;

/**
 * Keeps a scroll container pinned to its newest content while the user is at the bottom.
 * Scrolling up releases the pin; scrolling back down (or `jump()`) restores it.
 */
export function useStickToBottom<S extends HTMLElement, C extends HTMLElement>() {
  const scrollRef = useRef<S>(null);
  const contentRef = useRef<C>(null);
  const pinned = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const jump = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = true;
    setAtBottom(true);
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
      pinned.current = near;
      setAtBottom(near);
    };
    const follow = () => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    };
    const observer = new ResizeObserver(follow);
    observer.observe(content);
    observer.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    follow();
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  return { scrollRef, contentRef, atBottom, jump };
}

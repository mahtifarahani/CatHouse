import { cn } from "@cathouse/ui";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ className, ...props }) => (
    <a
      {...props}
      className={cn("text-link underline underline-offset-2", className)}
      target="_blank"
      rel="noreferrer"
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      {...props}
      className={cn("my-2 border-s-2 border-border ps-3 text-muted-foreground", className)}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      {...props}
      className={cn("rounded-sm bg-secondary px-1 py-0.5 font-mono text-[0.9em]", className)}
    />
  ),
  h1: (props) => <h1 {...props} className="mt-4 mb-2 text-xl font-semibold first:mt-0" />,
  h2: (props) => <h2 {...props} className="mt-4 mb-2 text-lg font-semibold first:mt-0" />,
  h3: (props) => <h3 {...props} className="mt-3 mb-1 font-semibold first:mt-0" />,
  hr: (props) => <hr {...props} className="my-3 border-border" />,
  ol: ({ className, ...props }) => (
    <ol {...props} className={cn("my-2 list-decimal space-y-1 ps-5", className)} />
  ),
  p: ({ className, ...props }) => (
    <p {...props} className={cn("my-2 leading-relaxed first:mt-0 last:mb-0", className)} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      {...props}
      className={cn(
        "my-2 max-w-full overflow-auto rounded-sm border border-border bg-background p-2 font-mono text-xs [&>code]:bg-transparent [&>code]:p-0",
        className,
      )}
    />
  ),
  table: ({ className, ...props }) => (
    <table
      {...props}
      className={cn("my-2 block max-w-full overflow-auto border-collapse", className)}
    />
  ),
  td: ({ className, ...props }) => (
    <td {...props} className={cn("border border-border px-2 py-1 align-top", className)} />
  ),
  th: ({ className, ...props }) => (
    <th
      {...props}
      className={cn(
        "border border-border bg-secondary px-2 py-1 text-start font-semibold",
        className,
      )}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul {...props} className={cn("my-2 list-disc space-y-1 ps-5", className)} />
  ),
};

export function MarkdownText({
  children,
  className,
}: Pick<ComponentPropsWithoutRef<"div">, "children" | "className">) {
  return (
    <div className={cn("min-w-0 break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {typeof children === "string" ? children : ""}
      </ReactMarkdown>
    </div>
  );
}

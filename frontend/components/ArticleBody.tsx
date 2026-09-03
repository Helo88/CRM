import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Locale } from "@/lib/locale";

// The ONE place help-article Markdown is rendered — used by the admin
// preview (Story 30) and the public article page (Story 31), so an admin's
// preview is byte-for-byte what a customer sees.
//
// SECURITY: no rehype-raw, deliberately. react-markdown renders raw HTML
// inside the source as inert text unless that plugin is added, which means
// this component has no HTML-injection surface at all and needs no
// sanitiser. Do not add rehype-raw here or anywhere else — see
// .squad/plans/knowledge-base/30-story-write-and-organize-help-articles.md,
// "Design decision 2".
export function ArticleBody({ markdown, lang }: { markdown: string; lang: Locale }) {
  return (
    <div
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="prose-kb max-w-none text-sm leading-7 text-foreground"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h2 className="mt-6 mb-2 text-lg font-bold tracking-tight first:mt-0" {...props} />,
          h2: (props) => <h2 className="mt-6 mb-2 text-lg font-bold tracking-tight first:mt-0" {...props} />,
          h3: (props) => <h3 className="mt-5 mb-2 text-base font-semibold first:mt-0" {...props} />,
          p: (props) => <p className="mb-4 last:mb-0" {...props} />,
          ul: (props) => <ul className="mb-4 ms-5 list-disc space-y-1" {...props} />,
          ol: (props) => <ol className="mb-4 ms-5 list-decimal space-y-1.5 marker:font-semibold marker:text-primary" {...props} />,
          a: (props) => (
            <a
              className="text-primary underline underline-offset-4 hover:text-primary/80"
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel={props.href?.startsWith("http") ? "noreferrer noopener" : undefined}
              {...props}
            />
          ),
          code: (props) => <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em]" {...props} />,
          pre: (props) => <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs" {...props} />,
          blockquote: (props) => (
            <blockquote className="mb-4 border-s-2 border-primary/40 ps-3 text-muted-foreground" {...props} />
          ),
          table: (props) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => <th className="border border-border bg-muted px-2 py-1.5 text-start font-semibold" {...props} />,
          td: (props) => <td className="border border-border px-2 py-1.5" {...props} />,
          // Design decision 3: images are arbitrary-host external URLs, so
          // next/image (which needs remotePatterns enumerated) doesn't fit —
          // a plain <img> is correct here, not an oversight.
          img: ({ alt, src }) =>
            !src ? null : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt ?? ""}
                loading="lazy"
                className="mb-4 h-auto max-w-full rounded-lg border border-border"
              />
            ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

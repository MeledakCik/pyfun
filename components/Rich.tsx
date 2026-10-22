/** Teks biasa dengan `kode` inline, dipecah per paragraf. */
export function Rich({ text, className = "" }: { text: string; className?: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className={className}>
          {para.split(/(`[^`]+`)/g).map((part, j) =>
            part.startsWith("`") && part.endsWith("`") ? (
              <code key={j} className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[0.9em] text-lime">{part.slice(1, -1)}</code>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="scroll-thin overflow-x-auto rounded-2xl bg-sunk p-4 font-mono text-sm leading-6 text-ink">{code}</pre>
  );
}

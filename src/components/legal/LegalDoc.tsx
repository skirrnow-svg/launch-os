import { LEGAL, LEGAL_PLACEHOLDERS_PRESENT } from "@/lib/legal";

/**
 * Presentational shell for a /legal/* document. Content is passed as DATA
 * (arrays of blocks) rather than JSX children, so policy prose — full of
 * apostrophes and quotes — lives in JS strings and never trips the
 * react/no-unescaped-entities build gate.
 */
export type Block = {
  h?: string; // section heading (h2)
  sub?: string; // sub-heading (h3)
  p?: string[]; // paragraphs
  ul?: string[]; // bullet list
  ol?: string[]; // numbered list
};

export function LegalDoc({
  title,
  intro,
  blocks,
}: {
  title: string;
  intro?: string;
  blocks: Block[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {LEGAL.updated}</p>

      {LEGAL_PLACEHOLDERS_PRESENT && (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong className="font-semibold">Draft — pending company details.</strong> Fields shown in
          square brackets (legal name, CIN, registered address, governing city) must be filled in{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.85em]">src/lib/legal.ts</code>{" "}
          before this policy is relied upon or submitted to a payment gateway.
        </div>
      )}

      {intro && <p className="mt-6 text-[15px] leading-relaxed text-slate-600">{intro}</p>}

      <div className="mt-8 space-y-7">
        {blocks.map((b, i) => (
          <section key={i}>
            {b.h && (
              <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">{b.h}</h2>
            )}
            {b.sub && <h3 className="mt-3 font-display text-base font-semibold text-slate-800">{b.sub}</h3>}
            {b.p?.map((para, j) => (
              <p key={j} className="mt-3 text-[15px] leading-relaxed text-slate-600">
                {para}
              </p>
            ))}
            {b.ul && (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-600">
                {b.ul.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            )}
            {b.ol && (
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-slate-600">
                {b.ol.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <div className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        Questions about this policy? Contact{" "}
        <a href={`mailto:${LEGAL.contactEmail}`} className="text-accent hover:underline">
          {LEGAL.contactEmail}
        </a>
        .
      </div>
    </article>
  );
}

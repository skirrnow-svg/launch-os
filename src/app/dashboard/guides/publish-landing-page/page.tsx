import Link from "next/link";

export const metadata = {
  title: "Publish your landing page · SkirrNow",
  description: "How to take a generated landing page live on your own domain.",
};

/**
 * Creator guide — how to publish a generated landing page on your own domain.
 * A real in-app page (replaces the earlier external artifact link) so the guide
 * ships with the product and stays under the same auth + design system.
 * Static server component; no data fetching.
 */
const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800">
    {children}
  </code>
);

const Pre = ({ children }: { children: React.ReactNode }) => (
  <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-100">
    {children}
  </pre>
);

export default function PublishLandingPageGuide() {
  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/projects" className="text-sm text-accent hover:underline">
        &larr; Projects
      </Link>

      <div className="mt-3">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Creator guide</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
          Publish your landing page on your own domain
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Every page you generate is a single, self-contained HTML file &mdash; no server, no build
          step, no external assets. Download it, drop it on any host, and point your domain at it.
          Here&apos;s the fastest way, plus a few alternatives.
        </p>
      </div>

      {/* What you have */}
      <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">What you actually have</p>
        <p className="mt-1.5 text-sm text-slate-700">
          One <Code>.html</Code> file with all styling baked inside it. It renders identically on any
          host, opens in any browser, and works offline. Nothing to &ldquo;install&rdquo; &mdash;
          it&apos;s just a web page.
        </p>
      </div>

      {/* 01 Get the file */}
      <section className="mt-10">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-slate-400">01</span>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">Get the file</h2>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Open your project &rarr; <strong className="font-semibold text-slate-800">Landing Pages</strong>.</li>
            <li>Hit <strong className="font-semibold text-slate-800">Preview</strong> to check it looks right.</li>
            <li>Click <strong className="font-semibold text-slate-800">Download</strong> &mdash; it saves as <Code>your-page-title.html</Code>.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-600">
            Tip: to serve the page at the clean root of a domain (<Code>https://yourbrand.com</Code>),
            rename the file to <Code>index.html</Code>. Hosts serve <Code>index.html</Code> automatically.
          </p>
          <Pre>mv your-page-title.html index.html</Pre>
        </div>
      </section>

      {/* 02 Put it online */}
      <section className="mt-10">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-slate-400">02</span>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">Put it online &mdash; pick one</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">These are alternatives, easiest first. Any one publishes the same file.</p>

        <div className="mt-3 grid gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded bg-accent font-mono text-xs font-bold text-slate-900">A</span>
              <h3 className="font-display text-base font-semibold text-slate-900">Drag-and-drop static host</h3>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">Fastest &middot; free</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Go to <strong className="font-semibold text-slate-800">Netlify Drop</strong> (<Code>app.netlify.com/drop</Code>),
              <strong className="font-semibold text-slate-800"> Cloudflare Pages</strong>, or
              <strong className="font-semibold text-slate-800"> Vercel</strong> and drag the file onto the page. You get a
              live URL in seconds. Then open the site&apos;s <strong className="font-semibold text-slate-800">Domains</strong>{" "}
              settings and add your own domain or subdomain &mdash; it walks you through the DNS record to add at your registrar.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded bg-accent font-mono text-xs font-bold text-slate-900">B</span>
              <h3 className="font-display text-base font-semibold text-slate-900">Your existing web host</h3>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">cPanel &middot; File Manager</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Log in to your hosting control panel &rarr; <strong className="font-semibold text-slate-800">File Manager</strong>.
              Upload the file into <Code>public_html</Code> (or a subfolder).
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>As <Code>index.html</Code> in <Code>public_html</Code> &rarr; lives at <Code>https://yourdomain.com</Code></li>
              <li>As <Code>sale.html</Code> in <Code>public_html</Code> &rarr; lives at <Code>https://yourdomain.com/sale.html</Code></li>
              <li>In folder <Code>public_html/launch/</Code> as <Code>index.html</Code> &rarr; <Code>https://yourdomain.com/launch/</Code></li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded bg-accent font-mono text-xs font-bold text-slate-900">C</span>
              <h3 className="font-display text-base font-semibold text-slate-900">WordPress site</h3>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">No FTP needed</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Create a new <strong className="font-semibold text-slate-800">Page</strong>, add a{" "}
              <strong className="font-semibold text-slate-800">Custom HTML</strong> block, and paste the file&apos;s contents in.
              Or, for a pixel-perfect standalone page, upload the <Code>.html</Code> via a file-manager plugin and link straight to it.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded bg-accent font-mono text-xs font-bold text-slate-900">D</span>
              <h3 className="font-display text-base font-semibold text-slate-900">GitHub Pages</h3>
              <span className="rounded-full border border-slate-200 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-400">Free &middot; a little technical</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Create a repository, add the file as <Code>index.html</Code>, then{" "}
              <strong className="font-semibold text-slate-800">Settings &rarr; Pages</strong> and enable it. Add your custom
              domain there and GitHub creates the <Code>CNAME</Code> for you.
            </p>
          </div>
        </div>
      </section>

      {/* 03 Point your domain */}
      <section className="mt-10">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-slate-400">03</span>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">Point your domain</h2>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            Most creators use a <strong className="font-semibold text-slate-800">subdomain</strong> for a campaign &mdash;
            clean, and it never touches your main site. In your domain registrar&apos;s DNS settings, add a{" "}
            <strong className="font-semibold text-slate-800">CNAME</strong> record pointing the subdomain at the host:
          </p>
          <Pre>{`Type    Name     Value
CNAME   offer    your-site.netlify.app`}</Pre>
          <p className="mt-3 text-sm text-slate-600">
            That makes <Code>https://offer.yourbrand.com</Code> serve the page. For a{" "}
            <strong className="font-semibold text-slate-800">root domain</strong> (<Code>yourbrand.com</Code>), follow the
            host&apos;s &ldquo;add a custom domain&rdquo; steps &mdash; they&apos;ll give you the exact A/ALIAS record. DNS
            changes can take a few minutes to a few hours to go live.
          </p>
        </div>
      </section>

      {/* 04 Before you publish */}
      <section className="mt-10">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-slate-400">04</span>
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">Before you publish</h2>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5">
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-bold text-accent">&rarr;</span>
              <span><strong className="font-semibold text-slate-800">Wire up the call-to-action.</strong> Open the file in any text editor and set the button&apos;s link (<Code>href</Code>) to your real destination &mdash; a form, WhatsApp (<Code>https://wa.me/&hellip;</Code>), checkout, or booking link.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-bold text-accent">&rarr;</span>
              <span><strong className="font-semibold text-slate-800">Check the tab title &amp; description.</strong> Edit the <Code>{"<title>"}</Code> and meta description near the top so it reads well when shared.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-bold text-accent">&rarr;</span>
              <span><strong className="font-semibold text-slate-800">Add analytics (optional).</strong> Paste your Google Analytics or Meta Pixel snippet just before the closing <Code>{"</body>"}</Code> tag.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-bold text-accent">&rarr;</span>
              <span><strong className="font-semibold text-slate-800">Add a favicon (optional).</strong> Drop a <Code>{'<link rel="icon">'}</Code> in the <Code>{"<head>"}</Code> for your logo in the browser tab.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-bold text-accent">&rarr;</span>
              <span><strong className="font-semibold text-slate-800">Nothing else to fix.</strong> The file is fully self-contained &mdash; there are no image or stylesheet paths that can break when you move it.</span>
            </li>
          </ul>
        </div>
      </section>

      <div className="mt-10 border-t border-slate-200 pt-5 text-sm text-slate-500">
        The page is a static file, so it&apos;s fast, cheap to host, and yours to edit freely. One-click
        hosted publishing straight from SkirrNow &mdash; with your domain mapped automatically &mdash; is
        on the roadmap.
      </div>
    </div>
  );
}

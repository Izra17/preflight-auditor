'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-950 px-6 text-center text-ink-50">
        <p className="text-lg font-medium">Something went wrong</p>
        <p className="max-w-sm text-sm text-ink-400">
          PreFlight hit an unexpected error. This has not affected any other in-progress audits.
        </p>
        <button onClick={() => reset()} className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
          Try again
        </button>
      </body>
    </html>
  );
}

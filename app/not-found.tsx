export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-medium text-ink-100">Audit not found</p>
      <p className="max-w-sm text-sm text-ink-400">This audit may have expired, or the link is incorrect.</p>
      <a href="/" className="mt-2 text-accent-bright underline underline-offset-4">
        Run a new audit
      </a>
    </main>
  );
}

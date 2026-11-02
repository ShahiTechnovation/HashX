import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center animate-fade-in">
        <LogoMark size={32} className="mx-auto" />
        <p className="eyebrow mt-8 tabular-nums">404 · Not found</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.025em] text-foreground">
          There&apos;s no record at this address
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground-secondary">
          The invoice, settlement, or receipt you&apos;re looking for doesn&apos;t exist in this environment. It may belong to a
          different mode, or the link may be incomplete.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2">
          <Link href="/app" className={buttonStyles({ variant: "primary" })}>
            Go to overview
          </Link>
          <Link href="/" className={buttonStyles({ variant: "ghost" })}>
            HashX home
          </Link>
        </div>
      </div>
    </main>
  );
}

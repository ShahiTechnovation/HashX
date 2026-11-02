import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { Reveal } from "./primitives";

export function CTASection() {
  return (
    <section aria-labelledby="cta-title" className="pb-[clamp(4rem,2.5rem+6vw,8.5rem)]">
      <div className="site-container">
        <Reveal className="relative overflow-hidden rounded-2xl border border-primary/10 bg-primary-subtle/70 px-6 py-14 sm:px-12 sm:py-20 lg:px-16">
          <div className="relative z-10 max-w-[640px]">
            <h2 id="cta-title" className="text-display-lg font-medium text-foreground text-balance">
              Give every agent payment a reason to be trusted.
            </h2>
            <p className="mt-5 text-lede text-foreground-secondary">Explore the verification workflow behind HashX.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <Link href="/app" className={cn(buttonStyles({ variant: "primary", size: "lg" }), "group")}>
                Open HashX
                <ArrowRight className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link href="/app/developers" className="group inline-flex items-center justify-center gap-1.5 text-[15px] font-medium text-foreground">
                Explore Developer Tools
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
          {/* One static brand element. */}
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 hidden opacity-95 md:block lg:-bottom-6 lg:right-10">
            <LogoMark size={280} decorative />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

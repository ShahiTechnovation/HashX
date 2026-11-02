import { SiteHeader } from "@/components/marketing/SiteHeader";
import { HeroSection, TrustStrip } from "@/components/marketing/HeroSection";
import { ProcessTimeline } from "@/components/marketing/ProcessTimeline";
import { InteractiveProductPreview } from "@/components/marketing/InteractiveProductPreview";
import { EditorialFeatures } from "@/components/marketing/EditorialFeatures";
import { SecurityScenarios } from "@/components/marketing/SecurityScenarios";
import { IntegrationPreview } from "@/components/marketing/IntegrationPreview";
import { SettlementRails } from "@/components/marketing/SettlementRails";
import { FAQAccordion } from "@/components/marketing/FAQAccordion";
import { CTASection } from "@/components/marketing/CTASection";
import { SiteFooter } from "@/components/marketing/SiteFooter";

/** Marketing home. A server component; only the interactive sections hydrate. */
export default function MarketingHomePage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-surface-1 focus:px-3 focus:py-2 focus:text-sm focus:shadow-overlay"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <HeroSection />
        <TrustStrip />
        <ProcessTimeline />
        <InteractiveProductPreview />
        <EditorialFeatures />
        <SecurityScenarios />
        <IntegrationPreview />
        <SettlementRails />
        <FAQAccordion />
        <CTASection />
      </main>
      <SiteFooter />
    </>
  );
}

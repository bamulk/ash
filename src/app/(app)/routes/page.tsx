import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Routes — Ashley Stone Homes" };

// Route planners live as standalone HTML files in /public so they work
// offline-ish, load Leaflet from CDN, and can be opened full-screen on a
// phone. This page wraps the current one in the app chrome.
const PLANNER = {
  src: "/house-tour-route-planner.html",
  title: "Saturday Showings — Sat Jul 11, 2026",
  subtitle: "5 houses · starting from Fair Oaks",
};

export default function RoutesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Routes"
        subtitle={PLANNER.subtitle}
        actions={
          <a
            href={PLANNER.src}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-brand text-white hover:bg-brand-hover"
          >
            <ExternalLink size={14} />
            Open full screen
          </a>
        }
      />
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <iframe
          src={PLANNER.src}
          title={PLANNER.title}
          className="w-full border-0"
          style={{ height: "calc(100dvh - 14rem)", minHeight: "480px" }}
        />
      </div>
    </div>
  );
}

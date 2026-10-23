import Link from "next/link";
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

// Flat, hairline-bordered, no radius — matches ashleystonehomes.com's
// gallery-signage feel. Primary is near-black with off-white ink.
const base =
  "inline-flex items-center justify-center gap-2 font-medium select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand disabled:opacity-50 disabled:pointer-events-none tracking-tight";

const variants: Record<Variant, string> = {
  primary:
    "bg-foreground text-background hover:bg-brand hover:text-brand-ink",
  secondary:
    "bg-surface text-foreground border border-border-strong hover:bg-foreground hover:text-background",
  ghost:
    "text-muted hover:text-foreground hover:bg-sand",
  danger:
    "bg-surface text-brand border border-brand hover:bg-brand hover:text-brand-ink",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  href,
  children,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`bg-surface border border-border-strong ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row pb-4 border-b border-border-strong">
      <div>
        <h1 className="text-3xl text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-border px-3 py-2 text-sm text-foreground bg-surface";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />
  );
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="eyebrow block">{label}</span>
      {children}
      {hint && (
        <span className="block text-xs text-soft">{hint}</span>
      )}
    </label>
  );
}

// Keep badge semantics but recolor to a flat, hairline look that reads on
// the cream page without competing with the Jost headings.
const badgeColors: Record<string, string> = {
  buyer: "bg-sand text-foreground border border-border-strong",
  seller: "bg-accent text-accent-ink border border-accent",
  both: "bg-brand text-brand-ink border border-brand",
  planned: "bg-sand text-muted border border-border",
  in_progress: "bg-surface text-foreground border border-border-strong",
  done: "bg-accent text-accent-ink border border-accent",
  overdue: "bg-brand text-brand-ink border border-brand",
};

export function Badge({
  children,
  tone = "planned",
  className = "",
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${
        badgeColors[tone] ?? badgeColors.planned
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-4 border border-border bg-surface">
      <p className="text-foreground text-lg">{title}</p>
      {description && (
        <p className="text-sm text-muted mt-1 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

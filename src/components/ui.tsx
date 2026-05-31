import Link from "next/link";
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-hover shadow-sm shadow-slate-900/20",
  secondary:
    "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm",
  ghost:
    "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800",
  danger:
    "bg-white dark:bg-slate-900 text-red-600 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5",
  md: "text-sm px-3.5 py-2",
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
      className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm shadow-slate-900/[0.02] ${className}`}
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
    <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
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
  "w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100";

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
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}

const badgeColors: Record<string, string> = {
  buyer: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-blue-200 dark:ring-blue-900",
  seller: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900",
  both: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-900",
  planned: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-700",
  in_progress: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-900",
  done: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900",
  overdue: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-900",
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
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
    <div className="text-center py-16 px-4">
      <p className="text-slate-900 dark:text-slate-100 font-medium">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

"use client";

/** Submits the surrounding form when a control inside it changes. The form still works without JavaScript. */
export function AutoSubmit({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onChange={(e) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        if (target.dataset.autosubmit === "off") return;
        target.form?.requestSubmit();
      }}
    >
      {children}
    </div>
  );
}

import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  testId?: string;
  children?: ReactNode;
}

export default function PageHeader({ eyebrow, title, description, testId, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="space-y-2">
        {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
        <h1 className="t-display" data-testid={testId}>
          {title}
        </h1>
        {description && (
          <p className="t-muted">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

const clamp = (value: number) => {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(({ className, value = 0, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800/60', className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 transition-all duration-500"
        style={{ width: `${clamp(value)}%` }}
      />
    </div>
  );
});
Progress.displayName = 'Progress';

export { Progress };

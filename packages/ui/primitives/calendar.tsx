import * as React from 'react';

import { DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '../lib/utils';
import { buttonVariants } from './button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const defaultClassNames = getDefaultClassNames();

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      navLayout="after"
      classNames={{
        ...defaultClassNames,
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption_label: 'hidden',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        dropdown:
          'bg-background text-foreground border border-input rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring',
        dropdown_month: 'mr-1',
        dropdown_year: 'ml-1 w-[80px]',
        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';

export { Calendar };

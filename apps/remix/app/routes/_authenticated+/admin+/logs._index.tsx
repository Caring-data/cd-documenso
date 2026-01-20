import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { FileText, Loader } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { LogCategory, LogLevel } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Badge } from '@documenso/ui/primitives/badge';
import type { DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { DataTable } from '@documenso/ui/primitives/data-table';
import { DataTablePagination } from '@documenso/ui/primitives/data-table-pagination';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'bg-gray-500',
  [LogLevel.INFO]: 'bg-blue-500',
  [LogLevel.WARN]: 'bg-yellow-500',
  [LogLevel.ERROR]: 'bg-red-500',
  [LogLevel.CRITICAL]: 'bg-red-700',
};

const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  [LogCategory.DOCUMENT]: 'Document',
  [LogCategory.TEMPLATE]: 'Template',
  [LogCategory.AUTHENTICATION]: 'Authentication',
  [LogCategory.INTEGRATION]: 'Integration',
  [LogCategory.SYSTEM]: 'System',
  [LogCategory.JOB]: 'Job',
};

export default function AdminLogsPage() {
  const { _, i18n } = useLingui();

  const [searchParams] = useSearchParams();
  const updateSearchParams = useUpdateSearchParams();

  const page = searchParams?.get?.('page') ? Number(searchParams.get('page')) : undefined;
  const perPage = searchParams?.get?.('perPage') ? Number(searchParams.get('perPage')) : undefined;
  const level = searchParams?.get?.('level') as LogLevel | undefined;
  const category = searchParams?.get?.('category') as LogCategory | undefined;
  const actionFromUrl = searchParams?.get?.('action') ?? '';

  const [actionTerm, setActionTerm] = useState(actionFromUrl);
  const debouncedActionTerm = useDebouncedValue(actionTerm, 500);

  // Sync actionTerm with URL params when URL changes externally (e.g., browser back/forward)
  useEffect(() => {
    const urlAction = searchParams?.get?.('action') ?? '';
    if (urlAction !== actionTerm) {
      setActionTerm(urlAction);
    }
  }, [actionFromUrl]);

  // Update URL when debounced term changes (but avoid if it's already in URL)
  useEffect(() => {
    if (debouncedActionTerm !== actionFromUrl) {
      updateSearchParams({
        action: debouncedActionTerm || undefined,
        page: 1,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedActionTerm]);

  const { data: findLogsData, isPending: isFindLogsLoading } = trpc.log.find.useQuery(
    {
      query: debouncedActionTerm || undefined,
      level: level,
      category: category,
      page: page || 1,
      perPage: perPage || 30,
    },
    {
      placeholderData: (previousData) => previousData,
      enabled: true,
    },
  );

  const results = findLogsData ?? {
    data: [],
    perPage: 30,
    currentPage: 1,
    totalPages: 1,
    count: 0,
  };

  const columns = useMemo(() => {
    return [
      {
        header: _(msg`Created`),
        accessorKey: 'createdAt',
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: _(msg`Level`),
        accessorKey: 'level',
        cell: ({ row }) => {
          const logLevel = row.original.level;
          return (
            <Badge className={LOG_LEVEL_COLORS[logLevel]}>
              {logLevel}
            </Badge>
          );
        },
      },
      {
        header: _(msg`Category`),
        accessorKey: 'category',
        cell: ({ row }) => {
          return LOG_CATEGORY_LABELS[row.original.category] || row.original.category;
        },
      },
      {
        header: _(msg`Action`),
        accessorKey: 'action',
        cell: ({ row }) => {
          return (
            <div className="max-w-[200px] truncate" title={row.original.action}>
              {row.original.action}
            </div>
          );
        },
      },
      {
        header: _(msg`Message`),
        accessorKey: 'message',
        cell: ({ row }) => {
          const message = row.original.message;
          if (!message) {
            return <span className="text-muted-foreground text-sm">-</span>;
          }
          return (
            <div className="max-w-[300px] truncate" title={message}>
              {message}
            </div>
          );
        },
      },
      {
        header: _(msg`User`),
        accessorKey: 'user',
        cell: ({ row }) => {
          const user = row.original.user;
          if (!user) {
            return <span className="text-muted-foreground text-sm">-</span>;
          }
          return (
            <Link
              to={`/admin/users/${user.id}`}
              className="hover:underline"
            >
              {user.email}
            </Link>
          );
        },
      },
      {
        header: _(msg`Envelope`),
        accessorKey: 'envelope',
        cell: ({ row }) => {
          const envelope = row.original.envelope;
          if (!envelope) {
            return <span className="text-muted-foreground text-sm">-</span>;
          }
          return (
            <Link
              to={`/admin/documents/${envelope.id}`}
              className="hover:underline"
            >
              {envelope.title}
            </Link>
          );
        },
      },
    ] satisfies DataTableColumnDef<(typeof results)['data'][number]>[];
  }, []);

  const onPaginationChange = (newPage: number, newPerPage: number) => {
    updateSearchParams({
      page: newPage,
      perPage: newPerPage,
    });
  };

  const onLevelChange = (value: string) => {
    updateSearchParams({
      level: value === 'all' ? undefined : value,
      page: 1,
    });
  };

  const onCategoryChange = (value: string) => {
    updateSearchParams({
      category: value === 'all' ? undefined : value,
      page: 1,
    });
  };

  return (
    <div>
      <h2 className="text-4xl font-semibold">
        <Trans>System Logs</Trans>
      </h2>

      <div className="mt-8">
        <div className="mb-4 flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <Input
              type="search"
              placeholder={_(msg`Search by action`)}
              value={actionTerm}
              onChange={(e) => setActionTerm(e.target.value)}
            />
          </div>

          <Select value={level || 'all'} onValueChange={onLevelChange}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder={_(msg`All Levels`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <Trans>All Levels</Trans>
              </SelectItem>
              {Object.values(LogLevel).map((logLevel) => (
                <SelectItem key={logLevel} value={logLevel}>
                  {logLevel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={category || 'all'} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder={_(msg`All Categories`)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <Trans>All Categories</Trans>
              </SelectItem>
              {Object.values(LogCategory).map((logCategory) => (
                <SelectItem key={logCategory} value={logCategory}>
                  {LOG_CATEGORY_LABELS[logCategory]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <DataTable
            columns={columns}
            data={results.data}
            perPage={results.perPage ?? 30}
            currentPage={results.currentPage ?? 1}
            totalPages={results.totalPages ?? 1}
            onPaginationChange={onPaginationChange}
          >
            {(table) => (
              <DataTablePagination additionalInformation="VisibleCount" table={table} />
            )}
          </DataTable>

          {isFindLogsLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50">
              <Loader className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

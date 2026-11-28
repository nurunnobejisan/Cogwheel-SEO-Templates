"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Skeleton,
} from "@/components/ui/index";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  enableRowSelection?: boolean;
  enableColumnVisibility?: boolean;
  pageSize?: number;
  onRowClick?: (row: TData) => void;
  getRowId?: (row: TData, index: number) => string;
  toolbar?: React.ReactNode;
  className?: string;
}

/**
 * Full-featured TanStack DataTable with sticky header/first column on >=768px,
 * stacked card mode on <640px, pagination, sorting, column toggle, and 8-row skeleton.
 */
export function DataTable<TData>({
  data,
  columns,
  loading = false,
  emptyTitle = "No records found",
  emptyDescription = "Adjust your filters or run a new crawl to populate this table.",
  emptyAction,
  enableRowSelection = false,
  enableColumnVisibility = true,
  pageSize = 25,
  onRowClick,
  getRowId,
  toolbar,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const mergedColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableRowSelection) return columns;
    const selectCol: ColumnDef<TData, unknown> = {
      id: "_select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [selectCol, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: mergedColumns,
    getRowId,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize },
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) {
    return (
      <div className={cn("surface-card overflow-hidden p-4 space-y-3", className)}>
        {Array.from({ length: 8 }).map((_, idx) => (
          <Skeleton key={idx} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} className={className} />;
  }

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  return (
    <div className={cn("surface-card overflow-hidden", className)}>
      {(toolbar || enableColumnVisibility) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" icon={<Columns3 className="h-3.5 w-3.5" aria-hidden="true" />}>
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((col) => col.getCanHide())
                  .map((col) => {
                    const headerText = typeof col.columnDef.header === "string" ? col.columnDef.header : col.id;
                    return (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        onCheckedChange={(v) => col.toggleVisibility(Boolean(v))}
                      >
                        {headerText}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Mobile Stacked Card Mode (< 640px) */}
      <div className="divide-y divide-border sm:hidden">
        {rows.map((row) => {
          const cells = row.getVisibleCells().filter((c) => c.column.id !== "_select");
          const [primaryCell, ...detailCells] = cells;
          return (
            <div
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={cn("space-y-2.5 p-4", onRowClick && "cursor-pointer hover:bg-surface-2")}
            >
              {primaryCell && (
                <div className="text-body font-medium text-text">
                  {flexRender(primaryCell.column.columnDef.cell, primaryCell.getContext())}
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {detailCells.map((cell) => {
                  const header =
                    typeof cell.column.columnDef.header === "string"
                      ? cell.column.columnDef.header
                      : cell.column.id;
                  return (
                    <div key={cell.id} className="min-w-0 space-y-0.5">
                      <div className="text-overline uppercase text-text-muted">{header}</div>
                      <div className="truncate text-table text-text">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop & Tablet Table Mode (>= 640px) with Sticky Header & Sticky First Column */}
      <div className="hidden max-h-[680px] overflow-auto sm:block">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-surface-2">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header, colIdx) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-4 py-2.5 text-overline uppercase text-text-muted",
                        colIdx === 0 && "sticky left-0 z-30 bg-surface-2"
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="tap-compact inline-flex items-center gap-1 hover:text-text"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" aria-hidden="true" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-45" aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={cn(
                  "group bg-surface transition-colors duration-fast ease-telemetry hover:bg-surface-2",
                  onRowClick && "cursor-pointer"
                )}
              >
                {row.getVisibleCells().map((cell, colIdx) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-4 py-3 text-table text-text",
                      colIdx === 0 && "sticky left-0 z-10 bg-surface group-hover:bg-surface-2"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-caption text-text-muted">
          <span className="nums">
            Page {pageIndex + 1} of {pageCount} ({data.length.toLocaleString()} rows)
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

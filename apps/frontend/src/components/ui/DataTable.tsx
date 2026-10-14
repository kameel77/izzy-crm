import React from "react";
import { cx } from "./cx";

export interface DataTableColumn<Row> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right";
  width?: number | string;
  render?: (row: Row) => React.ReactNode;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey?: keyof Row;
  selectedKey?: string | number;
  onRowClick?: (row: Row) => void;
  empty?: React.ReactNode;
  className?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey = "id" as keyof Row,
  selectedKey,
  onRowClick,
  empty,
  className,
}: DataTableProps<Row>): React.ReactElement {
  return (
    <div className={cx("iz-table-wrap", className)}>
      <table className={cx("iz-table", onRowClick && "iz-table--clickable")}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === "right" ? "iz-num" : undefined}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => {
              const key = r[rowKey] as unknown as string | number | null | undefined;
              return (
                <tr
                  key={key != null ? key : i}
                  aria-selected={selectedKey != null ? key === selectedKey : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(r);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.align === "right" ? "iz-num" : undefined}>
                      {c.render ? c.render(r) : (r as Record<string, React.ReactNode>)[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={columns.length} className="iz-table__empty">
                {empty || "No results"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

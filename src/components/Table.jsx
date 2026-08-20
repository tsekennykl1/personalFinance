import React from "react";

/**
 * Generic data table component.
 * @param {Array} columns - [{key, header, cell: (row) => ReactNode}]
 * @param {Array} rows - data array
 * @param {Function} keyFn - (row, idx) => unique key
 */
export default function Table({ columns, rows, keyFn }) {
  return (
    <div className="tableWrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="muted" colSpan={columns.length}>
                No data
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={keyFn ? keyFn(r, idx) : idx}>
                {columns.map((c) => (
                  <td key={c.key}>{c.cell(r)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
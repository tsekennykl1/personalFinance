import React from "react";

export default function Table({ columns, rows, keyFn, tableClassName = "" }) {
  if (!rows || rows.length === 0) {
    return <div className="muted" style={{ padding: "16px", textAlign: "center" }}>No data</div>;
  }

  return (
    <table className={`table ${tableClassName}`}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={keyFn ? keyFn(row, idx) : idx}>
            {columns.map((col) => (
              <td key={col.key}>{col.cell(row, idx)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
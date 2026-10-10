// Column-driven table so the five admin list pages share one markup, one set of
// styles and one horizontal-scroll behaviour.
//
// columns: [{ key, header, render(row), numeric?, className? }]
export default function DataTable({ columns, rows, rowKey, empty }) {
  if (rows.length === 0) {
    return empty || null;
  }

  const cellClass = (column) =>
    [column.numeric ? 'is-numeric' : '', column.className || ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cellClass(column)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row) : row._id || index}>
              {columns.map((column) => (
                <td key={column.key} className={cellClass(column)}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

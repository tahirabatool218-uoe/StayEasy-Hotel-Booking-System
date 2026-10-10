import Icon from '../ui/Icon';

// Returns a contiguous window of page numbers around `current`, e.g.
// current=6, total=20 -> [4, 5, 6, 7, 8]
function getPageWindow(current, total, windowSize = 5) {
  if (total <= windowSize) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(1, current - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;
  if (end > total) {
    end = total;
    start = end - windowSize + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default function Pagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = getPageWindow(page, totalPages);
  const showLeadingEllipsis = pages[0] > 2;
  const showTrailingEllipsis = pages[pages.length - 1] < totalPages - 1;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <Icon name="chevronLeft" size={16} />
      </button>

      {pages[0] > 1 && (
        <>
          <button type="button" className="pagination-page" onClick={() => onPageChange(1)}>
            1
          </button>
          {showLeadingEllipsis && <span className="pagination-ellipsis">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          type="button"
          key={p}
          className={`pagination-page ${p === page ? 'is-active' : ''}`}
          onClick={() => onPageChange(p)}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {showTrailingEllipsis && <span className="pagination-ellipsis">…</span>}
          <button type="button" className="pagination-page" onClick={() => onPageChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        className="pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}

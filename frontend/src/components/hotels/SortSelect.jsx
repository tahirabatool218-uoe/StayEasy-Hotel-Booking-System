// Mirrors SORT_OPTIONS in src/controllers/hotelController.js exactly —
// any value outside this set is ignored server-side (falls back to newest).
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating_desc', label: 'Rating: Highest' },
];

export default function SortSelect({ value, onChange }) {
  return (
    <div className="sort-select">
      <label htmlFor="sort-select" className="sort-select-label">
        Sort by
      </label>
      <select id="sort-select" value={value || 'newest'} onChange={(e) => onChange(e.target.value)}>
        {SORT_OPTIONS.map((opt) => (
          <option value={opt.value} key={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

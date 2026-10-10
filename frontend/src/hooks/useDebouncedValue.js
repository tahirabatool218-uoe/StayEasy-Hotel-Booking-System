import { useEffect, useState } from 'react';

// Returns `value`, but only after it has stoped changing for `delay` ms.
// Used to avoid firing a network request on every keystroke in text/number
// filter inputs (destination, min/max price, amenity).
export default function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HotelCard from '../../components/hotels/HotelCard';
import FilterPanel from '../../components/hotels/FilterPanel';
import SortSelect from '../../components/hotels/SortSelect';
import Pagination from '../../components/hotels/Pagination';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import hotelService from '../../services/hotelService';

const PAGE_SIZE = 9;
const FILTER_KEYS = ['city', 'country', 'minPrice', 'maxPrice', 'minRating', 'amenity'];

export default function HotelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get('search') || '';
  const city = searchParams.get('city') || '';
  const country = searchParams.get('country') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const minRating = searchParams.get('minRating') || '';
  const amenity = searchParams.get('amenity') || '';
  const sort = searchParams.get('sort') || 'newest';
  const page = Math.max(parseInt(searchParams.get('page'), 10) || 1, 1);

  // Read-and-preserve only — the /api/hotels endpoint has no concept of
  // dates, so these never get sent as request params here. They're carried
  // onto each hotel's details link so the availability search on that page
  // can pick up right where the person left off.
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const guests = searchParams.get('guests') || '';

  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => setSearchDraft(search), [search]);
  const debouncedSearch = useDebouncedValue(searchDraft);

  const [hotels, setHotels] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [status, setStatus] = useState('loading'); // loading | success | empty | error
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Merges a partial patch into the URL. Any filter/search/sort change
  // resets pagination to page 1; an explicit page change does not.
  const updateParams = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedSearch === search) return;
    updateParams({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const fetchHotels = async () => {
    setStatus('loading');
    try {
      const params = { page, limit: PAGE_SIZE, sort };
      if (search) params.search = search;
      if (city) params.city = city;
      if (country) params.country = country;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (minRating) params.minRating = minRating;
      if (amenity) params.amenity = amenity;

      const data = await hotelService.getHotels(params);
      const results = data?.hotels || [];
      setHotels(results);
      setMeta({ total: data?.total || 0, totalPages: data?.totalPages || 0 });
      setStatus(results.length > 0 ? 'success' : 'empty');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchHotels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, country, minPrice, maxPrice, minRating, amenity, sort, page]);

  const activeFilterCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length;

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    FILTER_KEYS.forEach((key) => next.delete(key));
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  // Carried onto each HotelCard's details link (see note above).
  const detailsQuery = useMemo(() => {
    const q = {};
    if (checkIn) q.checkIn = checkIn;
    if (checkOut) q.checkOut = checkOut;
    if (guests) q.guests = guests;
    return q;
  }, [checkIn, checkOut, guests]);

  const filterValues = { city, country, minPrice, maxPrice, minRating, amenity };

  return (
    <div className="hotels-page">
      <section className="hotels-header">
        <div className="container">
          <span className="eyebrow-badge">Explore stays</span>
          <h1>{search ? `Search results for "${search}"` : 'All hotels'}</h1>
          <p>
            {status === 'success' || status === 'empty'
              ? `${meta.total} ${meta.total === 1 ? 'hotel' : 'hotels'} found${city ? ` in ${city}` : ''}`
              : 'Browse verified hotels with transparent pricing and real availability.'}
          </p>
        </div>
      </section>

      <section className="hotels-toolbar">
        <div className="container hotels-toolbar-inner">
          <div className="hotels-toolbar-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Search by hotel, city or region"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              aria-label="Search hotels"
            />
          </div>

          <div className="hotels-toolbar-right">
            <button type="button" className="mobile-filter-btn" onClick={() => setFiltersOpen(true)}>
              <Icon name="filter" size={16} /> Filters
              {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
            </button>
            <SortSelect value={sort} onChange={(value) => updateParams({ sort: value })} />
          </div>
        </div>
      </section>

      <section className="hotels-layout container">
        <aside className="hotels-sidebar">
          <FilterPanel
            values={filterValues}
            onChange={(patch) => updateParams(patch)}
            onClear={clearFilters}
            activeCount={activeFilterCount}
          />
        </aside>

        <div className="hotels-results">
          {status === 'loading' && (
            <div className="section-loading">
              <Spinner size="lg" label="Loading hotels" />
            </div>
          )}

          {status === 'error' && (
            <ErrorState description="We couldn't load hotels right now. Please try again." onRetry={fetchHotels} />
          )}

          {status === 'empty' && (
            <EmptyState
              icon={<Icon name="compass" size={26} />}
              title="No hotels match your search"
              description="Try widening your price range, clearing a filter, or searching a different destination."
              action={
                activeFilterCount > 0 ? (
                  <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={clearFilters}>
                    <span className="ui-btn-label">Clear filters</span>
                  </button>
                ) : null
              }
            />
          )}

          {status === 'success' && (
            <>
              <div className="results-grid">
                {hotels.map((hotel) => (
                  <HotelCard hotel={hotel} key={hotel._id} queryParams={detailsQuery} />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                onPageChange={(p) => updateParams({ page: p }, { resetPage: false })}
              />
            </>
          )}
        </div>
      </section>

      {filtersOpen && (
        <div className="filter-drawer-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="filter-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="filter-drawer-header">
              <h3>Filters</h3>
              <button
                type="button"
                className="filter-drawer-close"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <FilterPanel
              values={filterValues}
              onChange={(patch) => updateParams(patch)}
              onClear={clearFilters}
              activeCount={activeFilterCount}
            />
            <button
              type="button"
              className="ui-btn ui-btn-primary ui-btn-block filter-drawer-apply"
              onClick={() => setFiltersOpen(false)}
            >
              <span className="ui-btn-label">Apply filters</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

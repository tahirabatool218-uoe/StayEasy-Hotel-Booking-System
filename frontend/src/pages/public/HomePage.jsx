import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchPanel from '../../components/home/SearchPanel';
import HeroVisual from '../../components/home/HeroVisual';
import HotelCard from '../../components/hotels/HotelCard';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import hotelService from '../../services/hotelService';

const trustPoints = [
  {
    icon: 'shield',
    title: 'Verified hotels',
    description: 'Every property is reviewed before it appears in search, so listings match reality.',
  },
  {
    icon: 'lock',
    title: 'Secure booking',
    description: 'Your details and payment information stay protected from search to check-in.',
  },
  {
    icon: 'sparkle',
    title: 'Flexible stays',
    description: 'Clear cancellation terms on every room, shown before you confirm anything.',
  },
  {
    icon: 'headset',
    title: 'Dedicated support',
    description: 'A real team is reachable if a booking needs attention before or during your stay.',
  },
];

const destinations = [
  { city: 'Lisbon', country: 'Portugal' },
  { city: 'Kyoto', country: 'Japan' },
  { city: 'Cape Town', country: 'South Africa' },
  { city: 'Reykjavík', country: 'Iceland' },
];

const steps = [
  {
    title: 'Search your destination',
    description: 'Tell us where you\u2019re headed and when — we\u2019ll surface hotels that fit.',
  },
  {
    title: 'Choose your room',
    description: 'Compare rooms by price, capacity and amenities, and check real-time availability.',
  },
  {
    title: 'Book your stay',
    description: 'Confirm your dates and guests, and your booking is ready — no surprises later.',
  },
];

export default function HomePage() {
  const [hotels, setHotels] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | success | empty | error

  const loadFeatured = async () => {
    setStatus('loading');
    try {
      const data = await hotelService.getHotels({ sort: 'rating_desc', limit: 4 });
      const results = data?.hotels || [];
      setHotels(results);
      setStatus(results.length > 0 ? 'success' : 'empty');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    loadFeatured();
  }, []);

  return (
    <div className="home">
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="eyebrow-badge">Hotel booking, done properly</span>
            <h1>
              Find a stay you can book with confidence, wherever the trip takes you.
            </h1>
            <p>
              StayEasy brings together verified hotels, transparent pricing and real availability
              — so what you see when you search is what you get when you arrive.
            </p>
            <div className="hero-actions">
              <Link to="/hotels" className="ui-btn ui-btn-primary ui-btn-lg">
                <span className="ui-btn-label">Browse hotels</span>
              </Link>
              <a href="#how-it-works" className="ui-btn ui-btn-outline ui-btn-lg">
                <span className="ui-btn-label">How it works</span>
              </a>
            </div>
          </div>
          <HeroVisual />
        </div>

        <div className="container">
          <SearchPanel />
        </div>
      </section>

      {/* ---------- Trust / value ---------- */}
      <section className="section trust-section">
        <div className="container">
          <div className="section-heading">
            <h2>Built around trust, not just inventory</h2>
            <p>The details that matter when you're booking somewhere you haven't seen in person.</p>
          </div>
          <div className="trust-grid">
            {trustPoints.map((point) => (
              <div className="trust-card" key={point.title}>
                <span className="trust-card-icon">
                  <Icon name={point.icon} size={22} />
                </span>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Featured hotels ---------- */}
      <section className="section section-alt featured-section">
        <div className="container">
          <div className="section-heading section-heading-split">
            <div>
              <h2>Highly rated, right now</h2>
              <p>Our top-rated stays, pulled straight from current listings.</p>
            </div>
            <Link to="/hotels" className="section-heading-link">
              View all hotels <Icon name="arrowRight" size={16} />
            </Link>
          </div>

          {status === 'loading' && (
            <div className="section-loading">
              <Spinner size="lg" label="Loading featured hotels" />
            </div>
          )}

          {status === 'error' && (
            <ErrorState
              description="We couldn't load featured hotels right now."
              onRetry={loadFeatured}
            />
          )}

          {status === 'empty' && (
            <EmptyState
              icon={<Icon name="compass" size={26} />}
              title="No hotels listed yet"
              description="Once hotels are added, the best-rated stays will appear here."
            />
          )}

          {status === 'success' && (
            <div className="hotel-grid">
              {hotels.map((hotel) => (
                <HotelCard hotel={hotel} key={hotel._id} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Popular destinations ---------- */}
      <section className="section destinations-section" id="destinations">
        <div className="container">
          <div className="section-heading">
            <h2>Popular destinations</h2>
            <p>A starting point if you don't have a city in mind yet.</p>
          </div>
          <div className="destination-grid">
            {destinations.map((dest) => (
              <Link
                to={`/hotels?search=${encodeURIComponent(dest.city)}`}
                className="destination-card"
                key={dest.city}
              >
                <span className="destination-card-glyph">
                  <Icon name="compass" size={20} />
                </span>
                <div>
                  <strong>{dest.city}</strong>
                  <span>{dest.country}</span>
                </div>
                <Icon name="arrowRight" size={16} className="destination-card-arrow" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section section-alt how-it-works" id="how-it-works">
        <div className="container">
          <div className="section-heading">
            <h2>Three steps, start to finish</h2>
            <p>No account required to look — only to book.</p>
          </div>
          <div className="steps-grid">
            {steps.map((step, index) => (
              <div className="step-card" key={step.title}>
                <span className="step-index">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                {index < steps.length - 1 && <span className="step-connector" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="final-cta">
        <span className="final-cta-glow" aria-hidden="true" />
        <div className="container final-cta-inner">
          <span className="final-cta-icon">
            <Icon name="compass" size={22} />
          </span>
          <h2>Your next stay is a search away.</h2>
          <p>Compare real hotels, real prices and real availability — right now.</p>
          <div className="final-cta-actions">
            <Link to="/hotels" className="ui-btn ui-btn-primary ui-btn-lg">
              <span className="ui-btn-label">Start searching</span>
            </Link>
            <span className="final-cta-note">No account needed to browse</span>
          </div>
        </div>
      </section>
    </div>
  );
}

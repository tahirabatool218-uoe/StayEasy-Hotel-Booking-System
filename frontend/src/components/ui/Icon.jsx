// Minimal hand-rolled icon set — avoids pulling in an icon library for a
// small, fixed set of glyphs used across the marketing UI and forms.
const paths = {
  sun: 'M12 4V2m0 20v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M18.4 5.6l1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  pin: 'M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  calendar: 'M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  guests: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.2c2.7.3 4.9 2.2 5 4.8',
  search: 'm21 21-4.3-4.3M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  shield: 'M12 2 4 5v6c0 5 3.4 8.9 8 11 4.6-2.1 8-6 8-11V5l-8-3Zm-1.5 12.5L7.5 11.5l1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4-6 6Z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3m-12 0h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z',
  mail: 'M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9Zm1.5 0 6.5 5 6.5-5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8zM5.93 12a6.07 6.07 0 0 1 12.14 0',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22',
  sparkle: 'M12 3v4m0 10v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4m10 0h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8',
  headset: 'M4 13v-1a8 8 0 0 1 16 0v1m-16 0a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v-6H4Zm16 0h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1v-6Zm0 6v1a3 3 0 0 1-3 3h-3',
  star: 'm12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1L6.6 19.3l1.3-6-4.6-4.1 6.1-.6L12 3Z',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm2.8-13.8-2 5-5 2 2-5 5-2Z',
  chevronDown: 'm6 9 6 6 6-6',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  filter: 'M4 5h16M7 12h10M10 19h4',
  check: 'M5 12.5 9.5 17 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm2 12 4.5-5.5 3 3.5 2.5-3L20 17H6ZM8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  logout: 'M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4m7-4 4-4-4-4m4 4H9',
  dashboard: 'M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5ZM4 16a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3Zm9-3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6Z',
  building: 'M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 10h3a1 1 0 0 1 1 1v10M3 21h18M9 8h2M9 12h2M9 16h2',
  bed: 'M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2m18-2v2M3 12V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3m6-3h4a1 1 0 0 1 1 1v4',
};

export default function Icon({ name, size = 20, strokeWidth = 1.7, className = '' }) {
  const d = paths[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`ui-icon ${className}`}
      aria-hidden="true"
    >
      <path d={d} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

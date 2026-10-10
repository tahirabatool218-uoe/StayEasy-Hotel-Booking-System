import { useState } from 'react';

// Circular avatar: the saved picture when there is one, otherwise the person's
// initial (the look the app already used). A picture that fails to load falls
// back to the initial instead of showing a broken-image icon.
//   src       : profile image URL ('' / undefined = none)
//   name      : used for the initial and the accessible label
//   size      : optional pixel size; omit to let the caller's CSS class size it
//   decorative: true when the name is printed next to it (hides it from screen readers)
export default function Avatar({ src, name = '', size, className = '', decorative = false, fallback = 'U' }) {
  const [failedSrc, setFailedSrc] = useState('');

  // Remembering WHICH url failed (not just "failed") means a new picture gets a
  // fresh chance without any reset logic.
  const showImage = Boolean(src) && failedSrc !== src;
  const initial = name.trim()[0]?.toUpperCase() || fallback;
  const style = size ? { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) } : undefined;
  const a11y = decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': name ? `${name}'s profile picture` : 'Profile picture' };

  return (
    <span className={`navbar-user-avatar avatar ${showImage ? 'has-image' : ''} ${className}`.trim()} style={style} {...a11y}>
      {showImage ? <img src={src} alt="" onError={() => setFailedSrc(src)} draggable="false" /> : initial}
    </span>
  );
}

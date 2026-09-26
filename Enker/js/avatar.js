/**
 * Returns an inline SVG string of a friendly, flat-style male avatar.
 * mood: 'happy' | 'sad' | 'neutral'
 * ring: optional CSS class added around the avatar (used for success/error glow)
 */
function maleAvatarSVG(mood = 'neutral') {
  const mouth =
    mood === 'happy'
      ? 'M40 66 Q52 78 64 66'
      : mood === 'sad'
      ? 'M40 72 Q52 60 64 72'
      : 'M40 68 Q52 70 64 68';

  const browLeft = mood === 'sad' ? 'M32 42 L44 47' : 'M32 46 L44 43';
  const browRight = mood === 'sad' ? 'M72 42 L60 47' : 'M72 46 L60 43';

  const cheeks = mood === 'happy'
    ? `<ellipse cx="30" cy="60" rx="6" ry="4" fill="#F4A28C" opacity=".55"/>
       <ellipse cx="74" cy="60" rx="6" ry="4" fill="#F4A28C" opacity=".55"/>`
    : '';

  const brow = mood === 'sad'
    ? `<path d="M30 40 Q52 30 74 40" stroke="#3B2A20" stroke-width="3" fill="none" opacity=".25"/>`
    : '';

  return `
  <svg viewBox="0 0 104 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${mood} avatar">
    <circle cx="52" cy="52" r="50" fill="#EEECFD"/>
    <path d="M20 90 C20 70 34 58 52 58 C70 58 84 70 84 90" fill="#4F46E5"/>
    <circle cx="52" cy="46" r="30" fill="#F7C9A6"/>
    <path d="M22 46 C22 24 40 14 52 14 C66 14 82 24 82 44 C76 40 70 38 70 38 C70 38 66 30 58 28 C58 34 48 38 40 38 C34 38 28 42 26 48 C24 47 22 47 22 46Z" fill="#2B2320"/>
    ${brow}
    ${cheeks}
    <path d="${browLeft}" stroke="#2B2320" stroke-width="3.4" stroke-linecap="round"/>
    <path d="${browRight}" stroke="#2B2320" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="40" cy="52" r="3.4" fill="#2B2320"/>
    <circle cx="64" cy="52" r="3.4" fill="#2B2320"/>
    <path d="${mouth}" stroke="#2B2320" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  </svg>`;
}

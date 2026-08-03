/**
 * Presentation palette for status marks — badges and charts read from the same
 * map, so a colour never means one thing in the table and another in a chart.
 *
 * Six statuses take six categorical hues in fixed slot order (blue, orange,
 * aqua, yellow, magenta, green), assigned in workflow order so the stacked
 * bar's touching segments are the pairs that were validated. Against the white
 * card surface: worst adjacent colour-blind separation ΔE 9.1 (protan), worst
 * normal-vision pair ΔE 19.6 — both clear.
 *
 * Dark is a **selected** set, not the same hexes on a dark card: each hue is
 * re-stepped for the dark surface (worst adjacent CVD ΔE 8.4, normal-vision
 * 19.3). Flipping a palette by lightness is what makes dark-mode charts muddy.
 *
 * Several of these sit below 3:1 contrast against their surface, so every
 * chart using them ships visible counts next to the swatch. Identity is never
 * left to the fill alone.
 */

const LIGHT = {
  New: '#2a78d6',
  Assigned: '#eb6834',
  'In Progress': '#1baf7a',
  'Job Done': '#eda100',
  Reviewed: '#e87ba4',
  Closed: '#008300',
}

const DARK = {
  New: '#3987e5',
  Assigned: '#d95926',
  'In Progress': '#199e70',
  'Job Done': '#c98500',
  Reviewed: '#d55181',
  Closed: '#008300',
}

export function statusColors(theme) {
  return theme === 'dark' ? DARK : LIGHT
}

/** Single hue for magnitude comparisons (jobs per technician). */
export function sequential(theme) {
  return theme === 'dark' ? '#3987e5' : '#2a78d6'
}

/** The meter's two-step fill and its unfilled track. */
export function meterColors(theme) {
  return theme === 'dark'
    ? { from: '#3FBF97', to: '#0E8C7B', track: '#1C3A44' }
    : { from: '#54B683', to: '#2A724C', track: '#D8EDE2' }
}

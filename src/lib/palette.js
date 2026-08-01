/**
 * Presentation palette for status marks — badges and charts read from the same
 * map, so a colour never means one thing in the table and another in a chart.
 *
 * Six statuses take six categorical hues in fixed slot order (blue, orange,
 * aqua, yellow, magenta, green), assigned in workflow order so the stacked bar's
 * touching segments are the pairs that were validated. Against the white card
 * surface: worst adjacent colour-blind separation ΔE 9.1 (protan), worst
 * normal-vision pair ΔE 19.6 — both clear.
 *
 * Aqua, yellow and magenta sit below 3:1 contrast on white, so every chart
 * using them ships visible counts next to the swatch. Identity is never left to
 * the fill alone.
 */
export const STATUS_COLORS = {
  New: '#2a78d6',
  Assigned: '#eb6834',
  'In Progress': '#1baf7a',
  'Job Done': '#eda100',
  Reviewed: '#e87ba4',
  Closed: '#008300',
}

/** Chart chrome, drawn from the app's own ink and hairline tokens. */
export const INK = {
  primary: '#173F6B',
  secondary: '#5A6B80',
  grid: '#DDE4ED',
  surface: '#FFFFFF',
}

/** Single hue for magnitude comparisons (jobs per technician). */
export const SEQUENTIAL = '#2a78d6'

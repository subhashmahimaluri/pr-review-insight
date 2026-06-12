const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** SVG path for a sparkline fitted into the given box; '' when < 1 point */
export function sparklinePath(
  values: number[],
  x: number,
  y: number,
  width: number,
  height: number
): string {
  if (values.length === 0) return '';
  const points = values.length === 1 ? [values[0], values[0]] : values;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const stepX = width / (points.length - 1);
  return points
    .map((value, i) => {
      const px = x + i * stepX;
      const py = max === min ? y + height / 2 : y + (1 - (value - min) / (max - min)) * height;
      return `${i === 0 ? 'M' : 'L'}${fmt(px)} ${fmt(py)}`;
    })
    .join(' ');
}

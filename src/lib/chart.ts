/**
 * A chart a generator hands to the panel alongside its geometry: something
 * worth seeing while designing that should never reach the cut file, such as
 * a cam's displacement diagram. It is plain data so it crosses the worker
 * boundary and the panel draws it with the app's own styles.
 */
export interface ChartData {
  /** The parameter it illustrates; the panel shows it under that control. */
  param: string;
  title: string;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  /** The one series' points; empty when `series` is given. */
  points: [number, number][];
  /** Several series on the one axis, each named in a legend, in place of `points`. */
  series?: { label: string; points: [number, number][] }[];
  /** Labelled spans along x, divided by faint rules and named in the tooltip. */
  spans?: { from: number; to: number; label: string }[];
  /** Where to put x ticks; evenly chosen when absent. */
  xTicks?: number[];
}

/**
 * Maps an extraction confidence (0..1) to a colour on a continuous
 * red → amber → green ramp, plus the labels that go with it.
 *
 * A continuous ramp rather than three buckets, so 0.69 and 0.71 don't look
 * categorically different when they aren't. Colours are darkened toward the ink
 * end of the palette so the text stays legible on the cream background — a raw
 * `rgb(255,0,0)`-to-`rgb(0,255,0)` ramp fails contrast badly in the middle.
 */

/** Below this a value is treated as needing a look, and the input is flagged. */
export const LOW_CONFIDENCE = 0.7;

type Rgb = [number, number, number];

const STOPS: Array<{ at: number; rgb: Rgb }> = [
  { at: 0.0, rgb: [192, 57, 43] }, // --error red
  { at: 0.5, rgb: [176, 116, 20] }, // amber
  { at: 0.75, rgb: [154, 142, 24] }, // olive
  { at: 1.0, rgb: [27, 94, 32] }, // --green-ink
];

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function confidenceRgb(confidence: number): string {
  const c = Math.min(1, Math.max(0, confidence));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const lo = STOPS[i];
    const hi = STOPS[i + 1];
    if (c <= hi.at) {
      const t = (c - lo.at) / (hi.at - lo.at);
      const [r, g, b] = [0, 1, 2].map((k) => lerp(lo.rgb[k], hi.rgb[k], t));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const [r, g, b] = STOPS[STOPS.length - 1].rgb;
  return `rgb(${r}, ${g}, ${b})`;
}

export type ConfidenceTier = "high" | "medium" | "low";

/**
 * Bucket for the label-row chip ("HIGH" / "MEDIUM" / "LOW").
 *
 * The chip is a three-way read at a glance; the exact score stays available as
 * the chip's tooltip and on the extraction review screen, where the continuous
 * ramp is what matters. Bands match confidenceLabel below.
 */
export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 0.9) return "high";
  if (confidence >= LOW_CONFIDENCE) return "medium";
  return "low";
}

export const confidencePct = (confidence: number) => `${Math.round(confidence * 100)}%`;

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "High confidence — stated explicitly in the document";
  if (confidence >= LOW_CONFIDENCE) return "Good confidence — worth a glance";
  if (confidence >= 0.5) return "Low confidence — inferred, please verify";
  return "Very low confidence — likely a guess, please verify";
}

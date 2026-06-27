import type { RationaleSegment } from './types'

/** Flatten rationale segments to plain text — for accessibility (a screen reader
 *  wants the sentence, not the slots), logging, and tests that assert the prose. */
export function rationaleText(segments: RationaleSegment[]): string {
  return segments.map((s) => s.text).join('')
}

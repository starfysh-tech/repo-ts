import { describe, it, expect } from 'vitest'
import { trustDisplay } from './display'

describe('trustDisplay', () => {
  it('maps a known trust state to an icon + label', () => {
    expect(trustDisplay('caution')).toEqual({ icon: '▲', label: 'Caution' })
  })

  it('degrades undefined or an unknown state to "Unknown" instead of crashing', () => {
    expect(trustDisplay(undefined)).toEqual({ icon: '?', label: 'Unknown' })
    expect(trustDisplay('bogus_state')).toEqual({ icon: '?', label: 'Unknown' })
  })
})

import { describe, expect, it } from 'vite-plus/test'
import { load3d, type LoadState } from './load3d.ts'
import type { GraphRenderer } from './types.ts'

const renderer = { id: 'r' } as unknown as GraphRenderer
const opts = { motion: true }

function run(loader: Parameters<typeof load3d>[0]) {
  const states: LoadState[] = []
  const result = load3d(loader, opts, (s) => states.push(s))
  return { states, result }
}

describe('load3d', () => {
  it('goes loading → ready and returns the renderer', async () => {
    const { states, result } = run(async () => ({ create3d: () => renderer }))
    expect(states).toEqual(['loading'])
    expect(await result).toBe(renderer)
    expect(states).toEqual(['loading', 'ready'])
  })

  it('goes loading → failed when the chunk import rejects', async () => {
    const { states, result } = run(() => Promise.reject(new Error('Failed to fetch')))
    expect(await result).toBeNull()
    expect(states).toEqual(['loading', 'failed'])
  })

  it('goes loading → failed when renderer creation throws', async () => {
    const { states, result } = run(async () => ({
      create3d: () => {
        throw new Error('WebGL context lost')
      },
    }))
    expect(await result).toBeNull()
    expect(states).toEqual(['loading', 'failed'])
  })

  it('goes failed → loading → ready on retry', async () => {
    const states: LoadState[] = []
    let calls = 0
    const loader = async () => {
      if (++calls === 1) throw new Error('offline')
      return { create3d: () => renderer }
    }
    await load3d(loader, opts, (s) => states.push(s))
    await load3d(loader, opts, (s) => states.push(s))
    expect(states).toEqual(['loading', 'failed', 'loading', 'ready'])
  })
})

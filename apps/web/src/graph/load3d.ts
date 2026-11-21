import type { GraphRenderer, RendererOptions } from './types.ts'

export type LoadState = 'loading' | 'ready' | 'failed'

/**
 * Fetches the 3D chunk and builds the renderer. Reports loading → ready, or loading → failed when
 * the import rejects (offline, stale chunk after a deploy) or creation throws (e.g. WebGL).
 * Resolves to null on failure; calling it again is the retry.
 */
export async function load3d(
  loader: () => Promise<{ create3d: (o: RendererOptions) => GraphRenderer }>,
  opts: RendererOptions,
  onState: (s: LoadState) => void,
): Promise<GraphRenderer | null> {
  onState('loading')
  try {
    const r = (await loader()).create3d(opts)
    onState('ready')
    return r
  } catch {
    onState('failed')
    return null
  }
}

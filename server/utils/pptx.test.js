import { describe, it, expect } from 'vitest'
import { extractTextFromPPTX } from './pptx'

describe('extractTextFromPPTX', () => {
  it('rejects empty buffer', async () => {
    await expect(extractTextFromPPTX(Buffer.alloc(0))).rejects.toThrow('Empty PPTX buffer')
  })

  it('rejects null buffer', async () => {
    await expect(extractTextFromPPTX(null)).rejects.toThrow('Empty PPTX buffer')
  })

  it('rejects non-pptx buffer', async () => {
    await expect(extractTextFromPPTX(Buffer.from('not a zip'))).rejects.toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { extractTextFromPDF } from './pdf'

describe('extractTextFromPDF', () => {
  it('rejects empty buffer', async () => {
    await expect(extractTextFromPDF(Buffer.alloc(0))).rejects.toThrow('Empty PDF buffer')
  })

  it('rejects null buffer', async () => {
    await expect(extractTextFromPDF(null)).rejects.toThrow('Empty PDF buffer')
  })

  it('rejects garbage buffer', async () => {
    await expect(extractTextFromPDF(Buffer.from('not a pdf'))).rejects.toThrow()
  })
})

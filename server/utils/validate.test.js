import { describe, it, expect, vi } from 'vitest'
import { validateGenerateBody, validateQuizSaveBody } from './validate'

function mockReqRes(body) {
  const req = { body }
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  const next = vi.fn()
  return { req, res, next }
}

describe('validateGenerateBody', () => {
  it('passes with valid body', () => {
    const { req, res, next } = mockReqRes({ topic: 'Math', difficulty: 'Easy', type: 'multiple', num: 5 })
    validateGenerateBody(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('rejects missing topic', () => {
    const { req, res, next } = mockReqRes({ difficulty: 'Easy', type: 'multiple', num: 5 })
    validateGenerateBody(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }))
  })

  it('rejects invalid difficulty', () => {
    const { req, res, next } = mockReqRes({ topic: 'Math', difficulty: 'Extreme', type: 'multiple', num: 5 })
    validateGenerateBody(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects num out of range', () => {
    const { req, res, next } = mockReqRes({ topic: 'Math', difficulty: 'Easy', type: 'multiple', num: 50 })
    validateGenerateBody(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('passes with file upload (topic optional)', () => {
    const { req, res, next } = mockReqRes({ difficulty: 'Easy', type: 'multiple', num: 5 })
    req.file = { originalname: 'test.pdf' }
    validateGenerateBody(req, res, next)
    expect(next).toHaveBeenCalled()
  })
})

describe('validateQuizSaveBody', () => {
  it('passes with valid questions', () => {
    const { req, res, next } = mockReqRes({
      questions: [
        { question: 'Q1?', type: 'multiple', options: ['A', 'B', 'C', 'D'], answer: 'A' },
        { question: 'Q2?', type: 'truefalse', options: ['True', 'False'], answer: 'True' },
      ],
    })
    validateQuizSaveBody(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('rejects empty questions', () => {
    const { req, res, next } = mockReqRes({ questions: [] })
    validateQuizSaveBody(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects missing question fields', () => {
    const { req, res, next } = mockReqRes({ questions: [{ question: 'Q1?' }] })
    validateQuizSaveBody(req, res, next)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})

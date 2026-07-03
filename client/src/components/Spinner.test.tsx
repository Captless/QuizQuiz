import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Spinner from './Spinner'

describe('Spinner', () => {
  it('renders without text', () => {
    const { container } = render(<Spinner />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders with text', () => {
    render(<Spinner text="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('has accessible label', () => {
    render(<Spinner />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })
})

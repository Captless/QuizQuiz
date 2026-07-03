import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: '12px', padding: '32px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p style={{ fontWeight: 600, color: 'var(--error)', fontSize: '16px' }}>Something went wrong</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary btn-sm"
          >
            Refresh Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

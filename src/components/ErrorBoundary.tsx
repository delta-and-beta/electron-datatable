import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class DataTableErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[DataTable] Render error:', error, info.componentStack)
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            textAlign: 'center',
            color: 'var(--dt-muted, #9ca3af)',
            fontSize: '14px',
          }}
        >
          <p>Table failed to render.</p>
          {process.env.NODE_ENV !== 'production' && (
            <pre style={{ marginTop: '8px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

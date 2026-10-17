import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-mono text-sm text-danger">500</p>
        <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted">An unexpected error occurred while rendering this page. Your data is not affected.</p>
        <div className="flex gap-3">
          <button className="h-10 rounded-md border bg-elevated px-4 text-sm font-medium hover:bg-elevated/70" onClick={() => this.setState({ error: null })}>Try again</button>
          <a className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-elevated" href="/">Go to home page</a>
        </div>
      </div>
    )
  }
}

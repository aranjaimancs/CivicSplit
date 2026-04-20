import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for debugging without exposing to the user
    console.error('[CivicSplit] Unhandled error:', error.message)
    console.error('[CivicSplit] Component stack:', info.componentStack)
  }

  handleReset = () => {
    localStorage.clear()
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const msg = this.state.error?.message ?? 'Unknown error'

    return (
      <div
        style={{ background: 'linear-gradient(165deg,#312E81 0%,#4F46BB 45%,#6366F1 100%)' }}
        className="flex min-h-screen flex-col items-center justify-center px-6 text-white"
      >
        {/* Icon */}
        <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-[1.75rem] bg-white/10 shadow-2xl ring-1 ring-white/20 backdrop-blur-sm" />
          <span className="relative text-5xl">🏛️</span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-white">Something went wrong</h1>
        <p className="mt-2 max-w-xs text-center text-sm text-white/60">
          CivicSplit hit an unexpected error. Clearing the cache usually fixes it.
        </p>

        {/* Error detail (collapsed by default) */}
        <details className="mt-4 w-full max-w-xs">
          <summary className="cursor-pointer text-center text-xs text-white/40 hover:text-white/60">
            Show error details
          </summary>
          <pre className="mt-2 overflow-auto rounded-xl bg-black/30 p-3 text-[11px] text-white/70 ring-1 ring-white/10">
            {msg}
          </pre>
        </details>

        {/* CTA */}
        <button
          type="button"
          onClick={this.handleReset}
          className="mt-8 w-full max-w-xs rounded-2xl bg-white py-4 text-[15px] font-bold text-primary-700 shadow-lg transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          Clear Cache &amp; Restart
        </button>

        <p className="mt-4 text-xs text-white/30">
          Morehead-Cain Foundation · CivicSplit
        </p>
      </div>
    )
  }
}

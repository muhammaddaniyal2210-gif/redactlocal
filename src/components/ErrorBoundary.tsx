import { Component, type ErrorInfo, type ReactNode } from 'react'
import { collectEnvironmentReport, summariseEnvironment } from '../lib/environment'

interface Props {
  children: ReactNode
}

interface State {
  details: string | null
}

/**
 * Catches render-phase crashes and puts the stack on screen.
 *
 * An export failure is handled where it happens; this is for everything else —
 * a component that throws leaves React with a blank page, which on a browser
 * you cannot debug remotely tells you nothing at all.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { details: null }

  static getDerivedStateFromError(error: unknown): State {
    return {
      details:
        error instanceof Error
          ? `${error.name}: ${error.message}\n\n${error.stack ?? '(no stack available)'}`
          : String(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Render Stack:', error, info.componentStack)
  }

  render() {
    if (!this.state.details) return this.props.children

    const environment = collectEnvironmentReport()

    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold text-red-300">RedactLocal hit an error</h1>
        <p className="mt-2 text-sm text-slate-400">
          Nothing left your device. Reload to start again — and if you can, send the detail below.
        </p>
        <pre className="mt-5 max-h-96 overflow-auto rounded-xl border border-red-500/30 bg-slate-950/70 p-4 text-[11px] leading-relaxed whitespace-pre-wrap break-words text-red-200/90 select-text">
          {[
            this.state.details,
            '',
            `userAgent: ${environment.userAgent}`,
            summariseEnvironment(environment),
          ].join('\n')}
        </pre>
      </div>
    )
  }
}

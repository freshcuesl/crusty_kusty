import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
  children: ReactNode;
}

/** Shows the fallback instead of a blank page if something below crashes. */
export class CrashBoundary extends Component<Props, { crashed: boolean }> {
  override state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  override render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

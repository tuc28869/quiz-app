class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  render() {
    return this.state.hasError ? (
      <div className="error-fallback">
        <h2>Something went wrong</h2>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    ) : this.props.children;
  }
}

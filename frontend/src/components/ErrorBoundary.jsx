import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 m-4 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center min-h-[50vh]">
                    <h2 className="text-2xl font-bold text-red-700 mb-2">Something went wrong.</h2>
                    <p className="text-sm text-red-600 mb-6 max-w-lg text-center font-mono">
                        {this.state.error?.toString() || "An unexpected error occurred."}
                    </p>
                    <button
                        className="px-6 py-2 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition duration-150"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

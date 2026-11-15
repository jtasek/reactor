import { Component, ReactNode } from 'react';
import type { ErrorInfo } from 'react';

interface State {
    hasError: boolean;
}

interface Props {
    fallback: ReactNode;
    children?: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error: unknown, info: ErrorInfo) {
        console.error(info.componentStack);
        // The fallback handles it on the page, but the server should still hear of it.
        reportError(error);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }

        return this.props.children;
    }
}

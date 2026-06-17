type RouteHandler = (params: Record<string, string>) => void;
type Routes = Record<string, RouteHandler>;

let registered: Routes = {};

const normalize = (path: string): string => {
    if (!path) {
        return '/';
    }
    const trimmed = path.replace(/\/+$/, '');
    return trimmed === '' ? '/' : trimmed;
};

const dispatch = (path: string): void => {
    const handler = registered[normalize(path)];
    if (handler) {
        handler({});
    }
};

// Intercept plain left-clicks on same-origin links so navigation stays
// client-side (no full reload), mirroring the previous router's behaviour.
const onClick = (event: MouseEvent): void => {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    ) {
        return;
    }

    const anchor = (event.target as Element | null)?.closest?.('a');
    if (!anchor) {
        return;
    }

    const href = anchor.getAttribute('href');
    if (
        href === null ||
        anchor.target ||
        anchor.hasAttribute('download') ||
        anchor.origin !== window.location.origin
    ) {
        return;
    }

    event.preventDefault();
    navigate(anchor.pathname);
};

export const initializeRoutes = (routes: Routes): void => {
    registered = Object.keys(routes).reduce<Routes>((acc, url) => {
        acc[normalize(url)] = routes[url];
        return acc;
    }, {});

    window.addEventListener('popstate', () => dispatch(window.location.pathname));
    document.addEventListener('click', onClick);

    dispatch(window.location.pathname);
};

export const navigate = (url: string): void => {
    const path = normalize(url);
    if (path !== normalize(window.location.pathname)) {
        window.history.pushState({}, '', path);
    }
    dispatch(path);
};

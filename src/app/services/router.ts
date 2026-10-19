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
        // Invitation secrets must survive navigation, including a new fragment on this page.
        (anchor.pathname === '/invite' && !!anchor.hash) ||
        anchor.origin !== window.location.origin
    ) {
        return;
    }

    event.preventDefault();
    // The query stays, as an authentication return destination does.
    navigate(anchor.pathname + anchor.search);
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

const split = (url: string) => {
    const { pathname, search } = new URL(url, window.location.origin);

    return { path: normalize(pathname), search };
};

export const navigate = (url: string): void => {
    const { path, search } = split(url);
    if (path + search !== normalize(window.location.pathname) + window.location.search) {
        window.history.pushState({}, '', path + search);
    }
    dispatch(path);
};

/** Shows `url` in place of the current entry, as a redirect, without loading the page again. */
export const redirect = (url: string): void => {
    const { path, search } = split(url);
    window.history.replaceState({}, '', path + search);
    dispatch(path);
};

/** Loads the editor again where it is, as when another copy signed in or out. */
export const reloadPage = (): void => {
    window.location.reload();
};

/** Loads the editor again at `url`, starting it afresh, as after signing in or out. */
export const reload = (url: string): void => {
    window.location.assign(url);
};

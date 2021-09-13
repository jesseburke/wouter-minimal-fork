import makeMatcher from './matcher.js';

import React, {
    useRef,
    useState,
    useEffect,
    useContext,
    useCallback,
    createContext,
    isValidElement,
    cloneElement,
    createElement
} from 'react';

//------------------------------------------------------------------------
//
// following is from https://codesandbox.io/s/wouter-hash-based-hook-5fp9g?from-embed
//

// returns the current hash location (excluding the '#' symbol)
const currentLoc = () => window.location.hash.replace('#', '') || '/';

function useHashLocation() {
    const [loc, setLoc] = useState(currentLoc());

    useEffect(() => {
        const handler = () => setLoc(currentLoc());

        // subscribe on hash changes
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
    }, []);

    const navigate = useCallback((to) => (window.location.hash = to), []);
    return [loc, navigate];
}

/*
 * Part 1, Hooks API: useRouter, useRoute and useLocation
 */

// one of the coolest features of `createContext`:
// when no value is provided — default object is used.
// allows us to use the router context as a global ref to store
// the implicitly created router (see `useRouter` below)
const RouterCtx = createContext({});

// the reason for setting this up, rather than just defining the
// object directly, is for lazy loading: this will only be called when needed
const buildRouter = ({ hook = useHashLocation, base = '', matcher = makeMatcher() } = {}) => ({
    hook,
    base,
    matcher
});

export const useRouter = () => {
    const globalRef = useContext(RouterCtx);

    // either obtain the router from the outer context (provided by the
    // `<Router /> component) or create an implicit one on demand.
    return globalRef.v || (globalRef.v = buildRouter());
};

export const useLocation = () => {
    const router = useRouter();
    return router.hook();
};

export const useRoute = (pattern) => {
    const [path] = useLocation();
    return useRouter().matcher(pattern, path);
};

/*
 * Part 2, Low Carb Router API: Router, Route, Link, Switch
 */

export const Router = (props) => {
    const ref = useRef();

    // this little trick allows to avoid having unnecessary
    // calls to potentially expensive `buildRouter` method.
    // https://reactjs.org/docs/hooks-faq.html#how-to-create-expensive-objects-lazily
    const value = ref.current || (ref.current = { v: buildRouter(props) });

    return <RouterCtx.Provider value={value}>{props.children}</RouterCtx.Provider>;
};

export const Route = ({ path, match, component, children }) => {
    const useRouteMatch = useRoute(path);

    // `props.match` is present - Route is controlled by the Switch
    const [matches, params] = match || useRouteMatch;

    if (!matches) return null;

    // React-Router style `component` prop
    if (component) return createElement(component, { params });

    // support render prop or plain children
    return typeof children === 'function' ? children(params) : children;
};

export const Link = (props) => {
    const [, navigate] = useLocation();
    const { base } = useRouter();

    const href = props.href || props.to;
    const { children, onClick } = props;

    const handleClick = useCallback(
        (event) => {
            // ignores the navigation when clicked using right mouse button or
            // by holding a special modifier key: ctrl, command, win, alt, shift
            if (
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                event.shiftKey ||
                event.button !== 0
            )
                return;

            event.preventDefault();
            navigate(href);
            onClick && onClick(event);
        },
        [href, onClick, navigate]
    );

    // wraps children in `a` if needed
    const extraProps = { href: base + href, onClick: handleClick, to: null };
    const containerElt = isValidElement(children) ? children : createElement('a', props);

    return cloneElement(containerElt, extraProps);
};

export default useRoute;

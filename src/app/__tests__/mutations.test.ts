import type { Context } from '../index';
import { listenToMutations } from '../services/mutations';

type Listener = Parameters<Context['addMutationListener']>[0];

describe('mutation listeners', () => {
    it('calls every listener, although one removes itself while they are called', () => {
        let dispatch: Listener = () => {};
        const addMutationListener = listenToMutations({
            addMutationListener: (listener) => {
                dispatch = listener;

                return () => {};
            }
        });
        const mutation = [{}, new Set<string>(), 0] as unknown as Parameters<Listener>;
        const calls: string[] = [];
        const removeFirst = addMutationListener(() => {
            calls.push('first');
            removeFirst();
        });

        addMutationListener(() => calls.push('second'));
        dispatch(...mutation);
        dispatch(...mutation);

        expect(calls).toEqual(['first', 'second', 'second']);
    });
});

import { NotificationType } from 'src/app/types';
import { createTestStore } from './support/store';

it('shows each kind of notification as its own type', () => {
    const { store } = createTestStore();

    store.actions.displayInfo('Noted');
    store.actions.displaySuccess('Done');
    store.actions.displayWarning('Careful');
    store.actions.displayError('Failed');

    expect(store.state.notifications.map(({ type, message }) => [type, message])).toEqual([
        [NotificationType.Info, 'Noted'],
        [NotificationType.Success, 'Done'],
        [NotificationType.Warning, 'Careful'],
        [NotificationType.Error, 'Failed']
    ]);
    expect(Object.values(NotificationType)).toEqual(['info', 'success', 'warning', 'error']);
});

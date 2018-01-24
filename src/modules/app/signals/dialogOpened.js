import { set, copy } from 'cerebral/operators'
import { state } from 'cerebral/tags'

const openUserModal = [
    copy(props`userId`, 'userModal.userId'),
    userDataExists,
    {
        true: [set(state`app.userModal.show`, true)],
        false: [
            set(state`app.userModal.isLoading`, true),
            set(state`app.userModal.show`, true),
            getUserData,
            {
                success: [setUserData],
                error: [
                    set(state`app.userModal.error`, 'Could not load user data')
                ]
            },
            set(state`app.userModal.isLoading`, false)
        ]
    }
]

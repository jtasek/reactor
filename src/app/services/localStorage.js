export const loadState = (key) => {
    try {
        const serializedState = localStorage.getItem(key)

        return JSON.parse(serializedState)
    }
    catch (error) {
        console.error('Failed to load application state', error)
    }
}

export const saveState = (key, state) => {
    try {
        const serializedState = JSON.stringify(state)

        localStorage.setItem(key, serializedState)
    } catch (error) {
        console.error('Failed to save application state', error)
    }
}
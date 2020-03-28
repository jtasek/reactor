export const getInitialPosition = ({ pointer }, { currenDocument }) => {
    const { initialPosition } = pointer;
    const { scale } = currenDocument.camera;

    return {
        x: initialPosition.x / scale,
        y: initialPosition.y / scale
    };
};

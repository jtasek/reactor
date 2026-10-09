import React, { ChangeEvent, FC, useMemo, useState } from 'react';
import { useActions } from 'src/app/hooks';
import { useComponentCandidates } from 'src/app/componentHooks';

export const PropertyPicker: FC<{ componentId: string; name: string }> = ({
    componentId,
    name
}) => {
    const candidates = useComponentCandidates(componentId);

    return <PropertyChoices componentId={componentId} name={name} candidates={candidates} />;
};

const PropertyChoices: FC<{
    componentId: string;
    name: string;
    candidates: ReturnType<typeof useComponentCandidates>;
}> = ({ componentId, name, candidates }) => {
    const actions = useActions();
    const [chosenId, setChosenId] = useState('');
    const chosen = candidates.find((item) => item.id === chosenId) ?? candidates[0];

    const options = useMemo(
        () =>
            candidates.map((item) => (
                <option key={item.id} value={item.id}>
                    {item.label}
                </option>
            )),
        [candidates]
    );

    const handleChoose = (event: ChangeEvent<HTMLSelectElement>) => {
        setChosenId(event.target.value);
    };
    const handleExpose = () => {
        if (!chosen) {
            return;
        }
        actions.exposeComponentProp({
            componentId,
            shapeId: chosen.shapeId,
            key: chosen.key,
            label: chosen.label
        });
    };

    return (
        <div>
            <select
                aria-label={`Property to expose for ${name}`}
                value={chosen?.id ?? ''}
                onChange={handleChoose}
            >
                {options}
            </select>
            <button type="button" disabled={!chosen} onClick={handleExpose}>
                Expose property
            </button>
        </div>
    );
};

import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useGuide, useGuidesIds } from 'src/app/hooks';

const GuideListItem = ({ guideId }: { guideId: string }) => {
    const guide = useGuide(guideId);
    const { toggleGuideSelected } = useActions();

    return (
        <NavBarListItem
            key={guideId}
            id={guideId}
            name={guide.name}
            selected={guide.selected}
            onClick={toggleGuideSelected}
        />
    );
};

export const GuidesList = () => {
    const guidesIds = useGuidesIds();

    if (guidesIds?.length === 0) {
        return null;
    }

    return (
        <NavBarList name="Guides">
            {guidesIds.map((guideId: string) => (
                <GuideListItem key={guideId} guideId={guideId} />
            ))}
        </NavBarList>
    );
};

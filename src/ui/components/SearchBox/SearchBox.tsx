import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
    filter?: string;
    label?: string;
    onSearch: (value: string) => void;
}

export const SearchBox: FC<Props> = ({ filter, label = 'Search shapes', onSearch }) => (
    <div className={styles.searchBox}>
        <input
            id="q"
            name="q"
            autoComplete="off"
            type="search"
            placeholder={label}
            aria-label={label}
            value={filter}
            onChange={(e) => {
                e.preventDefault();
                onSearch(e.target.value);
            }}
        />
    </div>
);

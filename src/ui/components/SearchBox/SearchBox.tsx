import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
    filter?: string;
    onSearch: (value: string) => void;
}

export const SearchBox: FC<Props> = ({ filter, onSearch }) => (
    <div className={styles.searchBox}>
        <input
            id="q"
            name="q"
            autoComplete="off"
            type="search"
            placeholder="Search shapes"
            aria-label="Search shapes"
            value={filter}
            onChange={(e) => {
                e.preventDefault();
                onSearch(e.target.value);
            }}
        />
    </div>
);

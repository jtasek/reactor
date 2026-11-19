import React, { FC, Fragment, ReactNode } from 'react';
import styles from './styles.css';

type Line = { kind: 'text' | 'item'; text: string };
type Block =
    | { kind: 'title'; text: string }
    | { kind: 'text'; text: string }
    | { kind: 'topic'; name: string; note: string; lines: Line[] };

/**
 * Reads the few marks an answer in words may carry: `# title`, a `**topic**` line that
 * heads the lines after it up to a blank line, `- items`, and examples between backticks.
 */
export function readWords(message: string): Block[] {
    const blocks: Block[] = [];
    // A blank line ends a topic: what follows is said after the list.
    let heading = false;

    message.split('\n').forEach((raw) => {
        const line = raw.trim();
        const topic = /^\*\*(.+?)\*\*(.*)$/.exec(line);
        const last = blocks.at(-1);

        if (!line) {
            heading = false;

            return;
        }
        if (line.startsWith('# ')) {
            blocks.push({ kind: 'title', text: line.slice(2) });
        } else if (topic) {
            blocks.push({ kind: 'topic', name: topic[1], note: topic[2].trim(), lines: [] });
            heading = true;
        } else if (heading && last?.kind === 'topic') {
            last.lines.push(
                line.startsWith('- ')
                    ? { kind: 'item', text: line.slice(2) }
                    : { kind: 'text', text: line }
            );
        } else {
            blocks.push({ kind: 'text', text: line.replace(/^- /, '• ') });
        }
    });

    return blocks;
}

/** An answer in words: topics beside their lines, and examples that fill the prompt when pressed. */
export const Words: FC<{ message: string; onExample?: (example: string) => void }> = ({
    message,
    onExample
}) => {
    const inline = (text: string): ReactNode =>
        text.split('`').map((part, index) =>
            index % 2 === 0 ? (
                <Fragment key={index}>{part}</Fragment>
            ) : onExample ? (
                <button
                    key={index}
                    type="button"
                    className={styles.example}
                    title="Put this in the prompt"
                    onClick={() => onExample(part)}
                >
                    {part}
                </button>
            ) : (
                <code key={index} className={styles.example}>
                    {part}
                </code>
            )
        );
    const blocks = readWords(message);
    type Topic = Extract<Block, { kind: 'topic' }>;
    // Topics that follow one another share one list.
    const groups: Array<Exclude<Block, Topic> | { kind: 'topics'; topics: Topic[] }> = [];

    blocks.forEach((block) => {
        const last = groups.at(-1);

        if (block.kind !== 'topic') {
            groups.push(block);
        } else if (last?.kind === 'topics') {
            last.topics.push(block);
        } else {
            groups.push({ kind: 'topics', topics: [block] });
        }
    });

    return (
        <div className={styles.words}>
            {groups.map((group, index) =>
                group.kind === 'topics' ? (
                    <dl key={index} className={styles.topics}>
                        {group.topics.map((topic, at) => (
                            <Fragment key={at}>
                                <dt>
                                    {topic.name}
                                    {topic.note && <small>{topic.note}</small>}
                                </dt>
                                <dd>
                                    {topic.lines.map((line, row) => (
                                        <span key={row} data-kind={line.kind}>
                                            {inline(line.text)}
                                        </span>
                                    ))}
                                </dd>
                            </Fragment>
                        ))}
                    </dl>
                ) : group.kind === 'title' ? (
                    <h4 key={index} className={styles.wordsTitle}>
                        {group.text}
                    </h4>
                ) : (
                    <p key={index} className={styles.message}>
                        {inline(group.text)}
                    </p>
                )
            )}
        </div>
    );
};

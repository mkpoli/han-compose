export type EmojiPart = {
    text: string;
    /**
     * The slot's number, in reading order.
     */
    slot: number;
    /**
     * The part's leaf, in reading order.
     */
    leaf: number;
    /**
     * Whether it is mirrored across each axis by ⿾ and ⿿ above it.
     */
    flip?: [boolean, boolean];
    /**
     * Whether ㇯ cuts it away.
     */
    cut?: boolean;
    /**
     * Whether a subtraction inside the cut part puts it back.
     */
    restored?: boolean;
    /**
     * Whether ⿻ lays it over another part.
     */
    overlay?: boolean;
};
/** The Emoji sequence a text starts with, or ''. @param {string} text */
export declare function emojiPrefix(text: string): string;
/** Whether a part is an Emoji rather than a component: a sequence of one, or one pictograph. @param {string} part */
export declare const isEmojiPart: (part: string) => boolean;
/**
 * A draft with its Emoji parts turned into slots, and what each was: `{ sequence, emoji }`, the
 * sequence the composer draws (every Emoji a ⬚) and the Emoji in reading order, each with its slot.
 * A draft that does not read is its own sequence with no Emoji.
 * @param {string} sequence
 * @returns {{ sequence: string, emoji: EmojiPart[] }}
 */
export declare function emojiSlots(sequence: string): {
    sequence: string;
    emoji: EmojiPart[];
};

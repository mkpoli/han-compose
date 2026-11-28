export { u26201Forms } from './yao-forms.js';
export type Form = string | {
    id: string;
};
/** The standalone, editorial Noto Serif-style outline in a full em.
 * @param {Form} form */
export declare function yaoOutline(form: Form): {
    viewBox: string;
    d: string;
};
/** Both native upper turns are folded. Each alternative follows the host's original
 * diagonal widths, lower strokes and enclosing contours in its own writing slot.
 * @param {Form | null} [left] @param {Form | null} [right] */
export declare function renderU26201(left?: Form | null, right?: Form | null): {
    viewBox: string;
    d: string;
};

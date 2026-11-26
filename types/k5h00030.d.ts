export type Run = [number, number, number];
export type Cut = (number | Run[])[];
/** @param {string} key */
export declare const k5Donors: (key: string) => string[];
/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region @returns {any[] | null} */
export declare function k5Parts(composer: import('./compose.js').Composer, key: string, region: number[]): any[] | null;

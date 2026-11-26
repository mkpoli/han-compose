export type RateForm = {
    id: string;
    host: string;
    label: string;
    text: string;
};
/** @typedef {{id:string, host:string, label:string, text:string}} RateForm */
export declare const rateHosts: readonly string[];
/** Four independent center/dot choices for a whole host or its exact IDS subtree.
 * The two Japanese 率 spellings are Adobe-Japan1 IVSes. The other two are structural IDS.
 * @param {string} text @returns {readonly RateForm[]} */
export declare const rateFormsFor: (text: string) => readonly RateForm[];
/** The selected drawing, only for an explicitly qualified spelling. @param {string} text */
export declare const exactRateForm: (text: string) => RateForm | undefined;
/** Whether an expression contains a qualified 率, including inside another operand. @param {string} text */
export declare const containsRateForm: (text: string) => boolean;

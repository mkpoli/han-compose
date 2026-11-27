export declare const rateHosts: readonly string[];
declare const families: {
    id: string;
    subjects: string[];
    reference: string;
    axes: {
        id: string;
        property: string;
        examples: {
            '1': string;
            '2': string;
        };
        locus: {
            path: number[];
        }[];
        values: string[];
    }[];
    forms: {
        id: string;
        host: string;
        text: string;
        traits: {
            center: string;
            sides: string;
        };
        sources: ({
            family: string;
            form: string;
            collection?: undefined;
            identifier?: undefined;
        } | {
            family: string;
            form: string;
            collection: string;
            identifier: string;
        })[];
    }[];
}[];
export declare const rateRegistry: Readonly<{
    families: readonly {
        id: string;
        subjects: string[];
        reference: string;
        axes: {
            id: string;
            property: string;
            examples: {
                '1': string;
                '2': string;
            };
            locus: {
                path: number[];
            }[];
            values: string[];
        }[];
        forms: {
            id: string;
            host: string;
            text: string;
            traits: {
                center: string;
                sides: string;
            };
            sources: ({
                family: string;
                form: string;
                collection?: undefined;
                identifier?: undefined;
            } | {
                family: string;
                form: string;
                collection: string;
                identifier: string;
            })[];
        }[];
    }[];
    familiesFor: (text: string) => readonly {
        id: string;
        subjects: string[];
        reference: string;
        axes: {
            id: string;
            property: string;
            examples: {
                '1': string;
                '2': string;
            };
            locus: {
                path: number[];
            }[];
            values: string[];
        }[];
        forms: {
            id: string;
            host: string;
            text: string;
            traits: {
                center: string;
                sides: string;
            };
            sources: ({
                family: string;
                form: string;
                collection?: undefined;
                identifier?: undefined;
            } | {
                family: string;
                form: string;
                collection: string;
                identifier: string;
            })[];
        }[];
    }[];
    match(familyId: string, traits: Record<string, string>): import("./variation-registry.js").VariationForm[];
    at(sequence: string, path: readonly number[]): {
        family: {
            id: string;
            subjects: string[];
            reference: string;
            axes: {
                id: string;
                property: string;
                examples: {
                    '1': string;
                    '2': string;
                };
                locus: {
                    path: number[];
                }[];
                values: string[];
            }[];
            forms: {
                id: string;
                host: string;
                text: string;
                traits: {
                    center: string;
                    sides: string;
                };
                sources: ({
                    family: string;
                    form: string;
                    collection?: undefined;
                    identifier?: undefined;
                } | {
                    family: string;
                    form: string;
                    collection: string;
                    identifier: string;
                })[];
            }[];
        };
        forms: import("./variation-registry.js").VariationForm[];
    }[];
    select(sequence: string, path: readonly number[], familyId: string, formId: string, { asReplacement }?: {
        asReplacement?: boolean;
    } | undefined): string;
}>;
export declare const rateVariationFamilies: readonly {
    id: string;
    subjects: string[];
    reference: string;
    axes: {
        id: string;
        property: string;
        examples: {
            '1': string;
            '2': string;
        };
        locus: {
            path: number[];
        }[];
        values: string[];
    }[];
    forms: {
        id: string;
        host: string;
        text: string;
        traits: {
            center: string;
            sides: string;
        };
        sources: ({
            family: string;
            form: string;
            collection?: undefined;
            identifier?: undefined;
        } | {
            family: string;
            form: string;
            collection: string;
            identifier: string;
        })[];
    }[];
}[];
export type RateForm = typeof families[number]['forms'][number] & {
    label: string;
};
/** @typedef {typeof families[number]['forms'][number] & {label:string}} RateForm */
/** Four independent center and side-stroke choices for a host or its exact IDS subtree.
 * @param {string} text @returns {readonly RateForm[]} */
export declare const rateFormsFor: (text: string) => readonly RateForm[];
/** The selected drawing, only for an explicitly qualified spelling. @param {string} text */
export declare const exactRateForm: (text: string) => RateForm | undefined;
/** @param {string} text @returns {{host:string,index:number,returning:boolean}|undefined} */
export declare const rateRenderChoice: (text: string) => {
    host: string;
    index: number;
    returning: boolean;
} | undefined;
/** Whether an expression contains a qualified 率, including inside another operand. @param {string} text */
export declare const containsRateForm: (text: string) => boolean;
export {};

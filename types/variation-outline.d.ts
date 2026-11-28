export type Outline = {
    d: string;
    frame: string;
    matrix?: number[];
    fillRule?: 'nonzero' | 'evenodd';
};
export type OutlineWitness = Outline & {
    form: string;
    source: string;
};
export type Edge = {
    type: string;
    points: number[][];
};
export type Ring = Edge[];
export type Prepared = {
    frame: string;
    fill: string;
    rings: Ring[];
};
/** Match a located vector outline against observed shapes in the same coordinate frame. Distances
 * use frame units and include curve controls. A different winding or curve segmentation falls
 * outside this comparison. All matches within tolerance retain their source, including ties.
 * @param {Outline} observation @param {readonly OutlineWitness[]} witnesses @param {{tolerance?:number}} [options] */
export declare function recognizeVariationOutline(observation: Outline, witnesses: readonly OutlineWitness[], { tolerance }?: {
    tolerance?: number;
}): {
    status: string;
    candidates: {
        form: any;
        source: any;
        distance: number;
    }[];
};

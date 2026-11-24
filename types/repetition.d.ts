export declare const REPETITION = "\u2FF0\u51AB\u2FF1\u4E3F\u4E36";
export declare const REPETITION_MIRRORED = "\u2FF0\u51AB\u2FFE\u51AB";
export declare const isRepetition: (text: any) => boolean;
export declare const containsRepetition: (text: any) => any;
export declare const repetitionInk: any;
export declare const repetitionRecord: any;
export declare const repetitionParts: (text: any, region: any, style: any) => {
    part: any;
    source: any;
    target: any;
    weight: number[];
    native: any;
    origin: any;
    fixed: boolean;
}[] | null;
export declare const repetitionDrawing: (text: any, style: any) => {
    d: string;
    approximate: never[];
} | null;

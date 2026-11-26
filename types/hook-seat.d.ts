/** Lower a fitted leaf toward the hook floor while keeping its strokes clear of the bend and tip. */
export declare function lowerHookSeat(frame: any, frameBox: any, inner: any, innerBox: any, seat: any, region: any, floor: any): any;
export declare function openHookCounters(frame: any, frameBox: any, inner: any, box: any, seat: any, region: any, char: any, fontStyle: any): {
    part: {
        contours: any[];
        box: number[];
    };
    source: any[];
    factor: number;
} | null;

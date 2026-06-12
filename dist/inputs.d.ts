export type ActionInputs = {
    token: string;
    mode: 'report' | 'baseline';
    baselineBranch: string;
    /**
     * auto: recorded baseline branch, falling back to scanning the merge-base
     * in this run · branch: recorded only · scan: dual-scan only (no baseline
     * branch needed) · off: never resolve a baseline
     */
    baselineMode: 'auto' | 'branch' | 'scan' | 'off';
    /** JSON, same shape as the config file `gates` key (file < input) */
    gates: string;
    ignore: string[];
    strict: boolean;
    comment: boolean;
    checkRun: boolean;
    annotations: 'new' | 'all' | 'none';
    reportFile: string;
    sarifFile: string;
    htmlFile: string;
    fixPlanFile: string;
    /** upload report + html + fix plan as a run artifact (download from the run page) */
    uploadArtifact: boolean;
};
export declare function readInputs(): ActionInputs;

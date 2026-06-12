export type ActionInputs = {
    token: string;
    mode: 'report' | 'baseline';
    baselineBranch: string;
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
};
export declare function readInputs(): ActionInputs;

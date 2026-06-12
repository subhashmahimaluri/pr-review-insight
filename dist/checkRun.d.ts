import { Finding } from '@pr-review-insight/core';
type AnnotationLevel = 'notice' | 'warning' | 'failure';
export type Annotation = {
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: AnnotationLevel;
    message: string;
    title: string;
};
/** ≤200 inline annotations on touched lines, failures-first */
export declare function buildAnnotations(findings: Finding[], scope: 'new' | 'all'): Annotation[];
export declare function postCheckRun(params: {
    token: string;
    title: string;
    summary: string;
    conclusion: 'success' | 'failure' | 'neutral';
    annotations: Annotation[];
}): Promise<void>;
export {};

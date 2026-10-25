import { sub } from './lib.mjs';
sub('src/pages/Today.tsx', "<div className=\"progress\" aria-label={`${done} of ${total} done today`}>\n            <div className=\"bar\" role=\"progressbar\"", "<div className=\"progress\">\n            <div className=\"bar\" role=\"progressbar\" aria-label={`${done} of ${total} done today`}");

import { sub } from './lib.mjs';
const T = 'src/test/review.test.tsx';
sub(T, "import css from '../styles.css?raw';\n", "");
sub(T, "describe('review fixes: styles and screens', () => {\n", "describe('review fixes: styles and screens', () => {\n  // read the stylesheet as text (tests run from the project folder); the module name is built at run time so the type checker doesn't need node types\n  const readCss = async () => {\n    const name = 'node:fs';\n    const { readFileSync } = (await import(/* @vite-ignore */ name)) as { readFileSync: (p: string, enc: string) => string };\n    return readFileSync('src/styles.css', 'utf8');\n  };\n\n");
sub(T, "  it(\"does not reuse the tick-box, routine-history or hour-block class names for other things\", () => {\n", "  it(\"does not reuse the tick-box, routine-history or hour-block class names for other things\", async () => {\n    const css = await readCss();\n    expect(css.length).toBeGreaterThan(1000);\n");

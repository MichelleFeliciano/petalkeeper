import { sub } from './lib.mjs';
const T = 'src/test/features4.test.tsx';
sub(T, "const goto = async", "// jsdom's File has no text(); real browsers do\nconst jsonFile = (text: string, name: string) => Object.assign(new File([text], name, { type: 'application/json' }), { text: async () => text });\nconst goto = async");
sub(T, "new File([exportJSON(file)], 'mine.json', { type: 'application/json' })", "jsonFile(exportJSON(file), 'mine.json')");
sub(T, "new File([JSON.stringify({ app: 'caregiver', version: 1, people: [] })], 'x.json', { type: 'application/json' })", "jsonFile(JSON.stringify({ app: 'caregiver', version: 1, people: [] }), 'x.json')");
sub(T, "    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { storage: { estimate: async () => ({ usage: 90, quota: 100 }) } }));\n    render(<App />);\n    expect(await screen.findByText(/storage is about 90% full/, {}, { timeout: 4000 })).toBeInTheDocument();",
"    Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage: 90, quota: 100 }) }, configurable: true });\n    render(<App />);\n    try {\n      expect(await screen.findByText(/storage is about 90% full/, {}, { timeout: 4000 })).toBeInTheDocument();\n    } finally {\n      delete (navigator as unknown as Record<string, unknown>).storage;\n    }");

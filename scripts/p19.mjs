import { sub } from './lib.mjs';
sub('src/components/Modal.tsx', "    const first =\n      root?.querySelector<HTMLElement>('input", "    const first =\n      root?.querySelector<HTMLElement>('[data-autofocus]') ??\n      root?.querySelector<HTMLElement>('input");
sub('src/components/Gate.tsx', "<button className=\"btn primary\" onClick={close}>{examples", "<button className=\"btn primary\" data-autofocus onClick={close}>{examples");
sub('src/test/features.test.tsx', "await user.click(screen.getByRole('button', { name: 'Got it' }));", "await user.click(screen.getByRole('button', { name: /Keep the examples|Got it/ }));");

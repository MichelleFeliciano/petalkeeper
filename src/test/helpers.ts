import { DEFAULT_SETTINGS, type AppData } from '../lib/types';

export const emptyForTest = (): AppData => ({
  version: 1,
  tasks: [],
  routines: [],
  routineLog: {},
  settings: { ...DEFAULT_SETTINGS },
  blooms: 0,
});

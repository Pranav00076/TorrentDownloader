process.env.MY_VAR = 'test';
import { printA } from './test-hoist.mjs';
printA();

import { stampRulesVersion } from './lib/rules-version.js';

stampRulesVersion(process.argv[2] ?? '');

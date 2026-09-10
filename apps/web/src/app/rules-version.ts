/**
 * The rules version this bundle was compiled against. The deployment stamps
 * the same commit reference on `config/settings`, and a tab left open since
 * yesterday reloads once the two drift apart.
 *
 * Rewritten by the deployment, through `nx run rules-stamp:stamp -- <sha>`.
 * 'dev' is what a checkout carries, and no deployment ever stamps it.
 */
export const COMPILED_RULES_VERSION = 'dev';

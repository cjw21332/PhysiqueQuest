/**
 * Keeps the scanner's structured logs out of the test report.
 *
 * The pipeline logs one line per request, which is the behaviour under test in
 * foodscan-validation.spec.ts but pure noise everywhere else. Individual specs
 * that need to assert on real output build their own logger against an
 * in-memory stream instead of relying on this.
 */
process.env.LOG_LEVEL ??= 'silent';

import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentryPrivacy.mjs';

const options = sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN);
if (options) Sentry.init(options);

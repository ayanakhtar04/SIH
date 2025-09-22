import dotenv from 'dotenv';

import { loadConfig, AppConfig } from './validate';

dotenv.config();

export const CONFIG: AppConfig = loadConfig(process.env);

// Backwards compatibility export (will phase out ENV usage later)
export const ENV = CONFIG;

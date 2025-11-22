import 'dotenv/config';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { json } from 'express';
import { authRouter } from './routes/auth';

const app = express();
app.use(helmet());
app.use(cors());
app.use(json());

app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({ ok: true, service: 'auth-sandbox', ts: Date.now() });
});
app.use('/api/auth', authRouter);

const PORT = process.env.PORT || 7070;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log('[auth-sandbox] listening on', PORT));
}

export { app };

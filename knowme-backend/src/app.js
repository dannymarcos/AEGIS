import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import shortRoutes from './routes/shortRoutes.js';
import adRoutes from './routes/adRoutes.js';
import socialPostRoutes from './routes/socialPostRoutes.js';
import socialStoryRoutes from './routes/socialStoryRoutes.js';
import socialGraphRoutes from './routes/socialGraphRoutes.js';
import socialTimelineRoutes from './routes/socialTimelineRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import callRoutes from './routes/callRoutes.js';
import cryptoRoutes from './routes/cryptoRoutes.js';
import monetizationRoutes from './routes/monetizationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import assistantRoutes from './routes/assistantRoutes.js';
import { apiLimiter, authLimiter } from './middleware/rateLimit.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiLimiter);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/videos/:videoId/comments', commentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/shorts', shortRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/social/posts', socialPostRoutes);
app.use('/api/social/stories', socialStoryRoutes);
app.use('/api/social/graph', socialGraphRoutes);
app.use('/api/social/timeline', socialTimelineRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/monetization', monetizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assistant', assistantRoutes);

app.get('/shorts', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'shorts.html')));
app.get('/social', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'social.html')));
app.get('/chat', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/creator-dashboard', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'creator-dashboard.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;

# BeatBattle

A competitive music listening party app where friends create sessions, add songs to a collaborative playlist, and score each other's music choices in real-time.

## 🚨 Quick Setup Required (3 minutes total)

### 👉 **[START HERE - Click for Step-by-Step Fixes](START_HERE.md)**

**Two quick fixes needed:**
1. **Database Error** - 2 minutes → [FIX_DATABASE_ERROR.md](FIX_DATABASE_ERROR.md)
2. **YouTube Search** - 1 minute → [ENABLE_YOUTUBE_API.md](ENABLE_YOUTUBE_API.md)

## Features

- **Session Management:** Create or join music listening sessions with friends
- **Collaborative Playlists:** Each participant adds songs to the shared queue
- **Force-Play Mechanic:** Surprise your friends by jumping the queue with your song
- **Real-time Scoring:** Rate each song as it plays (1-5 stars)
- **Competition:** Winner determined by highest average score at the end
- **Music Integration:** Support for YouTube and Spotify

### 🆕 New Limits & Features
- ✅ **Max 20 active sessions** at any time
- ✅ **Max 10 participants** per session
- ✅ **Auto-expiration** after 1 hour of inactivity
- ✅ **Smart extension** for sessions with 2+ active listeners
- 📖 See [SESSION_LIMITS.md](SESSION_LIMITS.md) for details

## How It Works

1. Create a new session or join an existing one with a session code
2. Each participant adds their favorite songs to the playlist
3. Songs play in order, but anyone can "force-play" to jump ahead
4. All participants rate each song while it plays
5. At the end, scores are tallied and a winner is crowned!

## Tech Stack

- **Framework:** Next.js 14+ with App Router
- **UI:** shadcn/ui + Tailwind CSS
- **Language:** TypeScript
- **Styling:** Tailwind CSS

## Getting Started

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Spotify (optional - for song search)
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# YouTube (for playback)
NEXT_PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key

# Database (Supabase or other)
DATABASE_URL=your_database_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## Project Structure

```
beat-battle/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── session/           # Session pages
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── session/          # Session-specific components
├── lib/                   # Utilities and types
│   ├── types/            # TypeScript types
│   └── utils.ts          # Helper functions
└── ARCHITECTURE.md        # Detailed architecture documentation
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed implementation recommendations including:
- Session management strategies
- Music service integration options (Spotify vs YouTube)
- Real-time synchronization approaches
- Invite systems
- Scoring mechanics

## Next Steps

1. Set up music service APIs (Spotify/YouTube)
2. Implement real-time backend (Supabase, Socket.io, or Pusher)
3. Build session creation and joining flows
4. Create music player component with synchronization
5. Add scoring and competition features
6. Implement force-play mechanics

## Contributing

This is an initial setup. Feel free to contribute by:
- Implementing the suggested features
- Improving the UI/UX
- Adding tests
- Optimizing performance

## License

MIT

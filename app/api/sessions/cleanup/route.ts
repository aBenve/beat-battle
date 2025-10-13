import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST() {
  try {
    // First, extend sessions that have active listening (2+ participants, playing status)
    const { error: extendError } = await supabase.rpc('extend_active_sessions');

    if (extendError) {
      console.error('Error extending active sessions:', extendError);
    }

    // Then cleanup expired sessions
    const { data: deletedCount, error: cleanupError } = await supabase
      .rpc('cleanup_expired_sessions');

    if (cleanupError) {
      console.error('Error cleaning up sessions:', cleanupError);
      throw cleanupError;
    }

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup sessions' },
      { status: 500 }
    );
  }
}

// GET endpoint to check session health
export async function GET() {
  try {
    const { data: activeCount, error: countError } = await supabase
      .rpc('count_active_sessions');

    if (countError) throw countError;

    // Get sessions expiring soon (within 10 minutes)
    const { data: expiringSoon, error: expiringError } = await supabase
      .from('sessions')
      .select('id, name, session_code, expires_at, status')
      .gt('expires_at', new Date().toISOString())
      .lt('expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
      .in('status', ['waiting', 'playing']);

    if (expiringError) throw expiringError;

    return NextResponse.json({
      activeCount,
      expiringSoon: expiringSoon?.length || 0,
      sessions: expiringSoon || []
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Failed to check session health' },
      { status: 500 }
    );
  }
}

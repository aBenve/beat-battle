export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string
          name: string
          host_id: string
          session_code: string
          status: 'waiting' | 'playing' | 'finished'
          current_song_index: number
          current_song_started_at: string | null
          last_activity_at: string
          expires_at: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          host_id: string
          session_code: string
          status?: 'waiting' | 'playing' | 'finished'
          current_song_index?: number
          current_song_started_at?: string | null
          last_activity_at?: string
          expires_at?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          host_id?: string
          session_code?: string
          status?: 'waiting' | 'playing' | 'finished'
          current_song_index?: number
          current_song_started_at?: string | null
          last_activity_at?: string
          expires_at?: string
          settings?: Json
          updated_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          session_id: string
          user_name: string
          avatar_url: string | null
          is_host: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_name: string
          avatar_url?: string | null
          is_host?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_name?: string
          avatar_url?: string | null
          is_host?: boolean
        }
      }
      songs: {
        Row: {
          id: string
          session_id: string
          title: string
          artist: string
          album_art: string | null
          duration: number
          source: 'spotify' | 'youtube'
          source_id: string
          added_by: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          title: string
          artist: string
          album_art?: string | null
          duration: number
          source: 'spotify' | 'youtube'
          source_id: string
          added_by: string
          position: number
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          title?: string
          artist?: string
          album_art?: string | null
          duration?: number
          source?: 'spotify' | 'youtube'
          source_id?: string
          added_by?: string
          position?: number
        }
      }
      scores: {
        Row: {
          id: string
          session_id: string
          song_id: string
          participant_id: string
          rating: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          song_id: string
          participant_id: string
          rating: number
          created_at?: string
        }
        Update: {
          id?: string
          rating?: number
        }
      }
      force_plays: {
        Row: {
          id: string
          session_id: string
          participant_id: string
          song_id: string
          timestamp: string
        }
        Insert: {
          id?: string
          session_id: string
          participant_id: string
          song_id: string
          timestamp?: string
        }
        Update: {
          id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

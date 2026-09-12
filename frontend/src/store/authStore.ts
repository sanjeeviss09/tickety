import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  profile: any | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: any | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  loading: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session });
      
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, roles(name), units(name), departments(name)')
          .or(`id.eq.${session.user.id},auth_user_id.eq.${session.user.id}`)
          .maybeSingle();
        set({ profile });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, roles(name), units(name), departments(name)')
          .or(`id.eq.${session.user.id},auth_user_id.eq.${session.user.id}`)
          .maybeSingle();
        set({ profile });
      } else {
        set({ profile: null });
      }
    });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  }
}));

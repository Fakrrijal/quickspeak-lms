import { supabase } from '../lib/supabase'

export type SignInInput = {
  email: string
  password: string
}

export type SignUpInput = {
  email: string
  password: string
  full_name: string
}

export const authService = {
  async signIn({ email, password }: SignInInput) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw error
    }

    return data
  },

  async signUp({ email, password, full_name }: SignUpInput) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    return data.session
  },

  async getUser() {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      throw error
    }

    return data.user
  },
}
import { supabase } from '../lib/supabase'

export type SignInInput = {
  email: string
  password: string
}

export type PasswordResetInput = {
  email: string
}

export type SignUpRole = 'student' | 'teacher'

export type SignUpInput = {
  email: string
  password: string
  full_name: string
  phone: string
  role: SignUpRole
  student_starting_level_id?: string
  student_class_type?: 'private' | 'semi_private'
  teacher_class_type?: 'private' | 'semi_private'
  supported_level_ids?: string[]
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

  async signUp({
    email,
    password,
    full_name,
    phone,
    role,
    student_starting_level_id,
    student_class_type,
    teacher_class_type,
    supported_level_ids,
  }: SignUpInput) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/email-confirmed`,
        data: {
          full_name,
          phone,
          role,
          student_starting_level_id,
          student_class_type,
          teacher_class_type,
          supported_level_ids,
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  },

  async resetPasswordForEmail({ email }: PasswordResetInput) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      throw error
    }
  },

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      throw error
    }
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

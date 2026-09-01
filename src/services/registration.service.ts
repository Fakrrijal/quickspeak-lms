import { supabase } from '../lib/supabase'

export type Level = {
  id: string
  level_number: number
  name: string
}

export type StudentRegistrationInput = {
  student_starting_level_id: string
  student_class_type: 'private' | 'semi_private'
}

export type TeacherRegistrationInput = {
  teacher_class_type: 'private' | 'semi_private'
  supported_level_ids: string[]
}

export const registrationService = {
  async getLevels(): Promise<Level[]> {
    const { data, error } = await supabase
      .from('levels')
      .select('id, level_number, name')
      .order('level_number', { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []) as Level[]
  },

  async createStudentApplication(input: StudentRegistrationInput) {
    const { data, error } = await supabase.rpc('create_registration_application', {
      p_student_starting_level_id: input.student_starting_level_id,
      p_student_class_type: input.student_class_type,
    })

    if (error) {
      throw error
    }

    return data
  },

  async createTeacherApplication(input: TeacherRegistrationInput) {
    const { data, error } = await supabase.rpc('create_registration_application', {
      p_teacher_class_type: input.teacher_class_type,
      p_supported_level_ids: input.supported_level_ids,
    })

    if (error) {
      throw error
    }

    return data
  },
}

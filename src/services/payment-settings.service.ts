import { supabase } from '../lib/supabase'

export type PaymentSettings = {
  id: string
  bank_name: string
  account_number: string
  account_name: string
  private_registration_fee: number
  semi_private_registration_fee: number
  is_active: boolean
}

export type UpdatePaymentSettingsInput = Pick<
  PaymentSettings,
  'bank_name' | 'account_number' | 'account_name' | 'private_registration_fee' | 'semi_private_registration_fee'
>

export async function getActivePaymentSettings() {
  const { data, error } = await supabase
    .from('payment_settings')
    .select('id, bank_name, account_number, account_name, private_registration_fee, semi_private_registration_fee, is_active')
    .eq('is_active', true)
    .single()

  if (error) {
    throw error
  }

  return data as PaymentSettings
}

export async function updatePaymentSettings(
  paymentSettingsId: string,
  input: UpdatePaymentSettingsInput,
) {
  const { data, error } = await supabase
    .from('payment_settings')
    .update(input)
    .eq('id', paymentSettingsId)
    .select('id, bank_name, account_number, account_name, private_registration_fee, semi_private_registration_fee, is_active')
    .single()

  if (error) {
    throw error
  }

  return data as PaymentSettings
}

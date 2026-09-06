import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import {
  getActivePaymentSettings,
  updatePaymentSettings,
  type PaymentSettings,
} from '../../services/payment-settings.service'

export const Route = createFileRoute('/admin/payment-settings')({
  component: AdminPaymentSettingsPage,
})

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message
  }

  return error instanceof Error ? error.message : fallback
}

function AdminPaymentSettingsPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const router = useRouter()
  const [settings, setSettings] = useState<PaymentSettings | null>(null)
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [privateFee, setPrivateFee] = useState('')
  const [semiPrivateFee, setSemiPrivateFee] = useState('')
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (loading || profileLoading) {
      return
    }

    if (!isAuthenticated || profileError || status === null) {
      navigate({ to: '/login' })
      return
    }

    if (status !== 'active') {
      navigate({ to: '/waiting' })
    }
  }, [isAuthenticated, loading, navigate, profileError, profileLoading, status])

  const canManagePaymentSettings =
    isAuthenticated && role === 'admin' && status === 'active'

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true)
    setError(null)

    try {
      const paymentSettings = await getActivePaymentSettings()
      setSettings(paymentSettings)
      setBankName(paymentSettings.bank_name)
      setAccountNumber(paymentSettings.account_number)
      setAccountName(paymentSettings.account_name)
      setPrivateFee(String(paymentSettings.private_registration_fee))
      setSemiPrivateFee(String(paymentSettings.semi_private_registration_fee))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load payment settings.'))
    } finally {
      setIsLoadingSettings(false)
    }
  }, [])

  useEffect(() => {
    if (canManagePaymentSettings) {
      void loadSettings()
    }
  }, [canManagePaymentSettings, loadSettings])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!settings) {
      return
    }

    const privateFeeAmount = Number(privateFee)
    const semiPrivateFeeAmount = Number(semiPrivateFee)

    if (
      !Number.isSafeInteger(privateFeeAmount)
      || !Number.isSafeInteger(semiPrivateFeeAmount)
      || privateFeeAmount <= 0
      || semiPrivateFeeAmount <= 0
    ) {
      setError('Registration fees must be whole, positive Rupiah amounts.')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const updatedSettings = await updatePaymentSettings(settings.id, {
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
        private_registration_fee: privateFeeAmount,
        semi_private_registration_fee: semiPrivateFeeAmount,
      })
      setSettings(updatedSettings)
      setBankName(updatedSettings.bank_name)
      setAccountNumber(updatedSettings.account_number)
      setAccountName(updatedSettings.account_name)
      setPrivateFee(String(updatedSettings.private_registration_fee))
      setSemiPrivateFee(String(updatedSettings.semi_private_registration_fee))
      setSuccessMessage('Payment settings saved successfully.')
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Unable to save payment settings.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (loading || profileLoading) {
    return <p>Loading...</p>
  }

  if (!isAuthenticated || profileError || status === null || status !== 'active') {
    return null
  }

  if (role !== 'admin') {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="mt-2">You do not have permission to manage payment settings.</p>
      </section>
    )
  }

  return (
    <section className="max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-slate-900">Payment Settings</h2>
        <button
          type="button"
          onClick={() => { router.history.back() }}
          className="text-sm font-medium text-slate-700 underline"
        >
          Back to Payments
        </button>
      </div>

      {successMessage && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSave} className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
        {isLoadingSettings ? (
          <p className="text-sm text-slate-600">Loading payment settings...</p>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Bank Name
              <input
                type="text"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                required
                disabled={isSaving || !settings}
                className="mt-1 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 disabled:bg-slate-100"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">Private Registration Fee (IDR)<input type="number" min="1" step="1" value={privateFee} onChange={(event) => setPrivateFee(event.target.value)} required disabled={isSaving || !settings} className="mt-1 w-full rounded-lg border px-4 py-3" /></label>
            <label className="block text-sm font-medium text-slate-700">Semi-private Registration Fee (IDR)<input type="number" min="1" step="1" value={semiPrivateFee} onChange={(event) => setSemiPrivateFee(event.target.value)} required disabled={isSaving || !settings} className="mt-1 w-full rounded-lg border px-4 py-3" /></label>

            <label className="block text-sm font-medium text-slate-700">
              Account Number
              <input
                type="text"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                required
                disabled={isSaving || !settings}
                className="mt-1 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 disabled:bg-slate-100"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Account Name
              <input
                type="text"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                required
                disabled={isSaving || !settings}
                className="mt-1 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 disabled:bg-slate-100"
              />
            </label>

            <button
              type="submit"
              disabled={isSaving || !settings}
              className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </section>
  )
}

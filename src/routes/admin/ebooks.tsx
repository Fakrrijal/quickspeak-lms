import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuthContext } from '../../providers/AuthProvider'
import { getLevels, type ActiveLevel } from '../../services/admin.service'
import {
  archiveAdminEbook,
  createAdminEbook,
  deleteAdminEbookDraft,
  listAdminEbooks,
  publishAdminEbook,
  type AdminEbook,
  updateAdminEbookDraft,
} from '../../services/admin-ebook.service'

export const Route = createFileRoute('/admin/ebooks')({
  component: AdminEbooksPage,
})

function getErrorMessage(error: unknown, fallback: string) {
  const message = (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) ? error.message : null

  if (
    message
    && (
      message.includes('Active administrator access is required')
      || message.includes('Level does not exist')
      || message.includes('Ebook title')
      || message.includes('Ebook does not exist')
      || message.includes('Only draft ebooks can be')
      || message.includes('Only published ebooks can be archived')
      || message.includes('Another ebook publication is in progress')
      || message.includes('Heyzine URL')
    )
  ) {
    return message
  }

  return fallback
}

function validateHeyzineUrl(value: string) {
  try {
    const normalizedValue = value.trim()
    const url = new URL(normalizedValue)

    if (
      url.protocol !== 'https:'
      || url.hostname !== 'heyzine.com'
      || url.username
      || url.password
      || url.port
      || url.hash
      || !url.pathname.startsWith('/flip-book/')
      || /^https:\/\/[^/]*:/i.test(normalizedValue)
    ) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

function AdminEbooksPage() {
  const {
    isAuthenticated,
    loading,
    profileLoading,
    profileError,
    role,
    status,
  } = useAuthContext()
  const navigate = useNavigate()
  const [ebooks, setEbooks] = useState<AdminEbook[]>([])
  const [levels, setLevels] = useState<ActiveLevel[]>([])
  const [title, setTitle] = useState('')
  const [levelId, setLevelId] = useState('')
  const [heyzineUrl, setHeyzineUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingLevels, setIsLoadingLevels] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingEbook, setEditingEbook] = useState<AdminEbook | null>(null)
  const [deletingEbook, setDeletingEbook] = useState<AdminEbook | null>(null)
  const [publishingEbook, setPublishingEbook] = useState<AdminEbook | null>(null)
  const [archivingEbook, setArchivingEbook] = useState<AdminEbook | null>(null)
  const [viewingEbook, setViewingEbook] = useState<AdminEbook | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
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

  const canManageEbooks =
    isAuthenticated && role === 'admin' && status === 'active'

  const loadEbooks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setEbooks(await listAdminEbooks())
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Unable to load ebooks.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadLevels = useCallback(async () => {
    setIsLoadingLevels(true)

    try {
      setLevels(await getLevels())
    } catch (loadError) {
      setFormError(getErrorMessage(loadError, 'Unable to load levels.'))
    } finally {
      setIsLoadingLevels(false)
    }
  }, [])

  useEffect(() => {
    if (canManageEbooks) {
      void loadEbooks()
    }
  }, [canManageEbooks, loadEbooks])

  const openCreateForm = () => {
    setTitle('')
    setLevelId('')
    setHeyzineUrl('')
    setFormError(null)
    setSuccessMessage(null)
    setIsCreateOpen(true)
    void loadLevels()
  }

  const openEditForm = (ebook: AdminEbook) => {
    setTitle(ebook.title)
    setLevelId(ebook.level_id)
    setHeyzineUrl(ebook.heyzine_url)
    setFormError(null)
    setSuccessMessage(null)
    setEditingEbook(ebook)
    void loadLevels()
  }

  const closeForm = () => {
    setIsCreateOpen(false)
    setEditingEbook(null)
    setFormError(null)
  }

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedUrl = validateHeyzineUrl(heyzineUrl)
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setFormError('Ebook title is required.')
      return
    }

    if (trimmedTitle.length > 200) {
      setFormError('Ebook title must be 200 characters or fewer.')
      return
    }

    if (!levelId) {
      setFormError('Select a level.')
      return
    }

    if (!normalizedUrl) {
      setFormError('Enter an HTTPS heyzine.com URL without credentials, ports, or fragments.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    setSuccessMessage(null)

    try {
      await createAdminEbook({
        levelId,
        title: trimmedTitle,
        heyzineUrl: normalizedUrl,
      })
      closeForm()
      setSuccessMessage('Ebook draft created successfully.')
      await loadEbooks()
    } catch (createError) {
      setFormError(getErrorMessage(createError, 'Unable to create ebook draft.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editingEbook) {
      return
    }

    const normalizedUrl = validateHeyzineUrl(heyzineUrl)
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setFormError('Ebook title is required.')
      return
    }

    if (trimmedTitle.length > 200) {
      setFormError('Ebook title must be 200 characters or fewer.')
      return
    }

    if (!levelId) {
      setFormError('Select a level.')
      return
    }

    if (!normalizedUrl) {
      setFormError('Enter an HTTPS heyzine.com URL without credentials, ports, or fragments.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    setSuccessMessage(null)

    try {
      await updateAdminEbookDraft({
        ebookId: editingEbook.ebook_id,
        levelId,
        title: trimmedTitle,
        heyzineUrl: normalizedUrl,
      })
      closeForm()
      setSuccessMessage('Ebook draft updated successfully.')
      await loadEbooks()
    } catch (updateError) {
      setFormError(getErrorMessage(updateError, 'Unable to update ebook draft.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEbook) {
      return
    }

    setIsDeleting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await deleteAdminEbookDraft(deletingEbook.ebook_id)
      setDeletingEbook(null)
      setSuccessMessage('Ebook draft deleted successfully.')
      await loadEbooks()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Unable to delete ebook draft.'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePublish = async () => {
    if (!publishingEbook) {
      return
    }

    setIsPublishing(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await publishAdminEbook(publishingEbook.ebook_id)
      setPublishingEbook(null)
      setSuccessMessage('Ebook published successfully.')
      await loadEbooks()
    } catch (publishError) {
      setError(getErrorMessage(publishError, 'Unable to publish ebook.'))
    } finally {
      setIsPublishing(false)
    }
  }

  const handleArchive = async () => {
    if (!archivingEbook) {
      return
    }

    setIsArchiving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await archiveAdminEbook(archivingEbook.ebook_id)
      setArchivingEbook(null)
      setSuccessMessage('Ebook archived successfully.')
      await loadEbooks()
    } catch (archiveError) {
      setError(getErrorMessage(archiveError, 'Unable to archive ebook.'))
    } finally {
      setIsArchiving(false)
    }
  }

  const currentPublishedEbook = publishingEbook
    ? ebooks.find(
      (ebook) => ebook.level_id === publishingEbook.level_id && ebook.status === 'published',
    )
    : null

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
        <p className="mt-2">You do not have permission to manage ebooks.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Ebook Management</h2>
          <p className="mt-2 text-sm text-slate-600">Create and review Student Core Ebook drafts.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-sm font-medium text-slate-700 underline">
            Back to Admin
          </Link>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Add Ebook
          </button>
        </div>
      </div>

      {successMessage && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      )}

      {(isCreateOpen || editingEbook) && (
        <form onSubmit={editingEbook ? handleUpdate : handleCreate} className="mt-8 max-w-2xl rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">
            {editingEbook ? 'Edit Ebook Draft' : 'Create Ebook Draft'}
          </h3>
          {editingEbook && (
            <p className="mt-2 text-sm text-slate-600">Status: Draft</p>
          )}
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Title
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                disabled={isSaving}
                className="mt-1 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 disabled:bg-slate-100"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Level
              <select
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
                required
                disabled={isSaving || isLoadingLevels}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900 disabled:bg-slate-100"
              >
                <option value="">{isLoadingLevels ? 'Loading levels...' : 'Select a level'}</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Heyzine URL
              <input
                type="url"
                value={heyzineUrl}
                onChange={(event) => setHeyzineUrl(event.target.value)}
                placeholder="https://heyzine.com/flip-book/..."
                required
                disabled={isSaving}
                className="mt-1 w-full rounded-lg border px-4 py-3 outline-none focus:ring-2 disabled:bg-slate-100"
              />
            </label>

            {formError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSaving || isLoadingLevels}
                className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingEbook ? 'Save Changes' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {deletingEbook && (
        <section className="mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6">
          <h3 className="text-xl font-semibold text-red-900">Delete this draft ebook?</h3>
          <p className="mt-2 text-sm text-red-800">
            This will permanently remove the draft ebook record for “{deletingEbook.title}”.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setDeletingEbook(null)}
              disabled={isDeleting}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </section>
      )}

      {publishingEbook && (
        <section className="mt-6 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-xl font-semibold text-amber-900">Publish this ebook?</h3>
          <p className="mt-2 text-sm text-amber-800">
            {currentPublishedEbook
              ? 'This will replace the current published ebook for this level. The current ebook will be archived.'
              : 'Students with an active enrollment in this level will be able to receive this ebook.'}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setPublishingEbook(null)}
              disabled={isPublishing}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={isPublishing}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </section>
      )}

      {archivingEbook && (
        <section className="mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6">
          <h3 className="text-xl font-semibold text-red-900">Archive this published ebook?</h3>
          <p className="mt-2 text-sm text-red-800">
            This ebook is currently published. Archiving it will remove it from Student access unless another ebook is published for this level.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => setArchivingEbook(null)}
              disabled={isArchiving}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleArchive()}
              disabled={isArchiving}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isArchiving ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </section>
      )}

      {viewingEbook && (
        <section className="mt-6 max-w-2xl rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Archived Ebook</h3>
              <p className="mt-2 text-sm text-slate-600">{viewingEbook.level_name} · {viewingEbook.title}</p>
            </div>
            <button
              type="button"
              onClick={() => setViewingEbook(null)}
              className="text-sm font-medium text-slate-700 underline"
            >
              Close
            </button>
          </div>
          <a
            href={viewingEbook.heyzine_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-medium text-slate-700 underline"
          >
            Open Heyzine URL
          </a>
        </section>
      )}

      <div className="mt-8 overflow-hidden rounded-xl border bg-white shadow-sm">
        {isLoading && <p className="p-6 text-sm text-slate-600">Loading ebooks...</p>}

        {error && (
          <p className="m-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {!isLoading && !error && ebooks.length === 0 && (
          <div className="p-6">
            <p className="text-sm text-slate-600">No ebooks have been created yet.</p>
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Add Ebook
            </button>
          </div>
        )}

        {!isLoading && !error && ebooks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-semibold">Level</th>
                  <th className="px-6 py-3 font-semibold">Title</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Heyzine URL</th>
                  <th className="px-6 py-3 font-semibold">Updated At</th>
                  <th className="px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ebooks.map((ebook) => (
                  <tr key={ebook.ebook_id} className="text-slate-700">
                    <td className="px-6 py-4">{ebook.level_name}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{ebook.title}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {ebook.status}
                      </span>
                    </td>
                    <td className="max-w-64 truncate px-6 py-4" title={ebook.heyzine_url}>
                      {ebook.heyzine_url}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(ebook.updated_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {ebook.status === 'draft' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditForm(ebook)}
                              className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingEbook(ebook)}
                              className="rounded px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setPublishingEbook(ebook)}
                              className="rounded px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50"
                            >
                              Publish
                            </button>
                          </>
                        )}
                        {ebook.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => setArchivingEbook(ebook)}
                            className="rounded px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Archive
                          </button>
                        )}
                        {ebook.status === 'archived' && (
                          <button
                            type="button"
                            onClick={() => setViewingEbook(ebook)}
                            className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            View
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(ebook.heyzine_url)}
                          className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Copy URL
                        </button>
                        <a
                          href={ebook.heyzine_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Open URL
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/kursus-bahasa-inggris-anak')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/kursus-bahasa-inggris-online')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})

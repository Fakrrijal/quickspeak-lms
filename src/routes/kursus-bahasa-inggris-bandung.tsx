import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/kursus-bahasa-inggris-bandung')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})

import { createRootRoute } from '@tanstack/react-router'
import { AppLayout } from '../layouts/app/AppLayout'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        title: 'Kursus Bahasa Inggris | QuickSpeak English Course',
      },
      {
        name: 'description',
        content:
          'QuickSpeak English Course menyediakan kursus Bahasa Inggris online dan di Bandung dengan pembelajaran terstruktur, 4 level, private dan semi-private.',
      },
      {
        name: 'robots',
        content: 'index, follow',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/favicon.png',
        sizes: '96x96',
        type: 'image/png',
      },
    ],
  }),
  component: AppLayout,
})
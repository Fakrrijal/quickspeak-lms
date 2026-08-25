import { createRootRoute } from '@tanstack/react-router'
import { AppLayout } from '../layouts/app/AppLayout'

export const Route = createRootRoute({
  component: AppLayout,
})
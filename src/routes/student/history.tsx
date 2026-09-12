import { createFileRoute } from '@tanstack/react-router'
import { StudentHistoryPage } from '../../components/student/StudentHistoryPage'

export const Route = createFileRoute('/student/history')({ component: StudentHistoryPage })

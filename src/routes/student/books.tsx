import { createFileRoute } from '@tanstack/react-router'
import { StudentBooksPage } from '../../components/student/StudentBooksPage'

export const Route = createFileRoute('/student/books')({ component: StudentBooksPage })

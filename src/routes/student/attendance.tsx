import { createFileRoute } from '@tanstack/react-router'
import { StudentAttendancePageV3 } from '../../components/student/StudentAttendancePageV3'

export const Route = createFileRoute('/student/attendance')({ component: StudentAttendancePageV3 })

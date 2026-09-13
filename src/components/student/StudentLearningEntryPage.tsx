import { StudentBooksPage } from './StudentBooksPage'
import { StudentLearningPageV2 } from './StudentLearningPageV2'

export function StudentLearningEntryPage() {
  const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null

  if (view === 'books') {
    return <StudentBooksPage />
  }

  return (
    <>
      <style>{`section[aria-labelledby="learning-materials-title"] { display: none !important; }`}</style>
      <StudentLearningPageV2 />
    </>
  )
}

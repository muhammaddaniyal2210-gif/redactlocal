import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { DocumentRedactorLanding } from './components/DocumentRedactorLanding'
import { Redactor } from './pages/Redactor'
import { LANDINGS } from './content/landings'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Redactor />} />

            {/* One route per high-intent query, generated from the content table. */}
            {LANDINGS.map((config) => (
              <Route
                key={config.slug}
                path={`/${config.slug}`}
                element={<DocumentRedactorLanding {...config} />}
              />
            ))}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { ThemeProvider } from './context/ThemeContext'
import OverviewDashboard from './pages/OverviewDashboard'
import InteractiveDashboard from './pages/InteractiveDashboard'
import LoaderShowcase from './pages/LoaderShowcase'

const basename =
  import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/'
    ? import.meta.env.BASE_URL.replace(/\/$/, '')
    : '/'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<OverviewDashboard />} />
            <Route path="/interactive" element={<InteractiveDashboard />} />
            <Route path="/loaders" element={<LoaderShowcase />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

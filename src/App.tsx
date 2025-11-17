import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { ThemeProvider } from './context/ThemeContext'
import OverviewDashboard from './pages/OverviewDashboard'
import InteractiveDashboard from './pages/InteractiveDashboard'
import LoaderShowcase from './pages/LoaderShowcase'

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<OverviewDashboard />} />
            <Route path="/interactive" element={<InteractiveDashboard />} />
            <Route path="/loaders" element={<LoaderShowcase />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}

export default App

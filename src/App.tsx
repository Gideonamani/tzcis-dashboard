import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import OverviewDashboard from './pages/OverviewDashboard'
import InteractiveDashboard from './pages/InteractiveDashboard'
import AppLayout from './components/AppLayout'
import { ThemeProvider } from './context/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<OverviewDashboard />} />
            <Route path="/interactive" element={<InteractiveDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

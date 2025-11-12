import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import OverviewDashboard from './pages/OverviewDashboard'
import InteractiveDashboard from './pages/InteractiveDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OverviewDashboard />} />
        <Route path="/interactive" element={<InteractiveDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { Routes, Route } from 'react-router-dom'
import GeneratorPage from './pages/GeneratorPage'
import StudentPage from './pages/StudentPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<GeneratorPage />} />
      <Route path="/quiz/:id" element={<StudentPage />} />
    </Routes>
  )
}

export default App

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import { VoiceCallPage } from './components/VoiceCallPage';
import { AIQAPage } from './components/AIQAPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voice-call" element={<VoiceCallPage />} />
        <Route path="/ai-qa" element={<AIQAPage />} />
      </Routes>
    </Router>
  );
}

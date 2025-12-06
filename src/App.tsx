import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/home/HomePage';
import { VoiceCallPage } from './pages/voiceCall/VoiceCallPage';
import { AIQAPage } from './pages/aiQa/AIQAPage';

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

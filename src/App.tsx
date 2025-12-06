import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/home/HomePage';
import VoiceCall from './pages/voiceCall/VoiceCallPage';
import AIQAPage from './pages/aiQa/AIQAPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/voice-call" element={<VoiceCall />} />
        <Route path="/ai-qa" element={<AIQAPage />} />
      </Routes>
    </Router>
  );
}

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/home/Home';
import VoiceCall from './pages/voiceCall/VoiceCall';
import AIQA from './pages/aiQa/AIQA';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/voice-call" element={<VoiceCall />} />
        <Route path="/ai-qa" element={<AIQA />} />
      </Routes>
    </Router>
  );
}

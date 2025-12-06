import { useNavigate } from 'react-router-dom';
import { Mic, MessageSquare, Volume2, MessageCircle, FileText } from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* 9:16 容器 */}
      <div className="w-full max-w-[56.25vh] h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
        {/* 顶部品牌区 - 15% */}
        <div className="h-[15%] flex flex-col items-center justify-center px-8 py-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-white" style={{ fontSize: '36px' }}>AI 数字人助手</h1>
          </div>
          <p className="text-gray-300" style={{ fontSize: '20px' }}>语音 & 文字智能问答</p>
        </div>

        {/* 中部主操作区 - 30% */}
        <div className="h-[30%] flex items-center justify-center px-8">
          <div className="flex gap-4 w-full">
            {/* 语音通话按钮 */}
            <button
              onClick={() => navigate('/voice-call')}
              className="flex-1 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 active:scale-95 group"
            >
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all">
                <Mic className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <h2 className="text-white mb-2" style={{ fontSize: '26px' }}>语音通话</h2>
                <p className="text-blue-100" style={{ fontSize: '16px' }}>点击开始与数字人语音对话</p>
              </div>
            </button>

            {/* AI问答按钮 */}
            <button
              onClick={() => navigate('/ai-qa')}
              className="flex-1 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 active:scale-95 group"
            >
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-all">
                <MessageCircle className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <h2 className="text-white mb-2" style={{ fontSize: '26px' }}>AI问答</h2>
                <p className="text-purple-100" style={{ fontSize: '16px' }}>点击进入AI问答界面</p>
              </div>
            </button>
          </div>
        </div>

        {/* 底部产品介绍区 - 55% */}
        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-10 w-full shadow-2xl">
            <h2 className="text-slate-800 mb-4 text-center" style={{ fontSize: '34px' }}>智能数字人互动系统</h2>
            
            <p className="text-slate-600 text-center mb-8 leading-relaxed" style={{ fontSize: '20px' }}>
              支持自然语音对话与文字对话<br />
              可回答产品、门店、活动等多种问题
            </p>

            {/* 能力点 */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-5 bg-slate-50 rounded-2xl p-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Volume2 className="w-11 h-11 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-800 mb-1" style={{ fontSize: '22px' }}>语音实时问答</h3>
                  <p className="text-slate-600" style={{ fontSize: '17px' }}>自然流畅的语音交互体验</p>
                </div>
              </div>

              <div className="flex items-center gap-5 bg-slate-50 rounded-2xl p-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-11 h-11 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-800 mb-1" style={{ fontSize: '22px' }}>多轮智能对话</h3>
                  <p className="text-slate-600" style={{ fontSize: '17px' }}>理解上下文,精准回答</p>
                </div>
              </div>

              <div className="flex items-center gap-5 bg-slate-50 rounded-2xl p-6">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-11 h-11 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-800 mb-1" style={{ fontSize: '22px' }}>支持文件讲解</h3>
                  <p className="text-slate-600" style={{ fontSize: '17px' }}>上传文档,智能解读</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
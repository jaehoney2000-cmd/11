import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || '알 수 없는 오류가 발생했습니다.',
    };
  }

  public componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Graceful error capture for recovery screen without console clutter
  }

  private handleResetCache = () => {
    try {
      // Clear local session if corrupted
      localStorage.removeItem('market_quest_config');
      localStorage.removeItem('market_student_key');
      localStorage.removeItem('market_is_teacher');
    } catch {}
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border-2 border-amber-200 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="font-jua text-2xl text-slate-900">
              시장경제 퀘스트 복구 안내
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed">
              페이지를 불러오는 중 일시적인 오류가 감지되었습니다.
              <br />
              새로고침을 누르시거나 아래 버튼으로 캐시를 초기화해 주세요.
            </p>
            {this.state.errorMessage && (
              <div className="p-3 bg-slate-100 rounded-xl text-left text-xs font-mono text-slate-600 overflow-x-auto max-h-24">
                {this.state.errorMessage}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="font-jua text-sm py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                새로고침
              </button>
              <button
                onClick={this.handleResetCache}
                className="font-jua text-sm py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                데이터 초기화
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

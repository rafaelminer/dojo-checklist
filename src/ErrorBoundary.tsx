import React from "react";

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] bg-[#0B0F0E] text-white flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[13px] font-bold tracking-wide uppercase text-[#9AA5A1]">Dojo Checklist</p>
          <h1 className="font-extrabold text-[24px] mt-3">Algo deu errado</h1>
          <p className="text-[14px] text-[#9AA5A1] mt-2 max-w-[420px] leading-relaxed">
            O app encontrou um erro inesperado. Seus dados salvos continuam no banco.
          </p>
          <pre className="mt-4 max-w-[420px] w-full overflow-auto rounded-2xl bg-[#161D1B] p-3 text-left text-[11px] text-[#FFB4B0]">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-2xl bg-[#FF6B1A] text-white font-extrabold px-6 py-3.5"
          >
            Recarregar app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

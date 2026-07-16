import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DEFAULT_UI_STATE, saveUiState } from '../core/uiState';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Alpine Legacy runtime failure', error, info.componentStack);
  }

  private returnToMenu = () => {
    saveUiState(DEFAULT_UI_STATE);
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="release-crash-screen">
        <section>
          <span>ALPINE LEGACY / RECOVERY</span>
          <h1>Интерфейс остановлен.</h1>
          <p>Сейв не удалён. Перезапусти экран или вернись в главное меню. Предыдущий ход остаётся в резервной копии.</p>
          <div>
            <button onClick={() => window.location.reload()}>Перезапустить</button>
            <button onClick={this.returnToMenu}>В главное меню</button>
          </div>
          <details><summary>Техническая информация</summary><code>{this.state.error.message}</code></details>
        </section>
      </main>
    );
  }
}

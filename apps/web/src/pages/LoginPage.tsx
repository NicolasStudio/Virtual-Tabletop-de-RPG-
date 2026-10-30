import { useSearchParams } from 'react-router-dom';

// O Tabletop usa a conta da Ficha Ordem Paranormal: o login é feito lá, e a
// página tabletop.html da Ficha abre a sessão aqui (POST /api/auth/firebase).
const FICHA_URL =
  import.meta.env.VITE_FICHA_URL ?? 'https://nicolasstudio.github.io/Ficha_ordem/tabletop.html';

export function LoginPage() {
  const [params] = useSearchParams();
  const error = params.get('erro');

  return (
    <div className="auth-wrap">
      <div className="card auth-card" aria-labelledby="login-h">
        <h1 id="login-h">Entrar</h1>
        {error && (
          <p className="badge err" role="alert">
            {error}
          </p>
        )}
        <p className="muted">
          O Tabletop usa a mesma conta da <strong>Ficha Ordem Paranormal</strong>. Entre na Ficha e
          escolha <strong>Tabletop</strong> no menu ☰.
        </p>
        <button className="btn" type="button" onClick={() => window.location.assign(FICHA_URL)}>
          Entrar pela Ficha
        </button>
      </div>
    </div>
  );
}

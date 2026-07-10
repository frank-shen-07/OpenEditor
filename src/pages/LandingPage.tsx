import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo, ThemeToggle } from "../components/Chrome";
import { useTheme } from "../hooks/useTheme";

const FEATURES = [
  {
    title: "Visual OpenAPI editor",
    description: "Edit paths, parameters, request bodies, and responses in a Swagger-style UI.",
  },
  {
    title: "Import Swagger 2.0 or OpenAPI 3",
    description: "Drop in existing YAML or JSON specs — legacy formats are normalized automatically.",
  },
  {
    title: "Schema from example",
    description: "Paste a real API response and let OpenEditor infer the JSON Schema for you.",
  },
  {
    title: "Cloud sync",
    description: "Sign in to save multiple specs. Changes auto-save to your account.",
  },
];

export function LandingPage() {
  const { user, loading, authAvailable } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!loading && user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="page landing-page">
      <header className="page-header">
        <div className="wrapper page-header-inner">
          <Logo />
          <div className="page-header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            {authAvailable ? (
              <>
                <Link className="btn" to="/auth">
                  Log in
                </Link>
                <Link className="btn btn-execute" to="/auth?mode=register">
                  Get started
                </Link>
              </>
            ) : (
              <Link className="btn btn-execute" to="/app">
                Open editor
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="wrapper">
            <p className="landing-eyebrow">OpenAPI / Swagger editor</p>
            <h1 className="landing-title">Document your API without fighting YAML</h1>
            <p className="landing-lead">
              OpenEditor is a visual editor for OpenAPI specs. Import existing docs, edit
              endpoints, generate schemas from examples, and export clean YAML.
            </p>
            <div className="landing-cta">
              {authAvailable ? (
                <>
                  <Link className="btn btn-execute btn-lg" to="/auth?mode=register">
                    Create free account
                  </Link>
                  <Link className="btn btn-lg" to="/auth">
                    Log in
                  </Link>
                </>
              ) : (
                <Link className="btn btn-execute btn-lg" to="/app">
                  Open editor
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="landing-features">
          <div className="wrapper">
            <div className="landing-feature-grid">
              {FEATURES.map((feature) => (
                <article className="landing-feature-card" key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="wrapper landing-footer-inner">
          <span className="muted">OpenEditor — built for developers documenting real APIs.</span>
        </div>
      </footer>
    </div>
  );
}

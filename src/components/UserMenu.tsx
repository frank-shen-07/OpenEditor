import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="auth-panel">
      <span className="auth-user mono">{user.displayName}</span>
      <button className="btn btn-sm" type="button" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}

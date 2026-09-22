import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";

/** Returns a guard that sends guests to sign-in and reports whether to continue. */
export function useRequireAuth(): () => boolean {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (user) return true;
    notify(t.auth.required);
    navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  }, [user, notify, navigate, location.pathname, location.search]);
}

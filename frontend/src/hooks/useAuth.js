import { useAuthContext } from "@/context/AuthContext";

/**
 * useAuth — thin hook over AuthContext.
 * Use this in any component instead of importing AuthContext directly.
 */
export function useAuth() {
  return useAuthContext();
}

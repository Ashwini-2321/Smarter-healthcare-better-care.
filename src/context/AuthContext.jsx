import { useEffect, useState } from "react";
import { AuthContext } from "./authContext";
import { apiRequest } from "../services/api";

const STORAGE_KEY = "clinexa-session";

function readStoredSession() {
  const storedSession = window.localStorage.getItem(STORAGE_KEY);
  if (!storedSession) {
    return null;
  }

  try {
    const session = JSON.parse(storedSession);
    if (
      typeof session.token === "string" &&
      session.user &&
      typeof session.user.name === "string" &&
      typeof session.user.email === "string" &&
      ["patient", "doctor", "admin"].includes(session.user.role)
    ) {
      return session;
    }
    throw new Error("Stored session is incomplete.");
  } catch (error) {
    console.error("Could not restore the saved Clinexa session.", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const token = session?.token;

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isMounted = true;
    apiRequest("/api/auth/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ user }) => {
        if (isMounted) {
          const restoredSession = { token, user };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(restoredSession));
          setSession(restoredSession);
        }
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        if (error.status === 401 || error.status === 404) {
          window.localStorage.removeItem(STORAGE_KEY);
          setSession(null);
          return;
        }
        console.error("Could not validate the saved Clinexa session.", error);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function authenticate(path, credentials) {
    const nextSession = await apiRequest(path, {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    return nextSession.user;
  }

  function login(credentials) {
    return authenticate("/api/auth/login", credentials);
  }

  function register(credentials) {
    return authenticate("/api/auth/register", credentials);
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }

  async function updateProfile(profile) {
    const { user } = await apiRequest("/api/auth/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(profile),
    });
    const nextSession = { token, user };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    return user;
  }

  return (
    <AuthContext.Provider
      value={{
        token: session?.token || null,
        user: session?.user || null,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

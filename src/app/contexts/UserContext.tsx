"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

type UserContextType = {
  isAdmin: boolean;
  userInfo: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    avatar?: string | null;
  } | null;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  isAdmin: false,
  userInfo: null,
  loading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userInfo, setUserInfo] = useState<UserContextType["userInfo"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/hackers/${user.id}`);
          const data = await response.json();

          setUserInfo({
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role,
            avatar: data.avatar?.url,
          });

          setIsAdmin(data.role === "ADMIN");
        } catch (error) {
          console.error("Error fetching user info:", error);
        } finally {
          setLoading(false);
        }
      } else if (isLoaded) {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [user?.id, isLoaded]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner spinner-small"></div>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ isAdmin, userInfo, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserContext = () => useContext(UserContext);
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

type UserContextType = {
  isAdmin: boolean;
  userInfo: {
    id: string;
    name: string;
    email: string | null;
    role: string | null;
    avatar?: {
      url: string;
    } | null;
    bio?: string | null;
    githubUrl?: string | null;
    phoneNumber?: string | null;
    likes?: Array<{
      projectId: string;
      createdAt: string;
    }>;
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
          // Get the hacker using clerkId
          const hackerResponse = await fetch(`/api/hackers?clerkId=${user.id}`);
          if (!hackerResponse.ok) throw new Error("Failed to fetch hacker ID");
          const hackerData = await hackerResponse.json();

          // Get the full hacker profile using the Prisma ID
          const profileResponse = await fetch(`/api/hackers/${hackerData.id}`);
          if (!profileResponse.ok)
            throw new Error("Failed to fetch hacker profile");
          const profileData = await profileResponse.json();

          setUserInfo({
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
            role: profileData.role,
            avatar: profileData.avatar,
            bio: profileData.bio,
            githubUrl: profileData.githubUrl,
            phoneNumber: profileData.phoneNumber,
            likes: profileData.likes, // Include likes from the profile data
          });

          setIsAdmin(profileData.role === "ADMIN");
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

  return (
    <UserContext.Provider value={{ isAdmin, userInfo, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserContext = () => useContext(UserContext);


import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useUserData } from "@/hooks/useUserData";

export const UserAvatar = ({ size = "default" }: { size?: "xs" | "sm" | "default" | "lg" }) => {
  const { user } = useAuth();
  const { data } = useUserData();
  
  const getInitial = () => {
    // Try display_name first, then email
    const displayName = data?.profile?.display_name;
    if (displayName) {
      return displayName.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "?";
  };
  
  const sizeClasses = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-sm",
    default: "h-12 w-12 text-lg",
    lg: "h-16 w-16 text-2xl"
  };
  
  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarFallback className="bg-primary text-primary-foreground">
        {getInitial()}
      </AvatarFallback>
    </Avatar>
  );
};

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AuthModal } from './AuthModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Settings } from 'lucide-react';

export const ProfileSection: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const getUserData = () => {
    if (!user) return null;
    
    // Get user data from metadata or use defaults
    const userData = user.user_metadata || {};
    return {
      name: userData.username || 'Admin',
      plan: userData.plan || 'Pro Plan',
      credits: userData.credits || '999,999',
      email: user.email || '',
      initials: (userData.username || 'Admin').charAt(0).toUpperCase() + 
                (userData.username || 'Admin').split(' ')[1]?.charAt(0)?.toUpperCase() || 'A'
    };
  };

  if (loading) {
    return (
      <div className="flex-shrink-0 mt-2 space-y-2 pb-2">
        <div className="w-full h-16 bg-card-alt rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="flex-shrink-0 mt-2 space-y-2 pb-2">
          <Button 
            onClick={() => setShowAuthModal(true)}
            className="w-full h-16 bg-card-alt border border-border-main hover:border-accent-primary transition-colors"
            variant="ghost"
          >
            <div className="text-center">
              <div className="text-text-primary font-medium text-sm">Sign In</div>
              <div className="text-text-secondary text-xs">Access your playlists</div>
            </div>
          </Button>
        </div>
        
        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  const userData = getUserData()!;

  return (
    <>
      <div className="flex-shrink-0 mt-2 space-y-2 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center p-2 lg:p-2.5 bg-[#262626] rounded-lg hover:bg-[#2a2a2a] transition-colors">
              <Avatar className="w-6 h-6 lg:w-7 lg:h-7 mr-2 flex-shrink-0">
                <AvatarImage src="/api/placeholder/32/32" alt={userData.name} />
                <AvatarFallback className="bg-accent-primary text-white font-semibold text-xs">
                  {userData.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <div className="text-white font-medium text-xs lg:text-sm truncate">{userData.name}</div>
                <div className="text-gray-400 text-xs truncate">{userData.plan}</div>
                <div className="text-gray-400 text-xs truncate">Credits - {userData.credits}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={signOut}
              className="flex items-center gap-2 text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Upgrade Link */}
        <div className="text-center">
          <button className="text-accent-primary hover:text-accent-primary/80 text-xs font-medium transition-colors">
            Upgrade / Top Up
          </button>
        </div>
      </div>
      
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};
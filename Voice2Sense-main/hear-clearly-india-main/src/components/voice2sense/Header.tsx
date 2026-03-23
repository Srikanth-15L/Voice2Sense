import { Languages, History, Settings, LogOut, PhoneForwarded, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INDIAN_LANGUAGES } from "@/types/voice2sense";
import { authAPI } from "@/integrations/api/authAPI";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  sourceLanguage: string;
  onSourceChange: (code: string) => void;
  onSettingsClick: () => void;
  onHistoryClick: () => void;
  onRelayClick: () => void;
  onChatbotClick: () => void;
}

const Header = ({
  sourceLanguage,
  onSourceChange,
  onSettingsClick,
  onHistoryClick,
  onRelayClick,
  onChatbotClick,
}: HeaderProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      navigate("/auth");
    }
  };

  return (
    <header className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 py-4 border-b border-border bg-card gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Languages className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary">Voice2Sense</h1>
          <p className="text-[10px] md:text-xs text-muted-foreground">Real-Time Multilingual Closed Captioning</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs md:sm font-medium text-muted-foreground whitespace-nowrap">Speaking In:</span>
          <Select value={sourceLanguage} onValueChange={onSourceChange}>
            <SelectTrigger className="w-full md:w-[150px] lg:w-[180px] bg-card border-primary/20 h-9 text-sm">
              <SelectValue placeholder="Select Language" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0">
          <Button
            variant="outline"
            onClick={onChatbotClick}
            size="sm"
            className="flex-1 md:flex-none gap-2 border-blue-500/40 text-blue-700 dark:text-blue-400 hover:bg-blue-500/10 h-9"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chatbot</span>
          </Button>
          <Button
            variant="outline"
            onClick={onRelayClick}
            size="sm"
            className="flex-1 md:flex-none gap-2 border-green-500/40 text-green-700 dark:text-green-400 hover:bg-green-500/10 h-9"
          >
            <PhoneForwarded className="w-4 h-4" />
            <span className="hidden sm:inline">Phone Support</span>
          </Button>
          <Button
            variant="outline"
            onClick={onHistoryClick}
            size="sm"
            className="flex-1 md:flex-none gap-2 h-9"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button
            variant="outline"
            onClick={onSettingsClick}
            size="sm"
            className="h-9 w-9 p-0"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <Button
            onClick={handleLogout}
            size="sm"
            className="flex-1 md:flex-none gap-2 bg-red-600 hover:bg-red-700 text-white border-none h-9"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
import React, { useRef } from 'react';
import { 
  Menu, Link as LinkIcon, Plus, Search, 
  LayoutGrid, Milestone, Settings, BarChart2, FolderHeart, 
  HelpCircle, Upload, Eye, EyeOff, Loader2, Globe, Sun, Moon, StickyNote, Cloud
} from 'lucide-react';
import { FilterState } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  captureInput: string;
  onCaptureInputChange: (value: string) => void;
  onIngest: () => void;
  isIngesting: boolean;
  onFileUpload: (files: FileList) => void;
  onAddNote: () => void;
  filter: FilterState;
  onFilterChange: (patch: Partial<FilterState>) => void;
  view: 'grid' | 'canvas';
  onViewChange: (view: 'grid' | 'canvas') => void;
  onOpenDashboard: () => void;
  onOpenImportExport: () => void;
  onOpenSettings: () => void;
  currentUser: any;
  onLogout: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  captureInput,
  onCaptureInputChange,
  onIngest,
  isIngesting,
  onFileUpload,
  onAddNote,
  filter,
  onFilterChange,
  view,
  onViewChange,
  onOpenDashboard,
  onOpenImportExport,
  onOpenSettings,
  currentUser,
  onLogout,
  darkMode,
  onToggleTheme
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onIngest();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
    }
    // Reset file input so that same file can be uploaded again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <header 
      className="sticky top-0 bg-[var(--app-bg)]/85 backdrop-blur-2xl border-b border-[var(--border)] flex items-center justify-between shrink-0 z-[100] gap-3 select-none"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
        paddingBottom: '0.75rem',
        paddingLeft: 'max(env(safe-area-inset-left), 1.5rem)',
        paddingRight: 'max(env(safe-area-inset-right), 1.5rem)'
      }}
    >
      {/* Burger Menu for mobile */}
      <button 
        onClick={onToggleSidebar}
        className="md:hidden text-[var(--text)] hover:opacity-80 p-2 hover:bg-[var(--text)]/5 rounded-2xl transition shrink-0 border border-[var(--border)]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Main Brand Logo */}
      <div className="hidden md:flex items-center gap-2 group cursor-pointer select-none mr-4">
        <span className="font-display text-[26px] leading-none tracking-[0.04em] text-[var(--text)]">
          VIAS<span className="inline-block w-[0.2em] h-[0.2em] rounded-full bg-[var(--text)] ml-[0.1em]" />
        </span>
      </div>

      {/* Capture input box */}
      <div className="flex-1 max-w-[520px] flex items-center gap-2 relative group">
        <label className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none group-focus-within:text-[var(--text)] transition-colors">
          <LinkIcon className="w-4 h-4" />
        </label>
        
        <input 
          type="text" 
          placeholder="Archive link or content..." 
          value={captureInput || ''}
          onChange={(e) => onCaptureInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isIngesting}
          className="w-full h-11 bg-transparent border border-[var(--border-bright)] text-[var(--text)] pl-11 pr-[80px] rounded-full text-[13px] font-normal focus:outline-none focus:border-[var(--text)] focus:bg-[var(--text)]/[0.05] transition-all disabled:opacity-50 placeholder:text-[var(--text-dim)]"
        />

        {isIngesting ? (
          <Loader2 className="absolute right-[80px] top-1/2 -translate-y-1/2 text-[var(--text)] w-4 h-4 animate-spin shrink-0" />
        ) : null}

        <button 
          onClick={onAddNote}
          title="Add Text Note"
          className="absolute right-10 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] p-1.5 hover:bg-[var(--text)]/10 rounded-xl transition shrink-0 active:scale-90"
        >
          <StickyNote className="w-4 h-4" />
        </button>

        <button 
          onClick={() => fileInputRef.current?.click()}
          title="Upload local files"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] p-1.5 hover:bg-[var(--text)]/10 rounded-xl transition shrink-0 active:scale-90"
        >
          <Plus className="w-4 h-4" />
        </button>

        <input 
          type="file" 
          ref={fileInputRef}
          multiple 
          accept="image/*,video/*,application/pdf,.html,.htm" 
          className="hidden" 
          onChange={handleFileChange}
        />
      </div>

      {/* Desktop Search */}
      <div className="relative max-w-[200px] lg:max-w-[280px] hidden md:block transition-all group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)] w-3.5 h-3.5 group-focus-within:text-[var(--text)] transition-colors" />
        <input 
          type="text" 
          placeholder="Search items..." 
          value={filter.search || ''}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="w-full h-11 bg-transparent border border-[var(--border-bright)] text-[var(--text)] pl-10 pr-4 rounded-full text-[13px] font-normal focus:outline-none focus:border-[var(--text)] focus:bg-[var(--text)]/[0.05] transition-all placeholder:text-[var(--text-dim)]"
        />
      </div>

      {/* Layout selector (Grid / Spatial) */}
      <div className="hidden md:flex p-1 rounded-full border border-[var(--border-bright)] shrink-0">
        <button 
          onClick={() => onViewChange('grid')}
          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-wide transition flex items-center gap-2 ${view === 'grid' ? 'bg-[var(--text)] text-[var(--on)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>
        <button 
          onClick={() => onViewChange('canvas')}
          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-wide transition flex items-center gap-2 ${view === 'canvas' ? 'bg-[var(--text)] text-[var(--on)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
        >
          <BarChart2 className="w-3.5 h-3.5 rotate-90" />
          <span>Canvas</span>
        </button>
      </div>

      {/* Auxiliary settings */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <button 
          onClick={onToggleTheme}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--text)]/5 rounded-full transition active:scale-90 border border-[var(--border-bright)]"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button 
          onClick={onOpenSettings}
          title="System Settings"
          className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--text)]/5 rounded-full transition active:scale-90 border border-[var(--border-bright)]"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button 
          onClick={onOpenImportExport}
          title="Data Backup & Sync"
          className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--text)]/5 rounded-full transition active:scale-90 border border-[var(--border-bright)]"
        >
          <Cloud className="w-4 h-4" />
        </button>

        {currentUser && (
          <button 
            onClick={onLogout}
            title={`Sign Out (${currentUser.email})`}
            className="h-11 px-3 flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--text)]/5 rounded-full transition active:scale-90 border border-[var(--border-bright)]"
          >
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} className="w-6 h-6 rounded-full border border-[var(--border)]" alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[var(--text)] flex items-center justify-center text-[10px] font-bold text-[var(--on)]">
                {currentUser.email?.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="hidden lg:block text-[11px] font-bold tracking-tight">Sign Out</span>
          </button>
        )}
      </div>
    </header>

  );
};

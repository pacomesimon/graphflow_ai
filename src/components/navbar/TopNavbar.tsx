import React, { useState } from 'react';
import { 
  Share2, 
  Download, 
  Upload, 
  Cpu, 
  Layers, 
  Activity, 
  Network, 
  Check, 
  Columns, 
  Sun, 
  Moon,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { ModelArchitectureSpec, RuntimeDimensions, PrecisionType, DistributedConfig } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export type ActiveViewMode = 'canvas' | 'roofline' | 'distributed' | 'bento';

interface TopNavbarProps {
  viewMode: ActiveViewMode;
  onSetViewMode: (mode: ActiveViewMode) => void;
  spec: ModelArchitectureSpec;
  onImportConfig: (configJson: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  viewMode,
  onSetViewMode,
  spec,
  onImportConfig,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const [copied, setCopied] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (evt.target?.result) {
            onImportConfig(evt.target.result as string);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <header className={`h-14 border-b px-4 flex items-center justify-between z-30 shrink-0 transition-colors ${
      isDark 
        ? 'bg-slate-900 border-slate-800 text-slate-100' 
        : 'bg-white border-slate-200 text-slate-800 shadow-sm'
    }`}>
      {/* Brand & Scale Indicator & Sidebar Toggle */}
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle Button */}
        <button
          onClick={onToggleSidebar}
          title={isSidebarCollapsed ? "Expand Parameters Sidebar" : "Collapse Parameters Sidebar"}
          className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs ${
            isDark 
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700' 
              : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          {isSidebarCollapsed ? (
            <>
              <PanelLeft className="w-4 h-4 text-sky-500" />
              <span className="hidden sm:inline font-mono text-[11px]">Config</span>
            </>
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-md shadow-sky-600/20 text-white">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-bold tracking-tight text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                GraphFlow<span className="text-sky-500 font-normal">-AI</span>
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                isDark ? 'bg-sky-950 text-sky-400 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200'
              }`}>
                {spec.tag || `${(spec.summary.totalParameters / 1e9).toFixed(1)}B`}
              </span>
            </div>
            <p className={`text-[10px] hidden sm:block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Modular PyTorch Deep Learning Architect
            </p>
          </div>
        </div>
      </div>

      {/* Center View Switcher */}
      <div className={`flex items-center p-1 rounded-xl border text-xs font-mono transition-colors ${
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          onClick={() => onSetViewMode('bento')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
            viewMode === 'bento'
              ? 'bg-sky-600 text-white shadow font-medium'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Bento Split-Screen: Interactive Canvas with Analytical Dashboards"
        >
          <Columns className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Studio Bento</span>
        </button>

        <button
          onClick={() => onSetViewMode('canvas')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
            viewMode === 'canvas'
              ? 'bg-sky-600 text-white shadow font-medium'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Full-Screen Modular Canvas"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Graph Canvas</span>
        </button>

        <button
          onClick={() => onSetViewMode('roofline')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
            viewMode === 'roofline'
              ? 'bg-sky-600 text-white shadow font-medium'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Dynamic Roofline Model & Compute Analyzer"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Roofline</span>
        </button>

        <button
          onClick={() => onSetViewMode('distributed')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
            viewMode === 'distributed'
              ? 'bg-sky-600 text-white shadow font-medium'
              : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
          }`}
          title="Cluster Hardware & Communication Latency Profiler"
        >
          <Network className="w-3.5 h-3.5" />
          <span>Topology</span>
        </button>
      </div>

      {/* Right Controls: Theme Switch, Export, Import, Share */}
      <div className="flex items-center gap-2">
        {/* Light / Dark Mode Toggle Switch */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          className={`p-1.5 px-2 rounded-lg border flex items-center gap-1.5 text-xs font-mono transition-colors ${
            isDark 
              ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-[11px]">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-slate-700" />
              <span className="hidden sm:inline text-[11px]">Dark</span>
            </>
          )}
        </button>

        {/* Export JSON */}
        <button
          onClick={handleExportJSON}
          className={`p-1.5 px-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
          title="Export Complete Model Architecture JSON Configuration"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export JSON</span>
        </button>

        {/* Import JSON */}
        <button
          onClick={triggerImport}
          className={`p-1.5 px-2 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
            isDark
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
          }`}
          title="Import JSON Architecture File"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import</span>
        </button>

        {/* Share Link */}
        <button
          onClick={handleShare}
          className="p-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
          title="Copy Shareable Collaborative Link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Share'}</span>
        </button>
      </div>
    </header>
  );
};

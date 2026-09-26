import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Edit3, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  FileCode
} from 'lucide-react';
import { ModelArchitectureSpec } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface ModelJsonModalProps {
  spec: ModelArchitectureSpec;
  isOpen: boolean;
  onClose: () => void;
  onApplyJsonSpec: (updatedSpec: ModelArchitectureSpec) => void;
}

export const ModelJsonModal: React.FC<ModelJsonModalProps> = ({
  spec,
  isOpen,
  onClose,
  onApplyJsonSpec
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setJsonText(JSON.stringify(spec, null, 2));
      setIsEditing(false);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, spec]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApply = () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
        throw new Error('JSON specification must include a "blocks" array.');
      }
      if (!parsed.connections || !Array.isArray(parsed.connections)) {
        throw new Error('JSON specification must include a "connections" array.');
      }
      onApplyJsonSpec(parsed);
      setSuccessMsg('Architecture specification successfully loaded and applied to graph!');
      setTimeout(() => {
        setIsEditing(false);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(`JSON Validation Error: ${err.message || 'Syntax error'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div 
        className={`w-full max-w-4xl h-[85vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-600'
            }`}>
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span>Model Architecture JSON Schema</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  isDark ? 'bg-slate-800 text-sky-400 border-slate-700' : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}>
                  {spec.blocks.length} Blocks • {spec.connections.length} Connections
                </span>
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Detailed representation of every layer, parameter matrix, tensor flow, and cluster allocation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isEditing
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                  : isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              {isEditing ? 'View Mode' : 'Edit Mode'}
            </button>

            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handleDownload}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>

            <button 
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-500 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Editor / Viewer Body */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col">
          {isEditing ? (
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className={`w-full flex-1 p-3 font-mono text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
              spellCheck={false}
            />
          ) : (
            <pre className={`w-full flex-1 p-3 font-mono text-xs rounded-xl border overflow-auto custom-scrollbar ${
              isDark ? 'bg-slate-950 border-slate-800 text-emerald-400/90' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              {jsonText}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="text-[11px] font-mono text-slate-400">
            Total Params: {(spec.summary.totalParameters / 1e9).toFixed(1)}B • VRAM Footprint: {spec.summary.memoryFootprintGB} GB
          </div>

          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleApply}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Apply JSON to Graph
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

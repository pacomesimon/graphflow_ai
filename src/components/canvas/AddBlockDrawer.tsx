import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Layers, 
  Zap, 
  Box, 
  Database, 
  GitBranch, 
  Network, 
  Cpu, 
  Binary, 
  Search,
  Sparkles,
  Check
} from 'lucide-react';
import { 
  ModularBlock, 
  PyTorchModuleType, 
  BlockCategory, 
  CustomBlockDefinition 
} from '../../types';
import { PREDEFINED_BLOCK_LIBRARY, PredefinedBlockTemplate } from '../../engine/blockLibrary';
import { useTheme } from '../../context/ThemeContext';

interface AddBlockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBlock: (blockTemplate: PredefinedBlockTemplate | CustomBlockDefinition) => void;
  customBlocks: CustomBlockDefinition[];
  onSaveCustomBlock: (newBlock: CustomBlockDefinition) => void;
}

export const AddBlockDrawer: React.FC<AddBlockDrawerProps> = ({
  isOpen,
  onClose,
  onAddBlock,
  customBlocks,
  onSaveCustomBlock
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'catalog' | 'create'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form state for creating a new block type
  const [customName, setCustomName] = useState('');
  const [customModuleType, setCustomModuleType] = useState('nn.CustomBlock');
  const [customCategory, setCustomCategory] = useState<BlockCategory>('custom');
  const [customDescription, setCustomDescription] = useState('');
  const [customParamsStr, setCustomParamsStr] = useState('{\n  "inDim": 8192,\n  "outDim": 8192,\n  "paramMultiplier": 1\n}');
  const [customFormula, setCustomFormula] = useState('P = inDim × outDim');
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const allAvailableBlocks: (PredefinedBlockTemplate | CustomBlockDefinition)[] = [
    ...PREDEFINED_BLOCK_LIBRARY,
    ...customBlocks
  ];

  const filteredBlocks = allAvailableBlocks.filter(b => {
    const matchesQuery = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.moduleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || b.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customName.trim()) {
      setFormError('Please provide a name for this custom block.');
      return;
    }

    let parsedParams: Record<string, any> = {};
    try {
      parsedParams = JSON.parse(customParamsStr);
    } catch (err) {
      setFormError('Invalid JSON format in custom parameters.');
      return;
    }

    const newDef: CustomBlockDefinition = {
      id: `custom_type_${Date.now()}`,
      name: customName.trim(),
      moduleType: customModuleType.trim() || 'nn.CustomBlock',
      category: customCategory,
      description: customDescription.trim() || 'User-defined modular block',
      defaultParameters: parsedParams,
      paramSchema: Object.keys(parsedParams).map(k => ({
        key: k,
        label: k,
        type: typeof parsedParams[k] === 'boolean' ? 'boolean' : 'number',
        defaultValue: parsedParams[k]
      })),
      formulaSummary: customFormula.trim() || 'Custom arithmetic formula',
      color: 'purple'
    };

    onSaveCustomBlock(newDef);
    onAddBlock(newDef);
    onClose();
  };

  const getCategoryIcon = (cat: BlockCategory) => {
    switch (cat) {
      case 'attention': return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      case 'ffn': return <Layers className="w-3.5 h-3.5 text-violet-500" />;
      case 'moe': return <GitBranch className="w-3.5 h-3.5 text-purple-500" />;
      case 'conv': return <Box className="w-3.5 h-3.5 text-emerald-500" />;
      case 'embedding': return <Database className="w-3.5 h-3.5 text-blue-500" />;
      case 'norm': return <Network className="w-3.5 h-3.5 text-cyan-500" />;
      case 'head': return <Binary className="w-3.5 h-3.5 text-rose-500" />;
      case 'ssm': return <Cpu className="w-3.5 h-3.5 text-teal-500" />;
      default: return <Cpu className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
      <div 
        className={`w-full max-w-lg h-full border-l shadow-2xl flex flex-col transition-all overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'
        }`}>
          <div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Modular Block Builder & Library
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Select existing PyTorch layers or create a custom layer architecture
            </p>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className={`px-4 pt-3 flex gap-2 border-b shrink-0 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'catalog'
                ? 'border-sky-500 text-sky-500 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Existing Blocks ({allAvailableBlocks.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-sky-500 text-sky-500 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create New Block Type
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'catalog' && (
            <div className="space-y-3">
              {/* Search & Category Filter */}
              <div className="space-y-2">
                <div className={`relative flex items-center border rounded-lg px-2.5 py-1.5 ${
                  isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-300'
                }`}>
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search modular blocks (e.g. conv, attention, norm)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-200">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {['all', 'attention', 'ffn', 'moe', 'conv', 'norm', 'embedding', 'ssm'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 rounded-full capitalize border transition-all ${
                        selectedCategory === cat
                          ? 'bg-sky-500 text-white border-sky-400 shadow-xs'
                          : isDark
                          ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Block Cards List */}
              <div className="space-y-2.5 pt-2">
                {filteredBlocks.map((blk) => (
                  <div
                    key={blk.id}
                    className={`p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                      isDark ? 'bg-slate-800/60 border-slate-700/80 hover:border-sky-500/60' : 'bg-white border-slate-200 hover:border-sky-500 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg border ${
                          isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                        }`}>
                          {getCategoryIcon(blk.category)}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold">{blk.name}</h4>
                          <span className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                            isDark ? 'bg-slate-900 text-sky-400 border-slate-700' : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>
                            {blk.moduleType}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onAddBlock(blk);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1 shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Block
                      </button>
                    </div>

                    <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {blk.description}
                    </p>

                    <div className={`p-2 rounded border text-[10px] font-mono ${
                      isDark ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">Parameters & Formula</div>
                      <div className="truncate">{blk.formulaSummary}</div>
                      <div className="text-slate-400 mt-1 flex flex-wrap gap-x-3">
                        {Object.entries(blk.defaultParameters).map(([k, v]) => (
                          <span key={k}>{k}: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{String(v)}</strong></span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateBlock} className="space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs font-medium block mb-1">Block Display Name *</label>
                <input
                  type="text"
                  placeholder="e.g. FlashAttention-3 Chunked"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Module Identifier</label>
                  <input
                    type="text"
                    placeholder="e.g. nn.FlashAttention3"
                    value={customModuleType}
                    onChange={(e) => setCustomModuleType(e.target.value)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Category</label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as BlockCategory)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                    }`}
                  >
                    <option value="attention">Attention</option>
                    <option value="ffn">Feed-Forward (FFN)</option>
                    <option value="moe">MoE Expert</option>
                    <option value="conv">Convolutional (Conv)</option>
                    <option value="norm">Normalization</option>
                    <option value="ssm">SSM / State Space</option>
                    <option value="custom">General Custom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Description / Spec</label>
                <input
                  type="text"
                  placeholder="e.g. Chunked hardware-optimized FP8 attention mechanism"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Parameters Schema (JSON format)</label>
                <textarea
                  rows={4}
                  value={customParamsStr}
                  onChange={(e) => setCustomParamsStr(e.target.value)}
                  className={`w-full rounded-lg p-2 font-mono text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Formula Summary</label>
                <input
                  type="text"
                  placeholder="e.g. P = 4 × d_model² | FLOPs = 4 × S × d_model"
                  value={customFormula}
                  onChange={(e) => setCustomFormula(e.target.value)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Save to Reusable Library & Add to Architecture
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

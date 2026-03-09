import { safeSetLocalStorage } from '../../utils/safeStorage';

import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../../types';
import { NSTA_DEFAULT_FEATURES } from '../../constants';
import { Save, Lock, Zap, CheckCircle, Settings, Plus, Trash2, RotateCcw, BrainCircuit } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    onUpdateSettings: (s: SystemSettings) => void;
    onBack: () => void;
}

export const NstaFeatureManager: React.FC<Props> = ({ settings, onUpdateSettings, onBack }) => {
    // Initialize config from settings (if exists) or merge with NSTA defaults
    const [config, setConfig] = useState<any[]>(() => {
        const storedConfig = settings.featureConfig || {};

        // Merge stored config with NSTA defaults to ensure all keys exist
        return NSTA_DEFAULT_FEATURES.map(def => {
            const stored = storedConfig[def.id];
            if (stored) {
                return { ...def, ...stored };
            }
            return def;
        });
    });

    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const categories = ['ALL', ...Array.from(new Set(config.map(f => f.category)))];

    // State for Adding New Feature
    const [showAddModal, setShowAddModal] = useState(false);
    const [newFeature, setNewFeature] = useState({ id: '', label: '', category: 'CUSTOM' });

    // Save Changes
    const saveChanges = () => {
        // Convert array back to object map for storage
        const featureConfigMap: Record<string, any> = {};
        config.forEach(f => {
            featureConfigMap[f.id] = f;
        });

        const updatedSettings = {
            ...settings,
            featureConfig: featureConfigMap
        };

        // Ensure parent component receives update immediately
        onUpdateSettings(updatedSettings);

        // Also persist locally as fallback
        safeSetLocalStorage('nst_system_settings', JSON.stringify(updatedSettings));

        alert("NSTA Configuration Saved Successfully!");
    };

    const handleReset = () => {
        if(confirm("Reset all features to NSTA Defaults? This will wipe custom limits.")) {
            setConfig(NSTA_DEFAULT_FEATURES);
        }
    };

    const toggleVisibility = (id: string) => {
        setConfig(prev => prev.map(f => f.id === id ? { ...f, visible: !f.visible } : f));
    };

    const handleTierToggle = (id: string, tier: 'FREE' | 'BASIC' | 'ULTRA') => {
        setConfig(prev => prev.map(f => {
            if (f.id !== id) return f;
            const currentTiers = f.allowedTiers || ['FREE', 'BASIC', 'ULTRA'];
            const newTiers = currentTiers.includes(tier)
                ? currentTiers.filter((t: string) => t !== tier)
                : [...currentTiers, tier];
            return { ...f, allowedTiers: newTiers };
        }));
    };

    const handleLimitChange = (id: string, tier: string, value: string) => {
        setConfig(prev => prev.map(f => {
            if (f.id !== id) return f;
            const limits = { ...f.limits, [tier.toLowerCase()]: value === '' ? undefined : Number(value) };
            if (value === '') delete limits[tier.toLowerCase()];
            return { ...f, limits };
        }));
    };

    const handleCostChange = (id: string, value: string) => {
        setConfig(prev => prev.map(f => f.id === id ? { ...f, creditCost: Number(value) } : f));
    };

    const handleAddFeature = () => {
        if (!newFeature.id || !newFeature.label) return alert("ID and Label required!");
        const newItem = {
            id: newFeature.id.toUpperCase().replace(/\s+/g, '_'),
            label: newFeature.label,
            category: newFeature.category,
            visible: true,
            allowedTiers: ['FREE', 'BASIC', 'ULTRA'],
            limits: {},
            creditCost: 0
        };
        setConfig([...config, newItem]);
        setShowAddModal(false);
        setNewFeature({ id: '', label: '', category: 'CUSTOM' });
    };

    const handleDeleteFeature = (id: string) => {
        if(confirm("Delete this feature control?")) {
            setConfig(prev => prev.filter(f => f.id !== id));
        }
    };

    const filteredConfig = activeCategory === 'ALL' ? config : config.filter(f => f.category === activeCategory);

    const localSettings = settings;
    const setLocalSettings = onUpdateSettings;

    return (
        <div className="bg-slate-50 min-h-screen p-6 animate-in fade-in pb-32">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 text-slate-600">
                        &larr;
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <Settings className="text-violet-600" /> NSTA Control Panel
                        </h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Master Feature Management</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleReset} className="px-4 py-2 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 flex items-center gap-2">
                        <RotateCcw size={16} /> Reset
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2">
                        <Plus size={16} /> Add Feature
                    </button>
                </div>
            </div>

            {/* --- REVISION LOGIC CONFIGURATION --- */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><BrainCircuit size={18} className="text-purple-500" /> Revision Engine Config</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Strong Topic (Min %)</label>
                    <input
                        type="number"
                        value={localSettings.revisionConfig?.thresholds.strong ?? 80}
                        onChange={(e) => setLocalSettings({
                            ...localSettings,
                            revisionConfig: {
                                ...localSettings.revisionConfig!,
                                thresholds: {
                                    ...localSettings.revisionConfig?.thresholds!,
                                    strong: parseInt(e.target.value) || 0
                                }
                            } as any
                        })}
                        className="w-full p-2 border rounded-lg font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Scores above this are "Strong"</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Average Topic (Min %)</label>
                    <input
                        type="number"
                        value={localSettings.revisionConfig?.thresholds.average ?? 50}
                        onChange={(e) => setLocalSettings({
                            ...localSettings,
                            revisionConfig: {
                                ...localSettings.revisionConfig!,
                                thresholds: {
                                    ...localSettings.revisionConfig?.thresholds!,
                                    average: parseInt(e.target.value) || 0
                                }
                            } as any
                        })}
                        className="w-full p-2 border rounded-lg font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Scores between this and Strong are "Average"</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Mastery Score (Min %)</label>
                    <input
                        type="number"
                        value={localSettings.revisionConfig?.thresholds.mastery ?? 80}
                        onChange={(e) => setLocalSettings({
                            ...localSettings,
                            revisionConfig: {
                                ...localSettings.revisionConfig!,
                                thresholds: {
                                    ...localSettings.revisionConfig?.thresholds!,
                                    mastery: parseInt(e.target.value) || 0
                                }
                            } as any
                        })}
                        className="w-full p-2 border rounded-lg font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Score needed to count towards Mastery</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Mastery Count</label>
                    <input
                        type="number"
                        value={localSettings.revisionConfig?.mastery.requiredCount ?? 2}
                        onChange={(e) => setLocalSettings({
                            ...localSettings,
                            revisionConfig: {
                                ...localSettings.revisionConfig!,
                                mastery: {
                                    requiredCount: parseInt(e.target.value) || 1
                                }
                            } as any
                        })}
                        className="w-full p-2 border rounded-lg font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">How many times user must score high to Master a topic</p>
                </div>
            </div>

            {/* TIME INTERVALS */}
            <div className="space-y-6">
                {['weak', 'average', 'strong', 'mastered'].map(status => {
                    // Helper to get seconds safely
                    const getSeconds = (type: 'revision' | 'mcq') => {
                        // @ts-ignore
                        return localSettings.revisionConfig?.intervals?.[status]?.[type] || 0;
                    };

                    // Helper to update seconds
                    const updateSeconds = (type: 'revision' | 'mcq', totalSeconds: number) => {
                            const newIntervals = {
                                weak: { revision: 86400, mcq: 259200 },
                                average: { revision: 259200, mcq: 432000 },
                                strong: { revision: 604800, mcq: 864000 },
                                mastered: { revision: 2592000, mcq: 864000 },
                                ...(localSettings.revisionConfig?.intervals || {})
                            };
                            // @ts-ignore
                            newIntervals[status] = {
                                // @ts-ignore
                                ...newIntervals[status],
                                [type]: totalSeconds
                            };

                            setLocalSettings({
                                ...localSettings,
                                revisionConfig: {
                                    thresholds: localSettings.revisionConfig?.thresholds || { strong: 80, average: 50, mastery: 80 },
                                    mastery: localSettings.revisionConfig?.mastery || { requiredCount: 2 },
                                    intervals: newIntervals
                                }
                            });
                    };

                    const renderTimeInput = (label: string, type: 'revision' | 'mcq', color: string) => {
                        const totalSeconds = getSeconds(type);
                        const d = Math.floor(totalSeconds / (24 * 3600));
                        const h = Math.floor((totalSeconds % (24 * 3600)) / 3600);
                        const m = Math.floor((totalSeconds % 3600) / 60);

                        return (
                            <div className={`p-3 rounded-xl border ${color} bg-white flex flex-col gap-2`}>
                                <span className="text-[10px] font-bold uppercase">{label}</span>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={d} onChange={e => updateSeconds(type, (parseInt(e.target.value||'0')*86400) + h*3600 + m*60)} className="w-12 p-1 border rounded text-xs font-bold text-center" /> d
                                    <input type="number" value={h} onChange={e => updateSeconds(type, d*86400 + (parseInt(e.target.value||'0')*3600) + m*60)} className="w-12 p-1 border rounded text-xs font-bold text-center" /> h
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div key={status} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-700 capitalize mb-3">{status} Status Topic</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {renderTimeInput('Next Revision Note Date', 'revision', 'border-blue-200 text-blue-700')}
                                {renderTimeInput('Next MCQ Practice Date', 'mcq', 'border-purple-200 text-purple-700')}
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>

            {/* Category Filter - Horizontal Scroll */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide touch-pan-x">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border shrink-0 ${
                            activeCategory === cat ? 'bg-violet-600 text-white border-violet-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Feature Grid - Mobile Optimized */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
                {filteredConfig.map((feature) => (
                    <div key={feature.id} className={`bg-white p-3 rounded-xl border transition-all ${feature.visible ? 'border-slate-200 shadow-sm' : 'border-red-100 bg-red-50/30 grayscale'}`}>
                        {/* Header Row */}
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">{feature.category}</span>
                                    <h3 className="font-bold text-sm text-slate-800 truncate">{feature.label}</h3>
                                </div>
                                <p className="text-[8px] font-mono text-slate-400 mt-0.5 truncate">{feature.id}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button
                                    onClick={() => toggleVisibility(feature.id)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${feature.visible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                                >
                                    {feature.visible ? <CheckCircle size={16}/> : <Lock size={16}/>}
                                </button>
                                <button onClick={() => handleDeleteFeature(feature.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 rounded hover:bg-slate-50">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Controls - Compact Grid */}
                        <div className={`space-y-2 ${!feature.visible ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* Tiers Toggle */}
                            <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                {['FREE', 'BASIC', 'ULTRA'].map(tier => {
                                    const isAllowed = (feature.allowedTiers || ['FREE', 'BASIC', 'ULTRA']).includes(tier);
                                    return (
                                        <button
                                            key={tier}
                                            onClick={() => handleTierToggle(feature.id, tier as any)}
                                            className={`py-1.5 rounded text-[9px] font-bold border transition-all ${
                                                isAllowed
                                                ? (tier === 'FREE' ? 'bg-green-50 border-green-200 text-green-700' : tier === 'BASIC' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-purple-50 border-purple-200 text-purple-700')
                                                : 'bg-white border-slate-200 text-slate-300'
                                            }`}
                                        >
                                            {tier}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Inputs Row */}
                            <div className="grid grid-cols-4 gap-2">
                                {/* Limits */}
                                {['Free', 'Basic', 'Ultra'].map(tier => {
                                    const isAllowed = (feature.allowedTiers || ['FREE', 'BASIC', 'ULTRA']).includes(tier.toUpperCase());
                                    const limitVal = feature.limits?.[tier.toLowerCase()] ?? '';

                                    return (
                                        <div key={tier} className="relative">
                                            <input
                                                type="number"
                                                placeholder={isAllowed ? "∞" : "-"}
                                                disabled={!isAllowed}
                                                value={limitVal}
                                                onChange={(e) => handleLimitChange(feature.id, tier, e.target.value)}
                                                className={`w-full py-1.5 px-1 text-[10px] font-bold text-center border rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500 ${!isAllowed ? 'bg-slate-100 cursor-not-allowed' : 'bg-white border-slate-200'}`}
                                            />
                                            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] bg-white px-1 text-slate-400 uppercase font-bold">{tier.charAt(0)}</span>
                                        </div>
                                    );
                                })}

                                {/* Cost */}
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={feature.creditCost || 0}
                                        onChange={(e) => handleCostChange(feature.id, e.target.value)}
                                        className="w-full py-1.5 px-1 text-[10px] font-bold text-center border border-orange-200 bg-orange-50/50 rounded-lg text-orange-700 focus:outline-none"
                                    />
                                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] bg-white px-1 text-orange-500 uppercase font-bold">Cost</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* STICKY SAVE BUTTON - COMPACT MOBILE */}
            <div className="fixed bottom-8 right-6 z-[9999] flex justify-end safe-area-bottom">
                <button
                    onClick={saveChanges}
                    className="w-12 h-12 bg-green-600 text-white rounded-full shadow-2xl hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center border-2 border-white"
                    title="Save Changes"
                >
                    <Save size={20} />
                </button>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
                        <h3 className="font-black text-xl text-slate-800 mb-4">Add New Feature</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                                <input
                                    type="text"
                                    value={newFeature.category}
                                    onChange={(e) => setNewFeature({...newFeature, category: e.target.value})}
                                    className="w-full p-2 border rounded-lg mt-1 font-bold"
                                    list="categories"
                                />
                                <datalist id="categories">
                                    {categories.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Feature ID (Unique)</label>
                                <input
                                    type="text"
                                    value={newFeature.id}
                                    onChange={(e) => setNewFeature({...newFeature, id: e.target.value})}
                                    className="w-full p-2 border rounded-lg mt-1 font-mono uppercase"
                                    placeholder="MY_NEW_FEATURE"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Label</label>
                                <input
                                    type="text"
                                    value={newFeature.label}
                                    onChange={(e) => setNewFeature({...newFeature, label: e.target.value})}
                                    className="w-full p-2 border rounded-lg mt-1"
                                    placeholder="My Feature Name"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg">Cancel</button>
                            <button onClick={handleAddFeature} className="flex-1 py-2 bg-violet-600 text-white font-bold rounded-lg hover:bg-violet-700">Add Feature</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

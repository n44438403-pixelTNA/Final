import React, { useState } from 'react';
import { SystemSettings, FeatureCategory } from '../types';
import { DollarSign, Eye, Save, Search, Settings, Lock, Package, Trash2, Edit3, X, Plus, Crown, LayoutGrid, List, CheckSquare, Gamepad2, BrainCircuit, Activity, BarChart3, Star, Zap, PenTool, Banknote, Layers, Megaphone } from 'lucide-react';

interface Props {
    settings: SystemSettings;
    onUpdate: (s: SystemSettings) => void;
}

export const AdminPowerManager: React.FC<Props> = ({ settings, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'PRICING' | 'VISIBILITY' | 'POPUP_MANAGER'>('PRICING');
    const [localSettings, setLocalSettings] = useState<SystemSettings>(settings);

    const updateSetting = (key: keyof SystemSettings, value: any) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        onUpdate(newSettings);
    };

    return (
        <div className="p-6 bg-white min-h-[500px]">
            {/* TABS */}
            <div className="flex flex-wrap gap-2 mb-6 bg-slate-100 p-1.5 rounded-xl w-fit">
                {[
                    { id: 'PRICING', icon: DollarSign, label: 'Pricing & Costs' },
                    { id: 'VISIBILITY', icon: Eye, label: 'Visibility' },
                    { id: 'POPUP_MANAGER', icon: Megaphone, label: 'Popup Manager' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* TAB 3: POPUP MANAGER */}
            {activeTab === 'POPUP_MANAGER' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2"><Megaphone size={18} /> Admin Custom Popups</h4>
                        <button 
                            onClick={() => {
                                const newPopup = {
                                    enabled: true,
                                    title: 'New Notification',
                                    message: 'Enter your message here...',
                                    type: 'INFO',
                                    showTo: 'ALL'
                                };
                                const updated = [...(localSettings.adminCustomPopups || []), newPopup];
                                updateSetting('adminCustomPopups', updated);
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                        >
                            <Plus size={14} /> Add New Popup
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {(localSettings.adminCustomPopups || []).map((popup, idx) => (
                            <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative group">
                                <button 
                                    onClick={() => {
                                        const updated = (localSettings.adminCustomPopups || []).filter((_, i) => i !== idx);
                                        updateSetting('adminCustomPopups', updated);
                                    }}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status & Type</label>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].enabled = !updated[idx].enabled;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${popup.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                                                >
                                                    {popup.enabled ? 'ACTIVE' : 'DISABLED'}
                                                </button>
                                                <select 
                                                    value={popup.type}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].type = e.target.value as any;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    className="bg-white border rounded-lg px-2 py-1 text-xs font-bold outline-none"
                                                >
                                                    <option value="INFO">Information Popup</option>
                                                    <option value="DISCOUNT">Discount Event Popup</option>
                                                    <option value="FREE_CREDIT">Free Credit Popup</option>
                                                    <option value="FREE_ACCESS">Free Full Access Popup</option>
                                                    <option value="SUBSCRIPTION">Premium Subscription Popup</option>
                                                    <option value="CREDIT">Credit Popup</option>
                                                    <option value="EXPIRY">Subscription Expiry Popup</option>
                                                    <option value="NOTIFICATION">Notification Popup</option>
                                                    <option value="UPDATE">App Update Popup</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Audience</label>
                                            <select 
                                                value={popup.showTo}
                                                onChange={(e) => {
                                                    const updated = [...(localSettings.adminCustomPopups || [])];
                                                    updated[idx].showTo = e.target.value as any;
                                                    updateSetting('adminCustomPopups', updated);
                                                }}
                                                className="w-full bg-white border rounded-lg px-3 py-2 text-xs font-bold outline-none"
                                            >
                                                <option value="ALL">All Students</option>
                                                <option value="FREE">Free Users Only</option>
                                                <option value="PREMIUM">Premium Users Only</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Show Every (Hours)</label>
                                                <input
                                                    type="number"
                                                    value={popup.intervalHours !== undefined ? popup.intervalHours : 4}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].intervalHours = Number(e.target.value);
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    placeholder="e.g. 4"
                                                    className="w-full bg-white border rounded-lg px-3 py-2 text-xs outline-none font-bold"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Class</label>
                                                <input 
                                                    type="text"
                                                    value={popup.class || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].class = e.target.value;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    placeholder="e.g. 10th"
                                                    className="w-full bg-white border rounded-lg px-3 py-2 text-xs outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subject</label>
                                                <input 
                                                    type="text"
                                                    value={popup.subject || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].subject = e.target.value;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    placeholder="e.g. Math"
                                                    className="w-full bg-white border rounded-lg px-3 py-2 text-xs outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Action Button Text</label>
                                                <input 
                                                    type="text"
                                                    value={popup.actionText || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].actionText = e.target.value;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    placeholder="e.g. Claim Now / Update App"
                                                    className="w-full bg-white border rounded-lg px-3 py-2 text-xs outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Action URL / Link</label>
                                                <input 
                                                    type="text"
                                                    value={popup.actionUrl || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].actionUrl = e.target.value;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    placeholder="e.g. https://play.google.com/..."
                                                    className="w-full bg-white border rounded-lg px-3 py-2 text-xs outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 lg:col-span-2">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Popup Title</label>
                                            <input 
                                                type="text"
                                                value={popup.title}
                                                onChange={(e) => {
                                                    const updated = [...(localSettings.adminCustomPopups || [])];
                                                    updated[idx].title = e.target.value;
                                                    updateSetting('adminCustomPopups', updated);
                                                }}
                                                className="w-full bg-white border rounded-lg px-3 py-2 text-sm font-bold outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Message (Content)</label>
                                            <textarea 
                                                value={popup.message}
                                                onChange={(e) => {
                                                    const updated = [...(localSettings.adminCustomPopups || [])];
                                                    updated[idx].message = e.target.value;
                                                    updateSetting('adminCustomPopups', updated);
                                                }}
                                                rows={3}
                                                className="w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none resize-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Copyable Code/Text</label>
                                                <input 
                                                    type="text"
                                                    value={popup.copyableText || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].copyableText = e.target.value;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    placeholder="Enter code to copy"
                                                    className="w-full bg-white border rounded-lg px-3 py-2 text-xs outline-none font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Lesson Name</label>
                                                <input 
                                                    type="text"
                                                    value={popup.lesson || ''}
                                                    onChange={(e) => {
                                                        const updated = [...(localSettings.adminCustomPopups || [])];
                                                        updated[idx].lesson = e.target.value;
                                                        updateSetting('adminCustomPopups', updated);
                                                    }}
                                                    placeholder="e.g. Light Reflection"
                                                    className="w-full bg-white border rounded-lg px-3 py-2 text-xs outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {(!localSettings.adminCustomPopups || localSettings.adminCustomPopups.length === 0) && (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <Megaphone className="mx-auto text-slate-300 mb-4" size={48} />
                                <p className="text-slate-500 font-medium">No custom popups configured yet.</p>
                            </div>
                        )}
                    </div>

                    {/* SYSTEM POPUPS PREVIEW */}
                    <div className="mt-12 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                        <h4 className="font-bold text-blue-900 mb-4 flex items-center gap-2"><Settings size={18} /> System Managed Popups</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { label: 'Force App Update', desc: 'Controlled via DEPLOY Tab', status: localSettings.latestVersion ? 'ACTIVE' : 'INACTIVE' },
                                { label: 'Daily Challenge', desc: 'Controlled via CONFIG_CHALLENGE', status: localSettings.dailyChallengeConfig?.mode === 'AUTO' ? 'ACTIVE' : 'INACTIVE' },
                                { label: 'First Day Bonus', desc: 'Automatic System Rule (1hr Ultra)', status: 'ALWAYS ACTIVE' },
                                { label: 'Low Score Alert', desc: 'Automatic (< 40% Score)', status: 'ALWAYS ACTIVE' },
                            ].map((p, i) => (
                                <div key={i} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                                    <p className="font-bold text-blue-900 text-sm mb-1">{p.label}</p>
                                    <p className="text-[10px] text-blue-600 mb-2">{p.desc}</p>
                                    <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{p.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 1: PRICING */}
            {activeTab === 'PRICING' && (
                <div className="space-y-6">
                    {/* GLOBAL COSTS */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2"><DollarSign size={16} /> Content Credit Costs (0 = Free)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { key: 'defaultPdfCost', label: 'PDF Access', default: 5 },
                                { key: 'defaultVideoCost', label: 'Video Access', default: 5 },
                                { key: 'mcqTestCost', label: 'MCQ Test Entry', default: 2 },
                                { key: 'mcqAnalysisCost', label: 'MCQ Analysis', default: 5 },
                                { key: 'mcqAnalysisCostUltra', label: 'Ultra Analysis', default: 20 },
                                { key: 'mcqHistoryCost', label: 'History View', default: 1 },
                                { key: 'chatCost', label: 'AI Chat Msg', default: 1 },
                                { key: 'gameCost', label: 'Spin Wheel', default: 0 },
                                { key: 'universalPrizeEnabled', label: 'Universal Prize List', default: 1 },
                            ].map((item) => (
                                <div key={item.key} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{item.label}</label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs">🪙</span>
                                        <input
                                            type="number"
                                            // @ts-ignore
                                            value={localSettings[item.key] !== undefined ? localSettings[item.key] : item.default}
                                            onChange={(e) => updateSetting(item.key as keyof SystemSettings, Number(e.target.value))}
                                            className="w-full p-1.5 border rounded font-bold text-sm"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: VISIBILITY */}
            {activeTab === 'VISIBILITY' && (
                <div className="space-y-6">
                     <div className="p-4 border rounded-xl bg-slate-50 col-span-1 md:col-span-2">
                         <h4 className="font-bold text-slate-700 text-sm mb-4">Module Visibility</h4>
                         <div className="flex flex-wrap gap-4">
                             {[
                                 {key: 'isChatEnabled', label: 'Chat Module'},
                                 {key: 'isGameEnabled', label: 'Game Module'},
                                 {key: 'isPaymentEnabled', label: 'Payment Gateway'},
                                 {key: 'allowSignup', label: 'Allow Signups'},
                                 {key: 'showGoogleLogin', label: 'Google Auth (Login)'},
                             ].map(mod => (
                                 <label key={mod.key} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm cursor-pointer hover:bg-slate-50">
                                     <input
                                        type="checkbox"
                                        // @ts-ignore
                                        checked={localSettings[mod.key] !== false}
                                        onChange={e => updateSetting(mod.key as keyof SystemSettings, e.target.checked)}
                                        className="accent-green-600 w-4 h-4"
                                     />
                                     <span className="text-xs font-bold text-slate-700">{mod.label}</span>
                                 </label>
                             ))}
                         </div>
                     </div>
                </div>
            )}
        </div>
    );
};

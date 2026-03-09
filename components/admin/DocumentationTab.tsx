import React, { useState } from 'react';
import { APP_DOCUMENTATION } from '../../utils/appDocumentation';
import { BookOpen, ChevronDown, ChevronRight, FileText, Layout, Shield, User, Zap, Grid, List, Search } from 'lucide-react';

export const DocumentationTab: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'PAGES' | 'FEATURES' | 'ADMIN_GUIDE'>('OVERVIEW');
    const [expandedPage, setExpandedPage] = useState<string | null>(null);

    const { overview, pages, features, adminGuide } = APP_DOCUMENTATION;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <BookOpen className="text-indigo-600" /> System Documentation
                    </h2>
                    <p className="text-slate-500 font-medium"> comprehensive guide to app features and administration.</p>
                </div>
                <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-400">
                    v1.0.0
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1">
                {[
                    { id: 'OVERVIEW', label: 'Overview', icon: Layout },
                    { id: 'PAGES', label: 'Page List', icon: List },
                    { id: 'FEATURES', label: 'Key Features', icon: Zap },
                    { id: 'ADMIN_GUIDE', label: 'Admin Guide', icon: Shield },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id as any)}
                        className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-t-lg transition-colors whitespace-nowrap ${
                            activeSection === tab.id
                                ? 'bg-white border-x border-t border-slate-200 text-indigo-600'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-b-2xl rounded-tr-2xl p-6 border border-slate-200 shadow-sm min-h-[400px]">

                {/* OVERVIEW */}
                {activeSection === 'OVERVIEW' && (
                    <div className="space-y-6 max-w-3xl">
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                            <h3 className="text-xl font-black text-indigo-900 mb-4">{overview.title}</h3>
                            <p className="text-slate-700 leading-relaxed font-medium">
                                {overview.content}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <User size={18} className="text-blue-500"/> Student Interface
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Focused on learning, revision, and gamification. Features a dashboard, course player, and AI tools.
                                </p>
                            </div>
                            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <Shield size={18} className="text-red-500"/> Admin Interface
                                </h4>
                                <p className="text-xs text-slate-500">
                                    Focused on management. Features user control, content upload, system settings, and analytics.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAGES LIST */}
                {activeSection === 'PAGES' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500 italic mb-4">Click on a page to view its details.</p>
                        <div className="grid gap-3">
                            {pages.map((page, idx) => (
                                <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:shadow-md">
                                    <button
                                        onClick={() => setExpandedPage(expandedPage === page.name ? null : page.name)}
                                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-white transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-400">
                                                <Layout size={18} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{page.name}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-1">{page.description}</p>
                                            </div>
                                        </div>
                                        {expandedPage === page.name ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
                                    </button>

                                    {expandedPage === page.name && (
                                        <div className="p-4 bg-white border-t border-slate-100 animate-in slide-in-from-top-2">
                                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Core Features</h5>
                                            <div className="grid md:grid-cols-2 gap-3">
                                                {page.features.map((feat, fIdx) => (
                                                    <div key={fIdx} className="flex items-start gap-2 text-sm text-slate-700">
                                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                                        {feat}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* FEATURES */}
                {activeSection === 'FEATURES' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        {features.map((feat, idx) => (
                            <div key={idx} className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-colors">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Zap size={64} />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 mb-3 relative z-10">{feat.title}</h3>
                                <p className="text-sm text-slate-600 leading-relaxed relative z-10">
                                    {feat.details}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ADMIN GUIDE */}
                {activeSection === 'ADMIN_GUIDE' && (
                    <div className="max-w-4xl space-y-8">
                        {adminGuide.map((guide, idx) => (
                            <div key={idx} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md z-10">
                                        {idx + 1}
                                    </div>
                                    {idx !== adminGuide.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 my-2" />}
                                </div>
                                <div className="pb-8">
                                    <h4 className="text-lg font-bold text-slate-800 mb-2">{guide.step}</h4>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium leading-relaxed">
                                        {guide.instruction}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
};

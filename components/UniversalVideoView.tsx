import React, { useEffect, useState } from 'react';
import { getChapterData } from '../firebase';
import { ArrowLeft, Play, X, Lock } from 'lucide-react';
import { User, SystemSettings } from '../types';
import { CustomPlayer } from './CustomPlayer';

interface Props {
    user: User;
    onBack: () => void;
    settings?: SystemSettings;
}

export const UniversalVideoView: React.FC<Props> = ({ user, onBack, settings }) => {
    const [videos, setVideos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeVideo, setActiveVideo] = useState<any>(null);

    useEffect(() => {
        getChapterData('nst_universal_playlist').then(data => {
            if (data && data.videoPlaylist) {
                setVideos(data.videoPlaylist);
            }
            setLoading(false);
        });
    }, []);

    const handleVideoClick = (vid: any) => {
        // Access Check
        let hasAccess = false;
        if (user.role === 'ADMIN') hasAccess = true;
        else if (vid.access === 'FREE') hasAccess = true;
        else if (user.isPremium) {
            if (user.subscriptionLevel === 'ULTRA') hasAccess = true;
            else if (user.subscriptionLevel === 'BASIC' && vid.access === 'BASIC') hasAccess = true;
        }

        if (hasAccess) {
            setActiveVideo(vid);
        } else {
            alert(`🔒 Locked! This video requires ${vid.access} subscription.`);
        }
    };

    if (activeVideo) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in">
                <div className="p-4 flex justify-between items-center bg-black/50 absolute top-0 left-0 right-0 z-10">
                    <button onClick={() => setActiveVideo(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
                        <ArrowLeft size={24} />
                    </button>
                    <h3 className="text-white font-bold truncate px-4">{activeVideo.title}</h3>
                    <div className="w-10"></div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <CustomPlayer videoUrl={activeVideo.url} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 animate-in slide-in-from-bottom-8">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                        Universal Videos
                    </h2>
                    <p className="text-xs text-slate-400">Exclusive Mystery Content</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading Mystery Content...</div>
            ) : videos.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-bold">No videos found. Check back later!</div>
            ) : (
                <div className="grid gap-4">
                    {videos.map((vid, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleVideoClick(vid)}
                            className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center gap-4 hover:bg-white/10 transition-all cursor-pointer group"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/50 group-hover:scale-110 transition-transform">
                                <Play size={20} fill="white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-200 group-hover:text-white">{vid.title}</h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded mt-1 inline-block ${
                                    vid.access === 'FREE' ? 'bg-green-900 text-green-300' :
                                    vid.access === 'BASIC' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'
                                }`}>
                                    {vid.access}
                                </span>
                            </div>
                            {vid.access !== 'FREE' && (!user.isPremium || (user.subscriptionLevel === 'BASIC' && vid.access === 'ULTRA')) && (
                                <Lock size={16} className="text-slate-500" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

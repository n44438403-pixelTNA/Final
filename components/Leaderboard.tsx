
import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, User, SystemSettings } from '../types';
import { Trophy, Medal } from 'lucide-react';

import { getDocs, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

interface Props {
  user: User;
  settings?: SystemSettings;
}

export const Leaderboard: React.FC<Props> = ({ user, settings }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(50));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaderboardEntry));
                setEntries(data);
            } catch (e) {
                console.error("Failed to fetch leaderboard from Firebase", e);
                // Fallback to local storage if Firebase fails
                const stored = localStorage.getItem('nst_leaderboard');
                if (stored) {
                    try {
                        const localData: LeaderboardEntry[] = JSON.parse(stored);
                        if (Array.isArray(localData)) {
                            const sorted = localData.sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime());
                            setEntries(sorted);
                        }
                    } catch (err) {
                        console.error("Failed to load local leaderboard", err);
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading leaderboard...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <Trophy className="text-yellow-500" /> Challenge Leaderboard
            </h3>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                            <tr>
                                <th className="p-4">Rank</th>
                                <th className="p-4">Student</th>
                                <th className="p-4">Topic</th>
                                <th className="p-4 text-right">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {entries.length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-400">No records yet. Be the first!</td></tr>
                            )}
                            {entries.map((entry, idx) => (
                                <tr key={entry.id} className={idx < 3 ? 'bg-yellow-50/30' : ''}>
                                    <td className="p-4 font-bold text-slate-600">
                                        {idx === 0 && <Medal size={20} className="text-yellow-500" />}
                                        {idx === 1 && <Medal size={20} className="text-gray-400" />}
                                        {idx === 2 && <Medal size={20} className="text-orange-600" />}
                                        {idx > 2 && `#${idx + 1}`}
                                    </td>
                                    <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                            {entry.userName.charAt(0)}
                                        </div>
                                        {entry.userName}
                                    </td>
                                    <td className="p-4 text-sm text-slate-500">{entry.topic}</td>
                                    <td className="p-4 text-right font-black text-blue-600">{entry.score} pts</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

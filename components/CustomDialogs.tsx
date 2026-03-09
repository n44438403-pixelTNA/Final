
import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, HelpCircle, Copy, Check, ExternalLink } from 'lucide-react';

interface AlertProps {
  isOpen: boolean;
  type?: string;
  title?: string;
  message: string;
  copyableText?: string;
  actionText?: string;
  actionUrl?: string;
  onClose: () => void;
  class?: string;
  subject?: string;
  lesson?: string;
}

export const CustomAlert: React.FC<AlertProps> = ({ isOpen, type = 'INFO', title, message, copyableText, actionText, actionUrl, onClose, class: className, subject, lesson }) => {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const handleCopy = () => {
    if (copyableText) {
      navigator.clipboard.writeText(copyableText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getIcon = () => {
      switch(type) {
          case 'SUCCESS': return <CheckCircle className="text-green-600" size={32} />;
          case 'ERROR': return <AlertCircle className="text-red-600" size={32} />;
          case 'DISCOUNT': return <AlertCircle className="text-orange-500" size={32} />;
          case 'UPDATE': return <AlertCircle className="text-blue-500" size={32} />;
          case 'FREE_CREDIT': return <CheckCircle className="text-green-500" size={32} />;
          default: return <HelpCircle className="text-blue-600" size={32} />;
      }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                {getIcon()}
            </div>
            
            <h3 className="text-2xl font-black text-slate-800 mb-2">{title || (type === 'SUCCESS' ? 'Success' : type === 'ERROR' ? 'Error' : 'Notice')}</h3>
            
            {(className || subject || lesson) && (
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {className && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase">Class: {className}</span>}
                    {subject && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase">Subject: {subject}</span>}
                    {lesson && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase">Lesson: {lesson}</span>}
                </div>
            )}

            <p className="text-slate-500 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{message}</p>

            {copyableText && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 flex items-center justify-between group">
                    <span className="text-sm font-mono font-bold text-slate-700 truncate mr-2">{copyableText}</span>
                    <button onClick={handleCopy} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm">
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {actionUrl && (
                    <a 
                        href={actionUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {actionText || 'Click Here'} <ExternalLink size={18} />
                    </a>
                )}
                <button 
                    onClick={onClose} 
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 hover:bg-slate-800"
                >
                    Dismiss
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

interface ConfirmProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CustomConfirm: React.FC<ConfirmProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 text-center">
        <h3 className="text-lg font-black text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 mb-6 text-sm">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Confirm</button>
        </div>
      </div>
    </div>
  );
};

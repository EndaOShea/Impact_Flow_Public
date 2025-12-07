import React, { useState, useEffect } from 'react';
import { Save, Trash2, Eye, EyeOff, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { storeApiKey, getApiKey, deleteApiKey, getApiKeyMetadata, checkHasApiKey } from '../services/apiKeyManager';

interface ApiKeySettingsProps {
    userId: string;
    onApiKeyChange?: () => void;
}

export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({
    userId,
    onApiKeyChange
}) => {
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [metadata, setMetadata] = useState<any>(null);

    useEffect(() => {
        checkExistingKey();
    }, [userId]);

    const checkExistingKey = async () => {
        setLoading(true);
        try {
            const exists = await checkHasApiKey(userId);
            setHasKey(exists);

            if (exists) {
                const meta = await getApiKeyMetadata(userId);
                setMetadata(meta);
            }
        } catch (error) {
            console.error('Error checking API key:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) {
            setMessage({ type: 'error', text: 'Please enter an API key' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            await storeApiKey(userId, apiKey.trim());
            setMessage({ type: 'success', text: 'API key encrypted and saved successfully!' });
            setApiKey('');
            setShowKey(false);
            await checkExistingKey();

            if (onApiKeyChange) {
                onApiKeyChange();
            }

            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save API key. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete the stored API key? This cannot be undone.')) {
            try {
                await deleteApiKey(userId);
                setMessage({ type: 'success', text: 'API key deleted successfully' });
                setHasKey(false);
                setMetadata(null);

                if (onApiKeyChange) {
                    onApiKeyChange();
                }

                setTimeout(() => setMessage(null), 3000);
            } catch (error) {
                setMessage({ type: 'error', text: 'Failed to delete API key' });
            }
        }
    };

    const handleViewKey = async () => {
        if (showKey) {
            setApiKey('');
            setShowKey(false);
        } else {
            try {
                const key = await getApiKey(userId);
                if (key) {
                    setApiKey(key);
                    setShowKey(true);
                } else {
                    setMessage({ type: 'error', text: 'Failed to retrieve API key' });
                }
            } catch (error) {
                setMessage({ type: 'error', text: 'Failed to decrypt API key' });
            }
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-slate-500">Loading API key settings...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Google Gemini API Key</h3>
                    <p className="text-sm text-slate-500">Required for AI-powered diagram generation</p>
                </div>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                    message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            {hasKey && metadata && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-blue-700 font-medium mb-1">
                                <CheckCircle className="w-4 h-4" />
                                <span>API Key Configured</span>
                            </div>
                            <p className="text-xs text-blue-600">
                                Added on {new Date(metadata.createdAt).toLocaleDateString()} at {new Date(metadata.createdAt).toLocaleTimeString()}
                            </p>
                            {metadata.lastUsed && (
                                <p className="text-xs text-blue-600">
                                    Last used: {new Date(metadata.lastUsed).toLocaleDateString()} at {new Date(metadata.lastUsed).toLocaleTimeString()}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleViewKey}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                title={showKey ? "Hide key" : "View key"}
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Delete key"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        {hasKey ? 'Update API Key' : 'Enter API Key'}
                    </label>
                    <div className="relative">
                        <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIza..."
                            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-slate-900 font-mono text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                        Get your API key from{' '}
                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            Google AI Studio
                        </a>
                    </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                        <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-800">
                            <p className="font-medium mb-1">Security Information</p>
                            <ul className="list-disc list-inside space-y-1 text-amber-700">
                                <li>Your API key is encrypted using AES-256-GCM with authenticated encryption</li>
                                <li>Each key uses a unique initialization vector (IV) for maximum security</li>
                                <li>This key is personal to you and not shared with others</li>
                                <li>The key is never transmitted or stored in plain text</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving || !apiKey.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors"
                >
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Encrypting and Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {hasKey ? 'Update API Key' : 'Save API Key'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

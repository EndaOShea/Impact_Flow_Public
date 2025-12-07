
import React, { useState, useEffect } from 'react';
import { User, Organization, JoinRequest } from '../types';
import { api } from '../services/api';
import { Building2, Plus, Search, LogOut, CheckCircle2, ArrowRight, X } from 'lucide-react';

interface OnboardingProps {
    user: User;
    onComplete: (updatedUser: User) => void;
    onLogout: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ user, onComplete, onLogout }) => {
    const [step, setStep] = useState<'CHOICE' | 'CREATE' | 'JOIN' | 'PENDING'>('CHOICE');
    const [orgName, setOrgName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Organization[]>([]);
    const [allOrgs, setAllOrgs] = useState<Organization[]>([]);
    const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const checkPending = async () => {
            try {
                const reqs = await api.getJoinRequests();
                const myPending = reqs.filter(r => r.userId === user.id && r.status === 'PENDING');
                if (myPending.length > 0) {
                    setPendingRequests(myPending);
                    setStep('PENDING');
                }
            } catch (err) {
                console.error('Failed to check pending requests:', err);
            }
        };
        const loadOrgs = async () => {
            try {
                const orgs = await api.getOrganizations();
                setAllOrgs(orgs);
                setSearchResults(orgs.slice(0, 5)); // Initial view
            } catch (err) {
                console.error('Failed to load organizations:', err);
            }
        };
        checkPending();
        loadOrgs();
    }, [user.id]);

    // Dynamic Filter
    useEffect(() => {
        if (!searchQuery) {
            setSearchResults(allOrgs.slice(0, 5));
        } else {
            const matches = allOrgs.filter(o => o.name.toLowerCase().includes(searchQuery.toLowerCase()));
            setSearchResults(matches);
        }
    }, [searchQuery, allOrgs]);

    const handleCreateOrg = async () => {
        if (!orgName.trim()) return;
        setIsSubmitting(true);
        try {
            await api.createOrganization(orgName);
            // Reload user to get updated Org ID
            const updated = await api.getCurrentUser();
            if (updated) onComplete(updated);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJoinRequest = async (orgId: string) => {
        setIsSubmitting(true);
        try {
            await api.requestJoin(orgId);
            setStep('PENDING');
            const reqs = await api.getJoinRequests();
            setPendingRequests(reqs.filter(r => r.userId === user.id && r.status === 'PENDING'));
        } catch (err) {
            alert("Request already pending");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelRequest = async (reqId: string) => {
        setIsSubmitting(true);
        try {
            await api.cancelJoinRequest(reqId);
            const reqs = await api.getJoinRequests();
            const myPending = reqs.filter(r => r.userId === user.id && r.status === 'PENDING');
            setPendingRequests(myPending);
            if (myPending.length === 0) {
                setStep('JOIN');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Welcome, {user.name}!</h1>
                        <p className="text-slate-500">Let's get you set up with a workspace.</p>
                    </div>
                    <button onClick={onLogout} className="text-slate-400 hover:text-red-500 flex items-center gap-2 text-sm">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>

                {step === 'CHOICE' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={() => setStep('CREATE')}
                            className="p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                        >
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Plus className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 mb-2">Create New Organization</h3>
                            <p className="text-sm text-slate-500">Become the Owner. Invite others, create teams, and manage projects from scratch.</p>
                        </button>

                        <button 
                            onClick={() => setStep('JOIN')}
                            className="p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                        >
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Search className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800 mb-2">Join Existing Team</h3>
                            <p className="text-sm text-slate-500">Search for your company's workspace and request access to join their projects.</p>
                        </button>
                    </div>
                )}

                {step === 'CREATE' && (
                    <div className="max-w-md mx-auto">
                        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Building2 className="w-5 h-5" /> Name Your Organization
                        </h2>
                        <div className="space-y-4">
                            <input 
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="e.g. Acme Corp, Design Studio A"
                                className="w-full px-4 py-3 text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-900"
                            />
                            <button 
                                onClick={handleCreateOrg}
                                disabled={!orgName.trim() || isSubmitting}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Creating...' : 'Launch Workspace'}
                            </button>
                            <button onClick={() => setStep('CHOICE')} className="w-full text-slate-400 text-sm hover:text-slate-600">Back</button>
                        </div>
                    </div>
                )}

                {step === 'JOIN' && (
                    <div>
                         <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Search className="w-5 h-5" /> Find Organization
                        </h2>
                        <div className="flex gap-2 mb-6">
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Type to filter organizations..."
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-purple-500 bg-white text-slate-900"
                            />
                        </div>

                        <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                            {searchResults.length === 0 && <p className="text-slate-400 italic text-center">No organizations found matching "{searchQuery}".</p>}
                            {searchResults.map(org => (
                                <div key={org.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                                    <span className="font-bold text-slate-700">{org.name}</span>
                                    <button 
                                        onClick={() => handleJoinRequest(org.id)}
                                        disabled={isSubmitting}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        Request to Join
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setStep('CHOICE')} className="mt-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 block mx-auto">Back</button>
                    </div>
                )}

                {step === 'PENDING' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Request Sent</h2>
                        <p className="text-slate-500 max-w-md mx-auto mb-8">
                            We've sent your request to the administrators. You will be notified via email once they approve your access.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-left max-w-sm mx-auto mb-6">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Pending Requests</h4>
                            {pendingRequests.map(r => (
                                <div key={r.id} className="flex items-center justify-between text-sm font-medium text-slate-700 gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                        {allOrgs.find(o => o.id === r.organizationId)?.name || 'Unknown Org'}
                                    </div>
                                    <button 
                                        onClick={() => handleCancelRequest(r.id)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-1"
                                        title="Cancel Request"
                                        disabled={isSubmitting}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                            <button onClick={() => window.location.reload()} className="text-blue-600 hover:underline flex items-center gap-1">
                                Check Status Again <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

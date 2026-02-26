import React, { useState, useEffect } from 'react';
import { citizenActions } from '../../services/citizenApi';
import { Users, UserPlus, Trash2, HeartPulse } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';

export default function FamilyMembersPanel() {
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', aadhaar_masked: '', relation: '', age: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showAlert } = useAlert();

    const fetchMembers = async () => {
        setIsLoading(true);
        try {
            const data = await citizenActions.getFamily();
            setMembers(data);
        } catch (err) {
            showAlert("Failed to load family members", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await citizenActions.addFamily({
                ...formData,
                age: parseInt(formData.age, 10)
            });
            showAlert("Family member added successfully.", "success");
            setShowForm(false);
            setFormData({ name: '', aadhaar_masked: '', relation: '', age: '' });
            fetchMembers();
        } catch (err) {
            showAlert(err.response?.data?.detail || "Failed to add family member", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getMemberStatus = (member) => {
        if (member?.is_verified === true) {
            return { label: 'Verified', className: 'bg-green-100 text-green-800' };
        }
        if (member?.is_verified === false) {
            return { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' };
        }
        return { label: 'Linked', className: 'bg-blue-100 text-blue-800' };
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to remove this family member?")) return;
        try {
            await citizenActions.deleteFamily(id);
            showAlert("Member removed", "success");
            fetchMembers();
        } catch (err) {
            showAlert("Failed to remove member", "error");
        }
    };

    return (
        <div className="bg-white p-6 rounded-sm shadow-sm border border-[#E5E7EB] border-t-4 border-t-emerald-600">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-full">
                        <Users className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Family Details</h2>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">{members.length} Members</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    disabled={members.length >= 8}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                    {showForm ? 'Cancel' : <><UserPlus className="w-4 h-4" /> Add</>}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 p-4 border border-gray-200 rounded">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500 p-2 border bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Aadhaar / UID (12 Digits)</label>
                            <input
                                type="text"
                                required
                                maxLength={12}
                                value={formData.aadhaar_masked}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    if (val.length <= 12) {
                                        setFormData({ ...formData, aadhaar_masked: val });
                                    }
                                }}
                                className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500 p-2 border bg-white"
                                placeholder="12-digit Aadhaar Number"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Relation</label>
                            <select
                                required
                                value={formData.relation}
                                onChange={e => setFormData({ ...formData, relation: e.target.value })}
                                className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500 p-2 border bg-white"
                            >
                                <option value="">Select Relation</option>
                                <option value="Spouse">Spouse</option>
                                <option value="Child">Child</option>
                                <option value="Parent">Parent</option>
                                <option value="Sibling">Sibling</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Age</label>
                            <input
                                type="number"
                                required
                                min="0" max="120"
                                value={formData.age}
                                onKeyDown={e => {
                                    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                onChange={e => setFormData({ ...formData, age: e.target.value })}
                                className="w-full text-sm border-gray-300 rounded focus:ring-emerald-500 focus:border-emerald-500 p-2 border bg-white"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm uppercase tracking-widest rounded transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? 'Submitting...' : 'Link Family Member'}
                    </button>
                    <p className="mt-2 text-[10px] text-gray-500 text-center uppercase tracking-widest leading-none">You can link up to 8 family members per ration card.</p>
                </form>
            )}

            {isLoading ? (
                <div className="animate-pulse space-y-3">
                    {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded"></div>)}
                </div>
            ) : members.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <HeartPulse className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-500" />
                    <p className="text-sm font-medium">No family members linked.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {members.map((member) => {
                        const status = getMemberStatus(member);
                        return (
                        <div key={member.id} className="p-3 border border-gray-100 rounded bg-white shadow-sm flex flex-col justify-between group">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-gray-900 leading-tight">{member.name}</h4>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest shrink-0 ${status.className}`}>
                                    {status.label}
                                </span>
                            </div>
                            <div className="space-y-1 mb-3">
                                <p className="text-xs text-gray-600 font-medium">UID: <span className="text-gray-900 tracking-widest">{member.aadhaar_masked || 'XXXX-XXXX-XXXX'}</span></p>
                                <p className="text-xs text-gray-600 font-medium">{member.relation} • {member.age} yrs</p>
                            </div>
                            <div className="pt-2 border-t border-gray-50 flex justify-end">
                                <button
                                    onClick={() => handleDelete(member.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    title="Remove Member"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDistrict } from '../../context/DistrictContext';
import { ANDHRA_PRADESH_DISTRICTS } from '../../constants/districts';
import {
    User, Mail, Shield, MapPin, Search, ChevronDown,
    Check, RefreshCw, Clock, Building, X
} from 'lucide-react';

const SettingsPage = () => {
    const { user } = useAuth();
    const { selectedDistrict, setSelectedDistrict } = useDistrict();
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Auto-focus search input when dropdown opens
    useEffect(() => {
        if (isDropdownOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isDropdownOpen]);

    // Sort and filter districts
    const filteredDistricts = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        const matches = ANDHRA_PRADESH_DISTRICTS.filter(d => {
            if (!query) return true;
            return d.toLowerCase().includes(query) || d.split(' ').some(word => word.toLowerCase().startsWith(query));
        });

        return matches.sort((a, b) => {
            if (!query) return a.localeCompare(b);
            const aStarts = a.toLowerCase().startsWith(query);
            const bStarts = b.toLowerCase().startsWith(query);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
        });
    }, [searchTerm]);

    const isAdmin = user?.role === 'admin' || user?.role === 'state_admin';
    const lastSyncTime = new Date().toLocaleTimeString();

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-[#1E3A8A]">System Settings</h1>
                <p className="text-[#6B7280]">Manage your administrative preferences and monitoring scope.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Account Info */}
                <div className="md:col-span-2 space-y-6">
                    <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB]">
                            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
                                <User size={16} className="text-[#1E3A8A]" />
                                Account Information
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-[#9CA3AF] uppercase mb-1">Full Name</label>
                                    <div className="flex items-center gap-2 p-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-[#1F2937] font-medium">
                                        <User size={14} className="text-[#6B7280]" />
                                        {user?.name || "Administrator"}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#9CA3AF] uppercase mb-1">Email Address</label>
                                    <div className="flex items-center gap-2 p-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-[#1F2937] font-medium">
                                        <Mail size={14} className="text-[#6B7280]" />
                                        {user?.email || "admin@ration.gov.in"}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#9CA3AF] uppercase mb-1">System Role</label>
                                    <div className="flex items-center gap-2 p-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-[#1E3A8A] font-bold">
                                        <Shield size={14} />
                                        {user?.role?.replace('_', ' ').toUpperCase() || "STATE ADMIN"}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#9CA3AF] uppercase mb-1">Assigned Jurisdiction</label>
                                    <div className="flex items-center gap-2 p-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-[#1F2937] font-medium">
                                        <Building size={14} className="text-[#6B7280]" />
                                        {user?.district || "Andhra Pradesh (HQ)"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Monitoring District Section */}
                    <section className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
                        <div className="px-6 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] rounded-t-xl">
                            <h2 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
                                <MapPin size={16} className="text-[#1E3A8A]" />
                                Monitoring District
                            </h2>
                        </div>
                        <div className="p-6 space-y-6 overflow-visible">
                            <div className="space-y-4">
                                <p className="text-sm text-[#4B5563] leading-relaxed">
                                    Select the district you wish to monitor. All dashboard metrics, real-time alerts, and predictive AI models will be automatically scoped and re-calculated based on this selection.
                                </p>

                                <div className="relative w-full max-w-[320px]" ref={dropdownRef}>
                                    <button
                                        disabled={!isAdmin}
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className={`
                      w-full flex items-center justify-between px-4 py-3 bg-white border-2 rounded-xl text-[15px] transition-all duration-200
                      ${isDropdownOpen ? 'border-[#1E3A8A] ring-4 ring-[#1E3A8A]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}
                      ${!isAdmin ? 'bg-[#F9FAFB] cursor-not-allowed text-[#9CA3AF] border-[#E5E7EB]' : 'cursor-pointer'}
                    `}
                                    >
                                        <span className={`font-bold ${isDropdownOpen ? 'text-[#1E3A8A]' : 'text-[#1F2937]'}`}>
                                            {selectedDistrict}
                                        </span>
                                        <ChevronDown size={18} className={`text-[#9CA3AF] transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-[#1E3A8A]' : ''}`} />
                                    </button>

                                    {isDropdownOpen && isAdmin && (
                                        <div className="absolute top-full left-0 mt-2 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                                            <div className="p-3 bg-[#F9FAFB] border-b border-[#E2E8F0]">
                                                <div className="relative group">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#1E3A8A] transition-colors" />
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        placeholder="Search district..."
                                                        className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-[#E2E8F0] rounded-lg focus:ring-4 focus:ring-[#1E3A8A]/5 focus:border-[#1E3A8A] focus:outline-none transition-all placeholder:text-[#9CA3AF] font-medium"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                    {searchTerm && (
                                                        <button
                                                            onClick={() => setSearchTerm('')}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                                                {filteredDistricts.length > 0 ? (
                                                    filteredDistricts.map((district) => (
                                                        <button
                                                            key={district}
                                                            className={`
                                w-full text-left px-4 py-3 text-[14px] flex items-center justify-between transition-colors
                                ${selectedDistrict === district ? 'bg-[#EFF6FF] text-[#1E3A8A] font-bold' : 'text-[#4B5563] hover:bg-[#F9FAFB]'}
                              `}
                                                            onClick={() => {
                                                                setSelectedDistrict(district);
                                                                setIsDropdownOpen(false);
                                                                setSearchTerm('');
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${selectedDistrict === district ? 'bg-[#1E3A8A]' : 'bg-transparent'}`} />
                                                                {district}
                                                            </div>
                                                            {selectedDistrict === district && <Check size={16} className="text-[#1E3A8A]" />}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-6 py-8 text-center space-y-2">
                                                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#F3F4F6] text-[#9CA3AF]">
                                                            <Search size={20} />
                                                        </div>
                                                        <p className="text-sm font-medium text-[#6B7280]">No districts found</p>
                                                        <p className="text-xs text-[#9CA3AF]">Try a different search term</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {!isAdmin && (
                                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[13px] font-medium">
                                        <Shield size={18} className="shrink-0 text-amber-600" />
                                        <span>Your monitoring scope is locked to <strong>{user?.district}</strong>. Higher-level selection requires State Admin credentials.</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pt-2 text-[12px] text-[#6B7280] font-medium">
                                    <div className="relative">
                                        <RefreshCw size={14} className="animate-spin-slow text-[#1E3A8A]" />
                                        <div className="absolute inset-0 bg-[#1E3A8A]/10 rounded-full animate-ping scale-150 opacity-20" />
                                    </div>
                                    <span>Last Data Sync: Just now ({lastSyncTime})</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Mini Stats/Status */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-[#1E3A8A] to-[#1e40af] rounded-2xl p-6 text-white shadow-xl overflow-hidden relative border border-white/10">
                        <div className="absolute -right-6 -bottom-6 opacity-10">
                            <Shield size={160} />
                        </div>
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] mb-5 text-[#93c5fd]">System Integrity</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center group">
                                <span className="text-xs text-white/70 group-hover:text-white transition-colors">Blockchain Node</span>
                                <span className="flex items-center gap-2 text-xs font-bold bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    Operational
                                </span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-xs text-white/70 group-hover:text-white transition-colors">ML Analysis Engine</span>
                                <span className="flex items-center gap-2 text-xs font-bold bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    Calibrated
                                </span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-xs text-white/70 group-hover:text-white transition-colors">API Latency</span>
                                <span className="text-xs font-bold text-white">12ms <span className="text-green-400 font-normal ml-1">Excellent</span></span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
                        <h3 className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-[0.1em] mb-4 flex items-center gap-2">
                            <Clock size={14} className="text-[#1E3A8A]" />
                            Session Context
                        </h3>
                        <div className="space-y-5">
                            <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#EDF2F7]">
                                <p className="text-[10px] text-[#9CA3AF] uppercase font-bold mb-1.5">Monitoring Focus</p>
                                <div className="flex items-center gap-2.5 text-[15px] font-bold text-[#1E3A8A]">
                                    <div className="p-1.5 bg-[#EFF6FF] rounded-lg">
                                        <MapPin size={16} />
                                    </div>
                                    {selectedDistrict}
                                </div>
                            </div>
                            <div className="pt-2">
                                <div className="flex justify-between items-center text-[13px] mb-2">
                                    <span className="text-[#64748B]">Platform Build</span>
                                    <span className="font-bold text-[#1F2937]">v2.4.9-GOV</span>
                                </div>
                                <div className="h-1.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#1E3A8A] rounded-full" style={{ width: '100%' }} />
                                </div>
                                <p className="mt-2 text-[10px] text-center text-[#9CA3AF] font-medium uppercase">Fully Encrypted Session</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
        </div>
    );
};

export default SettingsPage;

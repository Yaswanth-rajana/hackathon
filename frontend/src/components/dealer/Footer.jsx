export default function Footer() {
    return (
        <footer className="bg-white border-t border-[#D1D5DB] mt-12 py-8 text-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <h3 className="font-semibold text-[#003366] uppercase tracking-wide mb-3">Portal Information</h3>
                        <p className="text-gray-600">
                            RationShield Fair Price Shop Management System.<br />
                            An official portal for sanctioned dealers.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-[#003366] uppercase tracking-wide mb-3">Contact Support</h3>
                        <ul className="text-gray-600 space-y-1">
                            <li>Helpline: <strong>1967</strong> (Toll Free)</li>
                            <li>Email: <a href="mailto:support@rationshield.gov.in" className="text-[#005A9C] hover:underline">support@rationshield.gov.in</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-semibold text-[#003366] uppercase tracking-wide mb-3">System Status</h3>
                        <ul className="text-gray-600 space-y-1">
                            <li>Version: 2.1.0-secure</li>
                            <li>Network: Primary Blockchain Node</li>
                            <li className="flex items-center gap-2 mt-2">
                                <span className="w-2 h-2 rounded-full bg-[#1B5E20]"></span>
                                <span className="text-[#1B5E20] font-medium">All Systems Operational</span>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 pt-4 border-t border-gray-100 text-center text-gray-500 text-xs">
                    &copy; {new Date().getFullYear()} RationShield Authority, Government of Andhra Pradesh. All Rights Reserved.
                </div>
            </div>
        </footer>
    );
}

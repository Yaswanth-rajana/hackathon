import { Users, FileText, CheckSquare, Package } from 'lucide-react';

export default function StatsBar({ stats }) {
    if (!stats) return null;

    const config = [
        {
            label: 'TOTAL BENEFICIARIES',
            value: stats.total_beneficiaries?.toLocaleString() || '0',
            icon: Users,
            color: 'text-[#005A9C]'
        },
        {
            label: "TODAY's TRANSACTIONS",
            value: stats.today_transactions?.toLocaleString() || '0',
            icon: FileText,
            color: 'text-[#005A9C]'
        },
        {
            label: 'COMPLIANCE SCORE',
            value: stats.compliance_score ? `${stats.compliance_score}%` : 'N/A',
            icon: CheckSquare,
            color: stats.compliance_score >= 90 ? 'text-[#1B5E20]' : 'text-[#B45309]'
        },
        {
            label: 'AVAILABLE WHEAT',
            value: stats.stock_available?.wheat !== undefined ? `${stats.stock_available.wheat} KG` : 'N/A',
            icon: Package,
            color: 'text-[#005A9C]'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {config.map((stat, i) => (
                <div key={i} className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 tracking-wider mb-1">{stat.label}</p>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`p-3 bg-gray-50 rounded-sm border border-gray-100 ${stat.color}`}>
                        <stat.icon className="w-6 h-6" />
                    </div>
                </div>
            ))}
        </div>
    );
}

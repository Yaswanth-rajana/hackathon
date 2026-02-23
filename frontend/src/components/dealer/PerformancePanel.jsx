import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function PerformancePanel({ performance }) {
    if (!performance) return null;

    const hasData = performance.daily_counts && performance.daily_counts.length > 0;

    // Safe defaults if daily_counts is empty or malformed
    const labels = hasData ? performance.daily_counts.map(d => d.date) : [];
    const dataPoints = hasData ? performance.daily_counts.map(d => d.count) : [];

    const data = {
        labels,
        datasets: [
            {
                label: 'Daily Distributions',
                data: dataPoints,
                borderColor: '#005A9C',
                backgroundColor: 'rgba(0, 90, 156, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#003366',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: 'rgba(0, 51, 102, 0.9)',
                titleFont: { size: 13, family: 'Inter, sans-serif' },
                bodyFont: { size: 14, weight: 'bold', family: 'Inter, sans-serif' },
                padding: 10,
                displayColors: false,
                callbacks: {
                    label: (context) => `${context.parsed.y} Transactions`
                }
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: '#f3f4f6', drawBorder: false },
                ticks: { font: { family: 'Inter, sans-serif', size: 11 }, precision: 0 }
            },
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { font: { family: 'Inter, sans-serif', size: 11 }, maxRotation: 45, minRotation: 0 }
            },
        },
        layout: {
            padding: { top: 10, right: 15, bottom: 5, left: 10 }
        }
    };

    return (
        <div className="bg-white border border-[#D1D5DB] rounded-sm shadow-sm overflow-hidden h-full flex flex-col">
            <div className="bg-gray-50 border-b border-[#D1D5DB] px-4 py-3 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-[#003366] uppercase tracking-wide flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> PERFORMANCE METRICS
                </h2>
            </div>

            <div className="p-4 flex-grow flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Mandal Average</p>
                            <p className="text-lg font-bold text-gray-900">{performance.mandal_average || 0}</p>
                        </div>
                        {performance.difference_indicator === '+' ? (
                            <TrendingUp className="w-6 h-6 text-[#1B5E20]" />
                        ) : performance.difference_indicator === '-' ? (
                            <TrendingDown className="w-6 h-6 text-[#B91C1C]" />
                        ) : (
                            <TrendingUp className="w-6 h-6 text-gray-400" />
                        )}
                    </div>

                    <div className="bg-gray-50 border border-gray-200 p-3 rounded-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Compliance</p>
                            <p className="text-lg font-bold text-gray-900">{performance.compliance_score || 0}%</p>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded-sm border ${(performance.compliance_score || 0) >= 90 ? 'bg-[#F0FDF4] text-[#1B5E20] border-[#1B5E20]/20' : 'bg-[#FEF2F2] text-[#B91C1C] border-[#B91C1C]/20'
                            }`}>
                            {(performance.compliance_score || 0) >= 90 ? 'GOOD' : 'POOR'}
                        </div>
                    </div>
                </div>

                <div className="flex-grow min-h-[200px] border border-gray-100 rounded-sm p-4 w-full h-full relative">
                    {hasData ? (
                        <Line options={options} data={data} />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50">
                            <p className="text-sm font-medium text-gray-500 border border-dashed border-gray-300 px-6 py-4 rounded-sm">
                                No performance data available for the selected period
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

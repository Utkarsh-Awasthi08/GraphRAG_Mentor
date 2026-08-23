import { Activity, XCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn, getStatusColor } from "../utils/helpers";

function MetricCard({ title, value, icon: Icon, colorClass }) {
  return (
    <div className={cn("glass-panel p-5 flex items-start justify-between border-l-4", colorClass)}>
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className={cn("p-2 rounded-lg bg-slate-800/50", colorClass.replace("border-", "text-"))}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

export default function MetricCards({ data, mode }) {
  // If we are in analytical mode and have a single row with numbers
  if (mode === "ANALYTICAL" && data?.length === 1) {
    const row = data[0];
    const keys = Object.keys(row);
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {keys.map((k, i) => (
          <MetricCard 
            key={k} 
            title={k.replace(/([A-Z])/g, ' $1').trim()} 
            value={row[k]} 
            icon={Activity} 
            colorClass={i % 2 === 0 ? "border-indigo-500" : "border-emerald-500"} 
          />
        ))}
      </div>
    );
  }

  // Fallback / Contextual placeholder stats based on retrieved data
  const total = data?.length || 0;
  const compileErrors = data?.filter(d => d.status?.toLowerCase().includes("compile")).length || 0;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <MetricCard title="Retrieved" value={total} icon={Activity} colorClass="border-indigo-500 text-indigo-400" />
      <MetricCard title="Compile Errors" value={compileErrors} icon={XCircle} colorClass="border-rose-500 text-rose-400" />
      <MetricCard title="Runtime Errors" value={data?.filter(d => d.status?.toLowerCase().includes("runtime")).length || 0} icon={AlertTriangle} colorClass="border-amber-500 text-amber-400" />
      <MetricCard title="Wrong Answer" value={data?.filter(d => d.status?.toLowerCase().includes("wrong answer")).length || 0} icon={XCircle} colorClass="border-orange-500 text-orange-400" />
      <MetricCard title="Time Limit" value={data?.filter(d => d.status?.toLowerCase().includes("time limit")).length || 0} icon={Activity} colorClass="border-yellow-500 text-yellow-400" />
      <MetricCard title="Memory Limit" value={data?.filter(d => d.status?.toLowerCase().includes("memory limit")).length || 0} icon={AlertTriangle} colorClass="border-purple-500 text-purple-400" />
      <MetricCard title="Accepted" value={data?.filter(d => d.status?.toLowerCase().includes("accepted")).length || 0} icon={CheckCircle2} colorClass="border-emerald-500 text-emerald-400" />
    </div>
  );
}
